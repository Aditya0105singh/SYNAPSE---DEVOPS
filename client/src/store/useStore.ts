import { create } from "zustand";
import type {
  Alert,
  InstanceState,
  LogEvent,
  MetricsSnapshot,
  Severity,
  Trace,
  TimelineEvent,
} from "@synapse/shared";
import { ORGS } from "@synapse/shared";

export const LOG_CAP = 5000;
const METRICS_HISTORY_CAP = 300;

export type ConnStatus = "connecting" | "open" | "reconnecting" | "closed";

export type View =
  | "overview"
  | "issues"
  | "performance"
  | "alerts"
  | "logstream"
  | "traces"
  | "compute"
  | "databases"
  | "network";

export type SortKey = "name" | "status" | "cpu" | "memory" | "uptime";
export type HudRange = "1H" | "24H" | "1W" | "1M";

export interface IncomingBatch {
  instances: InstanceState[];
  logs: LogEvent[];
  metrics: MetricsSnapshot | null;
  timelineEvents: { instanceId: string; event: TimelineEvent }[];
  alerts: Alert[];
  traces: Trace[];
}

export const emptyBatch = (): IncomingBatch => ({
  instances: [],
  logs: [],
  metrics: null,
  timelineEvents: [],
  alerts: [],
  traces: [],
});

interface StoreState {
  connStatus: ConnStatus;
  view: View;
  orgId: string;
  instances: Map<string, InstanceState>;
  logs: LogEvent[];
  logsPaused: boolean;
  pendingLogCount: number;
  metrics: MetricsSnapshot | null;
  metricsHistory: MetricsSnapshot[];
  alerts: Map<string, Alert>;
  traces: Map<string, Trace>;
  timelines: Map<string, TimelineEvent[]>;
  signalOverNoise: boolean;
  instanceFilter: string;
  logFilter: string;
  severityFilter: Record<Severity, boolean>;
  logNotes: Map<string, string>;
  selectedInstanceId: string | null;
  flashIds: Set<string>;
  eventsPerSec: number;
  sortKey: SortKey;
  sortDir: "asc" | "desc";
  hudRange: HudRange;
  theme: "dark" | "light";
  liveAnnouncement: string;

  setConnStatus: (s: ConnStatus) => void;
  setView: (v: View) => void;
  setOrg: (orgId: string) => void;
  applyBatch: (batch: IncomingBatch) => void;
  hydrate: (payload: {
    orgId: string;
    instances: InstanceState[];
    logs: LogEvent[];
    metrics: MetricsSnapshot;
    metricsHistory: MetricsSnapshot[];
    alerts: Alert[];
    traces: Trace[];
  }) => void;
  toggleSignalOverNoise: () => void;
  setInstanceFilter: (v: string) => void;
  setLogFilter: (v: string) => void;
  toggleSeverity: (sev: Severity) => void;
  setLogNote: (logId: string, note: string) => void;
  toggleLogsPaused: () => void;
  clearLogs: () => void;
  selectInstance: (id: string | null) => void;
  setEventsPerSec: (n: number) => void;
  setSort: (key: SortKey) => void;
  setHudRange: (r: HudRange) => void;
  toggleTheme: () => void;
}

