import { describe, it, expect, beforeEach } from "vitest";
import type { ServerMessage } from "@synapse/shared";
import { IncidentEngine } from "./engine.js";

describe("IncidentEngine", () => {
  let engine: IncidentEngine;
  let messages: ServerMessage[];

  beforeEach(() => {
    engine = new IncidentEngine("sparkpixel");
    messages = [];
    engine.onMessage((m) => messages.push(m));
  });

  function firstInstanceWithIncidents(): string {
    // ml persona always has the cuda_oom template in the sparkpixel fleet
    const id = engine.getInstanceIds().find((i) => i.includes("-ml-"));
    expect(id).toBeDefined();
    return id!;
  }

  it("seeds the sparkpixel fleet with healthy instances", () => {
    const ids = engine.getInstanceIds();
    expect(ids.length).toBe(7);
    for (const id of ids) {
      expect(engine.getInstance(id)?.status).toBe("healthy");
    }
  });

  it("escalates through the status order healthy → medium → high → critical", () => {
    const id = firstInstanceWithIncidents();
    engine.escalateById(id, "cuda_oom");
    expect(engine.getInstance(id)?.status).toBe("medium");
    engine.escalateById(id, "cuda_oom");
    expect(engine.getInstance(id)?.status).toBe("high");
    engine.escalateById(id, "cuda_oom");
    expect(engine.getInstance(id)?.status).toBe("critical");
    // stays capped at critical
    engine.escalateById(id, "cuda_oom");
    expect(engine.getInstance(id)?.status).toBe("critical");
  });

  it("opens an alert on escalation and resolves it via recover_all", () => {
    const id = firstInstanceWithIncidents();
    engine.escalateById(id, "cuda_oom");
    const open = engine.getAlerts().filter((a) => a.instanceId === id && a.state === "open");
    expect(open.length).toBe(1);

    engine.triggerScenario("recover_all");
    expect(engine.getInstance(id)?.status).toBe("healthy");
    const resolved = engine.getAlerts().filter((a) => a.instanceId === id);
    expect(resolved.every((a) => a.state === "resolved")).toBe(true);
  });

  it("applies the alert lifecycle actions", () => {
    const id = firstInstanceWithIncidents();
    engine.escalateById(id, "cuda_oom");
    const alert = engine.getAlerts().find((a) => a.instanceId === id)!;

    engine.applyAlertAction(alert.id, "acknowledge", "test-operator");
    expect(engine.getAlerts().find((a) => a.id === alert.id)?.state).toBe("acknowledged");
    expect(engine.getAlerts().find((a) => a.id === alert.id)?.ackBy).toBe("test-operator");

    engine.applyAlertAction(alert.id, "snooze");
    expect(engine.getAlerts().find((a) => a.id === alert.id)?.state).toBe("snoozed");

    engine.applyAlertAction(alert.id, "resolve");
    expect(engine.getAlerts().find((a) => a.id === alert.id)?.state).toBe("resolved");

    // actions on resolved alerts are no-ops
    engine.applyAlertAction(alert.id, "acknowledge");
    expect(engine.getAlerts().find((a) => a.id === alert.id)?.state).toBe("resolved");
  });

  it("starts a trace on first escalation and closes it on recovery", () => {
    const id = firstInstanceWithIncidents();
    engine.escalateById(id, "cuda_oom");
    const active = engine.getTraces().filter((t) => t.instanceId === id && !t.endedAt);
    expect(active.length).toBe(1);
    expect(active[0].spans.length).toBeGreaterThan(0);

    engine.triggerScenario("recover_all");
    const traces = engine.getTraces().filter((t) => t.instanceId === id);
    expect(traces.every((t) => t.endedAt !== undefined)).toBe(true);
  });

  it("emits a correlated critical log + timeline event when reaching critical", () => {
    const id = firstInstanceWithIncidents();
    engine.escalateById(id, "cuda_oom");
    engine.escalateById(id, "cuda_oom");
    engine.escalateById(id, "cuda_oom"); // → critical

    const logs = messages.filter(
      (m): m is Extract<ServerMessage, { type: "log:event" }> => m.type === "log:event"
    );
    const criticalLog = logs.find((m) => m.log.instanceId === id && m.log.severity === "critical");
    expect(criticalLog).toBeDefined();
    expect(criticalLog!.log.message).toContain("CUDA");
    expect(criticalLog!.log.traceId).toBeDefined();

    const timeline = messages.filter((m) => m.type === "timeline:event" && m.instanceId === id);
    expect(timeline.length).toBeGreaterThanOrEqual(3);
  });

  it("restart puts the instance into deploying and resets uptime", () => {
    const id = firstInstanceWithIncidents();
    engine.restartInstance(id);
    const inst = engine.getInstance(id)!;
    expect(inst.status).toBe("deploying");
    expect(inst.uptimeSec).toBe(0);
  });

  it("computes metrics without NaN and counts only unresolved alerts", () => {
    const metrics = engine.computeMetrics();
    expect(Number.isFinite(metrics.avgCpuPct)).toBe(true);
    expect(Number.isFinite(metrics.p99LatencyMs)).toBe(true);
    expect(Number.isFinite(metrics.costUsd)).toBe(true);
    expect(metrics.activeAlerts).toBe(0);

    const id = firstInstanceWithIncidents();
    engine.escalateById(id, "cuda_oom");
    expect(engine.computeMetrics().activeAlerts).toBe(1);

    engine.triggerScenario("recover_all");
    expect(engine.computeMetrics().activeAlerts).toBe(0);
  });

  it("different orgs seed different fleet sizes", () => {
    const novatrace = new IncidentEngine("novatrace");
    const helios = new IncidentEngine("helios");
    expect(novatrace.getInstanceIds().length).toBe(5);
    expect(helios.getInstanceIds().length).toBe(9);
  });
});
