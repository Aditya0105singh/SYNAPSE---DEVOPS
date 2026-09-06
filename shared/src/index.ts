export type Severity = "critical" | "warning" | "info" | "debug";

export type InstanceStatus = "healthy" | "medium" | "high" | "critical" | "offline" | "deploying";

export type InstanceCategory = "compute" | "database" | "network";

export interface CpuSample {
  t: number;
  v: number;
}

export interface InstanceState {
  id: string;
  name: string;
  ip: string;
  persona: string;
  category: InstanceCategory;
  status: InstanceStatus;
  cpu: number;
  cpuHistory: CpuSample[];
  memoryGb: number;
  memoryCapGb: number;
  uptimeSec: number;
  lastIncidentAt: number | null;
}

export interface LogEvent {
  id: string;
  ts: number;
  instanceId: string;
  instanceName: string;
  severity: Severity;
  message: string;
  detail?: Record<string, unknown>;
  traceId?: string;
}

export interface MetricsSnapshot {
  ts: number;
  bandwidthTbps: number;
  bandwidthDeltaPct: number;
  avgCpuPct: number;
  avgCpuDeltaPct: number;
  p99LatencyMs: number;
  p99LatencyDeltaMs: number;
  activeAlerts: number;
  activeAlertsDeltaPct: number;
  costUsd: number;
}

export interface TimelineEvent {
  ts: number;
  label: string;
  severity: Severity;
}

export type AlertState = "open" | "acknowledged" | "snoozed" | "resolved";

export interface Alert {
  id: string;
  instanceId: string;
  instanceName: string;
  severity: "critical" | "warning";
  title: string;
  createdAt: number;
  updatedAt: number;
  state: AlertState;
  ackBy?: string;
  snoozedUntil?: number;
}

export interface TraceSpan {
  ts: number;
  label: string;
  severity: Severity;
  durationMs: number;
}

export interface Trace {
  traceId: string;
  instanceId: string;
  instanceName: string;
  scenarioId: string;
  startedAt: number;
  endedAt?: number;
  spans: TraceSpan[];
}

export interface Org {
  id: string;
  name: string;
}

export const ORGS: Org[] = [
  { id: "sparkpixel", name: "SPARKPIXEL" },
  { id: "novatrace", name: "NOVATRACE AI" },
  { id: "helios", name: "HELIOS LABS" },
];

/** Server -> client */
export type ServerMessage =
  | {
      type: "hydrate";
      orgId: string;
      instances: InstanceState[];
      logs: LogEvent[];
      metrics: MetricsSnapshot;
      metricsHistory: MetricsSnapshot[];
      alerts: Alert[];
      traces: Trace[];
    }
  | { type: "instance:update"; instance: InstanceState }
  | { type: "log:event"; log: LogEvent }
  | { type: "metrics:update"; metrics: MetricsSnapshot }
  | { type: "timeline:event"; instanceId: string; event: TimelineEvent }
  | { type: "alert:update"; alert: Alert }
  | { type: "trace:update"; trace: Trace };

export type AlertAction = "acknowledge" | "resolve" | "snooze";

/** Client -> server */
export type ClientMessage =
  | { type: "trigger:incident"; scenarioId: string; instanceId?: string }
  | { type: "trigger:stress" }
  | { type: "alert:action"; alertId: string; action: AlertAction; actor?: string }
  | { type: "instance:restart"; instanceId: string }
  | { type: "org:switch"; orgId: string };

export interface IncidentScenario {
  id: string;
  label: string;
  personas: string[];
}

export const INCIDENT_SCENARIOS: IncidentScenario[] = [
  { id: "cuda_oom", label: "Trigger CUDA OOM", personas: ["ml"] },
  { id: "deploy_failure", label: "Fail a deployment", personas: ["payment"] },
  { id: "cache_exhaustion", label: "Exhaust Redis connections", personas: ["cache"] },
  { id: "traffic_spike", label: "Simulate traffic spike", personas: ["gateway"] },
  { id: "disk_pressure", label: "Disk pressure warning", personas: ["db"] },
  { id: "recover_all", label: "Recover all instances", personas: ["*"] },
];
