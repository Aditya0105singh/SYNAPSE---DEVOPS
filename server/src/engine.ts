import type {
  Alert,
  AlertAction,
  InstanceState,
  LogEvent,
  MetricsSnapshot,
  ServerMessage,
  Severity,
} from "@synapse/shared";
import type { Trace } from "@synapse/shared";
import { PERSONAS, type Persona } from "./personas.js";

const STATUS_ORDER = ["healthy", "medium", "high", "critical"] as const;
type EscalatableStatus = (typeof STATUS_ORDER)[number];

const LOG_BUFFER_CAP = 500;
const CPU_HISTORY_LEN = 20;
const METRICS_HISTORY_CAP = 300;
const TRACE_CAP = 20;
const SNOOZE_MS = 5 * 60 * 1000;
const COST_PER_CPU_SECOND = 0.00042; // mock $/cpu-second across the fleet
const RESTART_DURATION_MS = 5000;

interface InternalInstance extends InstanceState {
  _persona: Persona;
  _recoverAt: number | null;
  _restartUntil: number | null;
  _activeTraceId: string | null;
  _activeScenarioId: string | null;
}

function randRange(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function fill(template: string) {
  return template
    .replace("{ms}", String(Math.floor(randRange(4, 240))))
    .replace("{n}", String(Math.floor(randRange(1, 999))));
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Which personas (and how many replicas) each mock org runs. */
const ORG_FLEETS: Record<string, { persona: string; replicas: number }[]> = {
  sparkpixel: [
    { persona: "ml", replicas: 1 },
    { persona: "payment", replicas: 1 },
    { persona: "cache", replicas: 1 },
    { persona: "gateway", replicas: 1 },
    { persona: "db", replicas: 1 },
    { persona: "worker", replicas: 1 },
    { persona: "search", replicas: 1 },
  ],
  novatrace: [
    { persona: "ml", replicas: 3 },
    { persona: "gateway", replicas: 1 },
    { persona: "db", replicas: 1 },
  ],
  helios: [
    { persona: "worker", replicas: 2 },
    { persona: "search", replicas: 2 },
    { persona: "db", replicas: 2 },
    { persona: "cache", replicas: 1 },
    { persona: "payment", replicas: 1 },
    { persona: "gateway", replicas: 1 },
  ],
};

export class IncidentEngine {
  readonly orgId: string;
  private instances = new Map<string, InternalInstance>();
  private logBuffer: LogEvent[] = [];
  private metricsHistory: MetricsSnapshot[] = [];
  private alerts = new Map<string, Alert>();
  private alertByInstance = new Map<string, string>();
  private traces = new Map<string, Trace>();
  private listeners = new Set<(msg: ServerMessage) => void>();
  private slowTimer: NodeJS.Timeout | null = null;
  private fastTimer: NodeJS.Timeout | null = null;
  private stressTimer: NodeJS.Timeout | null = null;
  private stressUntil = 0;
  private cpuSecondsAccum = 0;

  constructor(orgId = "sparkpixel") {
    this.orgId = orgId;
    const fleet = ORG_FLEETS[orgId] ?? ORG_FLEETS["sparkpixel"];
    let counter = 1;
    for (const { persona: personaKey, replicas } of fleet) {
      const persona = PERSONAS.find((p) => p.key === personaKey);
      if (!persona) continue;
      for (let i = 0; i < replicas; i++) {
        const id = `${orgId}-${persona.key}-${counter}`;
        const suffix = String(counter).padStart(2, "0");
        const inst: InternalInstance = {
          id,
          name: `${persona.namePrefix}-${suffix}`,
          ip: `${persona.ipBase}.${Math.floor(randRange(2, 250))}`,
          persona: persona.key,
          category: persona.category,
          status: "healthy",
          cpu: persona.baseline.cpu,
          cpuHistory: [],
          memoryGb: persona.baseline.memGb,
          memoryCapGb: persona.baseline.memCapGb,
          uptimeSec: Math.floor(randRange(3600, 60 * 60 * 24 * 90)),
          lastIncidentAt: null,
          _persona: persona,
          _recoverAt: null,
          _restartUntil: null,
          _activeTraceId: null,
          _activeScenarioId: null,
        };
        inst.cpuHistory = Array.from({ length: CPU_HISTORY_LEN }, () => ({
          t: Date.now(),
          v: inst.cpu,
        }));
        this.instances.set(id, inst);
        counter++;
      }
    }
  }

  // ---- introspection helpers (also used by tests) ----

  getInstanceIds(): string[] {
    return [...this.instances.keys()];
  }

  getInstance(id: string): InstanceState | undefined {
    const inst = this.instances.get(id);
    return inst ? this.strip(inst) : undefined;
  }

  getAlerts(): Alert[] {
    return [...this.alerts.values()];
  }

  getTraces(): Trace[] {
    return [...this.traces.values()];
  }

  onMessage(fn: (msg: ServerMessage) => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(msg: ServerMessage) {
    for (const fn of this.listeners) fn(msg);
  }

  start() {
    this.slowTimer = setInterval(() => this.slowTick(), 1000);
    this.fastTimer = setInterval(() => this.fastTick(), 350);
  }

  stop() {
    if (this.slowTimer) clearInterval(this.slowTimer);
    if (this.fastTimer) clearInterval(this.fastTimer);
    if (this.stressTimer) clearInterval(this.stressTimer);
  }

  hydratePayload(): Extract<ServerMessage, { type: "hydrate" }> {
    return {
      type: "hydrate",
      orgId: this.orgId,
      instances: [...this.instances.values()].map((i) => this.strip(i)),
      logs: this.logBuffer.slice(-200),
      metrics: this.computeMetrics(),
      metricsHistory: this.metricsHistory,
      alerts: [...this.alerts.values()],
      traces: [...this.traces.values()],
    };
  }

  private strip(inst: InternalInstance): InstanceState {
    const { _persona, _recoverAt, _restartUntil, _activeTraceId, _activeScenarioId, ...rest } = inst;
    return rest;
  }

  private pushLog(log: LogEvent) {
    this.logBuffer.push(log);
    if (this.logBuffer.length > LOG_BUFFER_CAP) this.logBuffer.shift();
    this.emit({ type: "log:event", log });
  }

  private makeLog(
    inst: InternalInstance,
    severity: Severity,
    message: string,
    detail?: Record<string, unknown>
  ): LogEvent {
    return {
      id: `${inst.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      ts: Date.now(),
      instanceId: inst.id,
      instanceName: inst.name,
      severity,
      message,
      detail,
      traceId: inst._activeTraceId ?? undefined,
    };
  }

  private fastTick() {
    this.emitAmbientLog();
  }

  private emitAmbientLog() {
    const list = [...this.instances.values()];
    if (!list.length) return;
    const inst = pick(list);
    if (inst.status === "offline") return;
    const msg = fill(pick(inst._persona.ambientMessages));
    const severity: Severity = Math.random() < 0.08 ? "info" : "debug";
    this.pushLog(this.makeLog(inst, severity, msg));
  }

  /** Burst ambient logs at ~25/s for `durationMs` to demo the virtualized log path under load. */
  startStressTest(durationMs = 15000) {
    this.stressUntil = Date.now() + durationMs;
    if (this.stressTimer) return; // already running; just extended the window
    this.stressTimer = setInterval(() => {
      if (Date.now() > this.stressUntil) {
        if (this.stressTimer) clearInterval(this.stressTimer);
        this.stressTimer = null;
        return;
      }
      this.emitAmbientLog();
    }, 40);
  }

  private slowTick() {
    for (const inst of this.instances.values()) {
      this.updateInstance(inst);
    }
    const metrics = this.computeMetrics();
    this.metricsHistory.push(metrics);
    if (this.metricsHistory.length > METRICS_HISTORY_CAP) this.metricsHistory.shift();
    this.emit({ type: "metrics:update", metrics });
  }

  private updateInstance(inst: InternalInstance) {
    if (inst.status === "offline") {
      this.pushCpuSample(inst, 0);
      return;
    }

    // restart-in-progress: hold in "deploying" until the window elapses
    if (inst.status === "deploying") {
      inst.cpu = Math.max(5, inst.cpu * 0.7);
      this.pushCpuSample(inst, inst.cpu);
      if (inst._restartUntil && Date.now() > inst._restartUntil) {
        inst._restartUntil = null;
        this.finishRecovery(inst, "Restart complete. Instance back in service.");
      } else {
        this.emit({ type: "instance:update", instance: this.strip(inst) });
      }
      return;
    }

    const baseline = inst._persona.baseline.cpu;
    const statusBoost: Record<string, number> = { healthy: 0, medium: 15, high: 30, critical: 45 };
    const target = Math.min(99, baseline + (statusBoost[inst.status] ?? 0));
    const drift = (target - inst.cpu) * 0.15 + randRange(-inst._persona.volatility, inst._persona.volatility);
    inst.cpu = Math.max(1, Math.min(99, inst.cpu + drift));
    inst.memoryGb = Math.max(
      0.2,
      Math.min(inst.memoryCapGb, inst.memoryGb + randRange(-0.05, 0.05) * inst.memoryCapGb)
    );
    inst.uptimeSec += 1;
    this.cpuSecondsAccum += inst.cpu / 100;
    this.pushCpuSample(inst, inst.cpu);

    // spontaneous escalation, low probability, only if instance has incident templates
    if (inst.status === "healthy" && inst._persona.incidents.length && Math.random() < 0.004) {
      this.escalate(inst, pick(inst._persona.incidents).scenarioId);
      return;
    }

    // spontaneous recovery
    if (inst._recoverAt && Date.now() > inst._recoverAt) {
      this.recover(inst);
      return;
    }

    this.emit({ type: "instance:update", instance: this.strip(inst) });
  }

  private pushCpuSample(inst: InternalInstance, v: number) {
    inst.cpuHistory.push({ t: Date.now(), v });
    if (inst.cpuHistory.length > CPU_HISTORY_LEN) inst.cpuHistory.shift();
  }

  // ---- alert lifecycle ----

  private upsertAlert(inst: InternalInstance, severity: "critical" | "warning", title: string) {
    const existingId = this.alertByInstance.get(inst.id);
    const existing = existingId ? this.alerts.get(existingId) : undefined;
    if (existing && existing.state !== "resolved") {
      // escalating an already-alerting instance: bump severity/title, re-open if snoozed
      existing.severity = severity === "critical" ? "critical" : existing.severity;
      existing.title = title;
      existing.updatedAt = Date.now();
      if (existing.state === "snoozed") existing.state = "open";
      this.emit({ type: "alert:update", alert: { ...existing } });
      return;
    }
    const alert: Alert = {
      id: `alert-${inst.id}-${Date.now()}`,
      instanceId: inst.id,
      instanceName: inst.name,
      severity,
      title,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      state: "open",
    };
    this.alerts.set(alert.id, alert);
    this.alertByInstance.set(inst.id, alert.id);
    this.emit({ type: "alert:update", alert: { ...alert } });
  }

  private resolveAlertFor(inst: InternalInstance) {
    const alertId = this.alertByInstance.get(inst.id);
    const alert = alertId ? this.alerts.get(alertId) : undefined;
    if (alert && alert.state !== "resolved") {
      alert.state = "resolved";
      alert.updatedAt = Date.now();
      this.emit({ type: "alert:update", alert: { ...alert } });
    }
  }

  applyAlertAction(alertId: string, action: AlertAction, actor = "you") {
    const alert = this.alerts.get(alertId);
    if (!alert || alert.state === "resolved") return;
    if (action === "acknowledge") {
      alert.state = "acknowledged";
      alert.ackBy = actor;
    } else if (action === "resolve") {
      alert.state = "resolved";
    } else if (action === "snooze") {
      alert.state = "snoozed";
      alert.snoozedUntil = Date.now() + SNOOZE_MS;
    }
    alert.updatedAt = Date.now();
    this.emit({ type: "alert:update", alert: { ...alert } });
  }

  acknowledgeAlertForInstance(instanceId: string, actor = "you") {
    const alertId = this.alertByInstance.get(instanceId);
    if (alertId) this.applyAlertAction(alertId, "acknowledge", actor);
  }

  // ---- trace correlation ----

  private startTrace(inst: InternalInstance, scenarioId: string) {
    const traceId = `trace-${inst.id}-${Date.now().toString(36)}`;
    inst._activeTraceId = traceId;
    inst._activeScenarioId = scenarioId;
    const trace: Trace = {
      traceId,
      instanceId: inst.id,
      instanceName: inst.name,
      scenarioId,
      startedAt: Date.now(),
      spans: [],
    };
    this.traces.set(traceId, trace);
    if (this.traces.size > TRACE_CAP) {
      const oldest = this.traces.keys().next().value;
      if (oldest) this.traces.delete(oldest);
    }
    return trace;
  }

  private addSpan(inst: InternalInstance, label: string, severity: Severity) {
    if (!inst._activeTraceId) return;
    const trace = this.traces.get(inst._activeTraceId);
    if (!trace) return;
    trace.spans.push({ ts: Date.now(), label, severity, durationMs: Math.floor(randRange(200, 2200)) });
    this.emit({ type: "trace:update", trace: { ...trace, spans: [...trace.spans] } });
  }

  private endTrace(inst: InternalInstance) {
    if (!inst._activeTraceId) return;
    const trace = this.traces.get(inst._activeTraceId);
    if (trace && !trace.endedAt) {
      trace.endedAt = Date.now();
      this.emit({ type: "trace:update", trace: { ...trace, spans: [...trace.spans] } });
    }
    inst._activeTraceId = null;
    inst._activeScenarioId = null;
  }

  // ---- incident state machine ----

  private escalate(inst: InternalInstance, scenarioId: string) {
    const template = inst._persona.incidents.find((t) => t.scenarioId === scenarioId);
    const currentIdx = (STATUS_ORDER as readonly string[]).indexOf(inst.status);
    const nextIdx = Math.min(STATUS_ORDER.length - 1, (currentIdx === -1 ? 0 : currentIdx) + 1);
    const nextStatus: EscalatableStatus = STATUS_ORDER[nextIdx];

    if (inst.status === "healthy") {
      this.startTrace(inst, scenarioId);
    }
    inst.status = nextStatus;
    inst.lastIncidentAt = Date.now();
    inst._recoverAt = Date.now() + randRange(20000, 45000);

    if (inst.status === "critical" && template) {
      this.pushLog(this.makeLog(inst, template.severity, template.message, template.detail(this.strip(inst))));
      this.addSpan(inst, template.message, template.severity);
      this.upsertAlert(inst, template.severity === "critical" ? "critical" : "warning", template.message);
      this.emit({
        type: "timeline:event",
        instanceId: inst.id,
        event: { ts: Date.now(), label: template.message, severity: template.severity },
      });
    } else {
      const label = `Status escalated to ${inst.status.toUpperCase()}`;
      this.pushLog(this.makeLog(inst, "warning", `${inst.name} health degraded: CPU/memory pressure rising.`));
      this.addSpan(inst, label, "warning");
      this.upsertAlert(inst, "warning", `${inst.name} degraded to ${inst.status.toUpperCase()}`);
      this.emit({
        type: "timeline:event",
        instanceId: inst.id,
        event: { ts: Date.now(), label, severity: "warning" },
      });
    }
    this.emit({ type: "instance:update", instance: this.strip(inst) });
  }

  /** Public escalation entry point (used by triggerScenario and tests). */
  escalateById(instanceId: string, scenarioId: string) {
    const inst = this.instances.get(instanceId);
    if (inst) this.escalate(inst, scenarioId);
  }

  private finishRecovery(inst: InternalInstance, message: string) {
    inst.status = "healthy";
    inst._recoverAt = null;
    this.pushLog(this.makeLog(inst, "info", message));
    this.addSpan(inst, "Recovered to HEALTHY", "info");
    this.endTrace(inst);
    this.resolveAlertFor(inst);
    this.emit({
      type: "timeline:event",
      instanceId: inst.id,
      event: { ts: Date.now(), label: "Recovered to HEALTHY", severity: "info" },
    });
    this.emit({ type: "instance:update", instance: this.strip(inst) });
  }

  private recover(inst: InternalInstance) {
    this.finishRecovery(inst, `${inst.name} recovered. Metrics back within baseline.`);
  }

  /** Mock restart: drop into "deploying" for a few seconds, then come back healthy. */
  restartInstance(instanceId: string) {
    const inst = this.instances.get(instanceId);
    if (!inst || inst.status === "offline" || inst.status === "deploying") return;
    inst.status = "deploying";
    inst._recoverAt = null;
    inst._restartUntil = Date.now() + RESTART_DURATION_MS;
    inst.uptimeSec = 0;
    this.pushLog(this.makeLog(inst, "info", `${inst.name} restart initiated by operator.`));
    this.emit({
      type: "timeline:event",
      instanceId: inst.id,
      event: { ts: Date.now(), label: "Restart initiated", severity: "info" },
    });
    this.emit({ type: "instance:update", instance: this.strip(inst) });
  }

  triggerScenario(scenarioId: string, instanceId?: string) {
    if (scenarioId === "recover_all") {
      for (const inst of this.instances.values()) {
        if (inst.status !== "healthy" && inst.status !== "offline") this.recover(inst);
      }
      return;
    }
    let target: InternalInstance | undefined;
    if (instanceId) {
      target = this.instances.get(instanceId);
    } else {
      target = [...this.instances.values()].find((i) =>
        i._persona.incidents.some((t) => t.scenarioId === scenarioId)
      );
    }
    if (target) {
      const t = target;
      // force straight to escalation step thrice so demo trigger feels immediate
      this.escalate(t, scenarioId);
      setTimeout(() => this.escalate(t, scenarioId), 900);
      setTimeout(() => this.escalate(t, scenarioId), 1800);
    }
  }

  computeMetrics(): MetricsSnapshot {
    const list = [...this.instances.values()];
    const count = Math.max(1, list.length);
    const avgCpu = list.reduce((s, i) => s + i.cpu, 0) / count;
    const openAlerts = [...this.alerts.values()].filter(
      (a) => a.state === "open" || a.state === "acknowledged"
    ).length;
    const bandwidth = 3.5 + avgCpu / 100 + Math.sin(Date.now() / 5000) * 0.3;
    const p99 = 90 + avgCpu * 1.1 + openAlerts * 8;
    return {
      ts: Date.now(),
      bandwidthTbps: Math.round(bandwidth * 100) / 100,
      bandwidthDeltaPct: Math.round(randRange(-3, 12) * 10) / 10,
      avgCpuPct: Math.round(avgCpu),
      avgCpuDeltaPct: Math.round(randRange(-4, 6) * 10) / 10,
      p99LatencyMs: Math.round(p99),
      p99LatencyDeltaMs: Math.round(randRange(-15, 5)),
      activeAlerts: openAlerts,
      activeAlertsDeltaPct: Math.round(randRange(-15, 15) * 10) / 10,
      costUsd: Math.round((1180 + this.cpuSecondsAccum * COST_PER_CPU_SECOND * 100) * 100) / 100,
    };
  }
}