export const useStore = create<StoreState>((set) => ({
  connStatus: "connecting",
  view: "issues",
  orgId: ORGS[0].id,
  instances: new Map(),
  logs: [],
  logsPaused: false,
  pendingLogCount: 0,
  metrics: null,
  metricsHistory: [],
  alerts: new Map(),
  traces: new Map(),
  timelines: new Map(),
  signalOverNoise: false,
  instanceFilter: "",
  logFilter: "",
  severityFilter: { critical: true, warning: true, info: true, debug: true },
  logNotes: new Map(),
  selectedInstanceId: null,
  flashIds: new Set(),
  eventsPerSec: 0,
  sortKey: "status",
  sortDir: "asc",
  hudRange: "1H",
  theme: typeof document !== "undefined" && !document.documentElement.classList.contains("dark") ? "light" : "dark",
  liveAnnouncement: "",

  setConnStatus: (s) => set({ connStatus: s }),
  setView: (v) => set({ view: v }),

  setOrg: (orgId) =>
    set({
      orgId,
      // clear org-scoped state; the hydrate that follows the org:switch repopulates it
      instances: new Map(),
      logs: [],
      pendingLogCount: 0,
      metrics: null,
      metricsHistory: [],
      alerts: new Map(),
      traces: new Map(),
      timelines: new Map(),
      selectedInstanceId: null,
    }),

  hydrate: (payload) =>
    set(() => {
      const instances = new Map<string, InstanceState>();
      for (const i of payload.instances) instances.set(i.id, i);
      const alerts = new Map<string, Alert>();
      for (const a of payload.alerts) alerts.set(a.id, a);
      const traces = new Map<string, Trace>();
      for (const t of payload.traces) traces.set(t.traceId, t);
      return {
        orgId: payload.orgId,
        instances,
        alerts,
        traces,
        logs: payload.logs.slice(-LOG_CAP),
        metrics: payload.metrics,
        metricsHistory: payload.metricsHistory.slice(-METRICS_HISTORY_CAP),
        connStatus: "open" as const,
      };
    }),

  applyBatch: (batch) =>
    set((state) => {
      let instances = state.instances;
      const flashIds = new Set<string>();
      if (batch.instances.length) {
        instances = new Map(state.instances);
        for (const inst of batch.instances) {
          const prev = instances.get(inst.id);
          if (prev && prev.status !== inst.status) flashIds.add(inst.id);
          instances.set(inst.id, inst);
        }
      }

      let logs = state.logs;
      let pendingLogCount = state.pendingLogCount;
      if (batch.logs.length) {
        if (state.logsPaused) {
          pendingLogCount += batch.logs.length;
        } else {
          logs = [...state.logs, ...batch.logs];
          if (logs.length > LOG_CAP) logs = logs.slice(logs.length - LOG_CAP);
        }
      }

      let timelines = state.timelines;
      if (batch.timelineEvents.length) {
        timelines = new Map(state.timelines);
        for (const { instanceId, event } of batch.timelineEvents) {
          const arr = timelines.get(instanceId) ?? [];
          timelines.set(instanceId, [...arr, event].slice(-20));
        }
      }

      let alerts = state.alerts;
      let liveAnnouncement = state.liveAnnouncement;
      if (batch.alerts.length) {
        alerts = new Map(state.alerts);
        for (const a of batch.alerts) {
          const prev = alerts.get(a.id);
          alerts.set(a.id, a);
          const becameCritical = a.severity === "critical" && (!prev || prev.severity !== "critical");
          if (becameCritical && a.state === "open") {
            liveAnnouncement = `Critical alert: ${a.title}`;
          }
        }
      }

      let traces = state.traces;
      if (batch.traces.length) {
        traces = new Map(state.traces);
        for (const t of batch.traces) traces.set(t.traceId, t);
      }

      let metricsHistory = state.metricsHistory;
      if (batch.metrics) {
        metricsHistory = [...state.metricsHistory, batch.metrics];
        if (metricsHistory.length > METRICS_HISTORY_CAP) {
          metricsHistory = metricsHistory.slice(metricsHistory.length - METRICS_HISTORY_CAP);
        }
      }

      return {
        instances,
        logs,
        pendingLogCount,
        timelines,
        alerts,
        traces,
        metrics: batch.metrics ?? state.metrics,
        metricsHistory,
        flashIds,
        liveAnnouncement,
      };
    }),

  toggleSignalOverNoise: () => set((s) => ({ signalOverNoise: !s.signalOverNoise })),
  setInstanceFilter: (v) => set({ instanceFilter: v }),
  setLogFilter: (v) => set({ logFilter: v }),
  toggleSeverity: (sev) =>
    set((s) => ({ severityFilter: { ...s.severityFilter, [sev]: !s.severityFilter[sev] } })),
  setLogNote: (logId, note) =>
    set((s) => {
      const logNotes = new Map(s.logNotes);
      if (note.trim()) logNotes.set(logId, note.trim());
      else logNotes.delete(logId);
      return { logNotes };
    }),
  toggleLogsPaused: () =>
    set((s) => ({ logsPaused: !s.logsPaused, pendingLogCount: s.logsPaused ? 0 : s.pendingLogCount })),
  clearLogs: () => set({ logs: [], pendingLogCount: 0 }),
  selectInstance: (id) => set({ selectedInstanceId: id }),
  setEventsPerSec: (n) => set({ eventsPerSec: n }),
  setSort: (key) =>
    set((s) =>
      s.sortKey === key ? { sortDir: s.sortDir === "asc" ? "desc" : "asc" } : { sortKey: key, sortDir: "asc" }
    ),
  setHudRange: (r) => set({ hudRange: r }),
  toggleTheme: () =>
    set((s) => {
      const theme = s.theme === "dark" ? "light" : "dark";
      document.documentElement.classList.toggle("dark", theme === "dark");
      localStorage.setItem("synapse-theme", theme);
      return { theme };
    }),
}));
