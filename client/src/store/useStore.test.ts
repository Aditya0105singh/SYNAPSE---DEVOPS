import { describe, it, expect, beforeEach } from "vitest";
import type { InstanceState, LogEvent, MetricsSnapshot } from "@synapse/shared";
import { useStore, emptyBatch, LOG_CAP } from "./useStore";

function makeInstance(id: string, status: InstanceState["status"] = "healthy"): InstanceState {
  return {
    id,
    name: id.toUpperCase(),
    ip: "10.0.0.1",
    persona: "ml",
    category: "compute",
    status,
    cpu: 50,
    cpuHistory: [],
    memoryGb: 4,
    memoryCapGb: 8,
    uptimeSec: 100,
    lastIncidentAt: null,
  };
}

function makeLog(id: string): LogEvent {
  return {
    id,
    ts: Date.now(),
    instanceId: "a",
    instanceName: "A",
    severity: "debug",
    message: `log ${id}`,
  };
}

const metrics: MetricsSnapshot = {
  ts: Date.now(),
  bandwidthTbps: 4,
  bandwidthDeltaPct: 1,
  avgCpuPct: 40,
  avgCpuDeltaPct: 1,
  p99LatencyMs: 100,
  p99LatencyDeltaMs: 1,
  activeAlerts: 0,
  activeAlertsDeltaPct: 0,
  costUsd: 1200,
};

function hydrateEmpty() {
  useStore.getState().hydrate({
    orgId: "sparkpixel",
    instances: [],
    logs: [],
    metrics,
    metricsHistory: [],
    alerts: [],
    traces: [],
  });
}

describe("useStore", () => {
  beforeEach(() => {
    hydrateEmpty();
    useStore.setState({
      logsPaused: false,
      pendingLogCount: 0,
      logNotes: new Map(),
      severityFilter: { critical: true, warning: true, info: true, debug: true },
    });
  });

  it("hydrate replaces org-scoped state and marks the connection open", () => {
    useStore.getState().hydrate({
      orgId: "helios",
      instances: [makeInstance("a"), makeInstance("b", "critical")],
      logs: [makeLog("l1")],
      metrics,
      metricsHistory: [metrics],
      alerts: [],
      traces: [],
    });
    const s = useStore.getState();
    expect(s.orgId).toBe("helios");
    expect(s.instances.size).toBe(2);
    expect(s.logs.length).toBe(1);
    expect(s.connStatus).toBe("open");
  });

  it("applyBatch appends logs while running", () => {
    const batch = emptyBatch();
    batch.logs = [makeLog("l1"), makeLog("l2")];
    useStore.getState().applyBatch(batch);
    expect(useStore.getState().logs.length).toBe(2);
    expect(useStore.getState().pendingLogCount).toBe(0);
  });

  it("respects pause: buffered count grows, rendered logs do not", () => {
    useStore.getState().toggleLogsPaused();
    const batch = emptyBatch();
    batch.logs = [makeLog("l1"), makeLog("l2"), makeLog("l3")];
    useStore.getState().applyBatch(batch);
    expect(useStore.getState().logs.length).toBe(0);
    expect(useStore.getState().pendingLogCount).toBe(3);
    // resuming clears the pending counter
    useStore.getState().toggleLogsPaused();
    expect(useStore.getState().pendingLogCount).toBe(0);
  });

  it("enforces LOG_CAP even for oversized batches", () => {
    const batch = emptyBatch();
    batch.logs = Array.from({ length: LOG_CAP + 500 }, (_, i) => makeLog(`l${i}`));
    useStore.getState().applyBatch(batch);
    expect(useStore.getState().logs.length).toBe(LOG_CAP);
    // oldest entries were dropped, newest kept
    expect(useStore.getState().logs[LOG_CAP - 1].id).toBe(`l${LOG_CAP + 499}`);
  });

  it("flags status changes for row flash animation", () => {
    const batch1 = emptyBatch();
    batch1.instances = [makeInstance("a", "healthy")];
    useStore.getState().applyBatch(batch1);

    const batch2 = emptyBatch();
    batch2.instances = [makeInstance("a", "critical")];
    useStore.getState().applyBatch(batch2);
    expect(useStore.getState().flashIds.has("a")).toBe(true);

    const batch3 = emptyBatch();
    batch3.instances = [makeInstance("a", "critical")];
    useStore.getState().applyBatch(batch3);
    expect(useStore.getState().flashIds.has("a")).toBe(false);
  });

  it("sets a live announcement only for new open critical alerts", () => {
    const batch = emptyBatch();
    batch.alerts = [
      {
        id: "al1",
        instanceId: "a",
        instanceName: "A",
        severity: "critical",
        title: "CUDA OOM",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        state: "open",
      },
    ];
    useStore.getState().applyBatch(batch);
    expect(useStore.getState().liveAnnouncement).toContain("CUDA OOM");
  });

  it("toggleSeverity flips a single severity", () => {
    useStore.getState().toggleSeverity("debug");
    expect(useStore.getState().severityFilter.debug).toBe(false);
    expect(useStore.getState().severityFilter.critical).toBe(true);
  });

  it("setSort toggles direction on repeated key, resets on new key", () => {
    useStore.getState().setSort("cpu");
    expect(useStore.getState().sortKey).toBe("cpu");
    expect(useStore.getState().sortDir).toBe("asc");
    useStore.getState().setSort("cpu");
    expect(useStore.getState().sortDir).toBe("desc");
    useStore.getState().setSort("name");
    expect(useStore.getState().sortDir).toBe("asc");
  });

  it("log notes can be set and removed", () => {
    useStore.getState().setLogNote("l1", "check the deploy");
    expect(useStore.getState().logNotes.get("l1")).toBe("check the deploy");
    useStore.getState().setLogNote("l1", "   ");
    expect(useStore.getState().logNotes.has("l1")).toBe(false);
  });
});
