import { createServer } from "node:http";
import express from "express";
import cors from "cors";
import { WebSocketServer, WebSocket } from "ws";
import type { ClientMessage } from "@synapse/shared";
import { INCIDENT_SCENARIOS, ORGS } from "@synapse/shared";
import { IncidentEngine } from "./engine.js";

const PORT = Number(process.env.PORT ?? 4000);
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN ?? "http://localhost:5173";

const VALID_SCENARIO_IDS = new Set(INCIDENT_SCENARIOS.map((s) => s.id));
const VALID_ORG_IDS = new Set(ORGS.map((o) => o.id));

// one engine per mock org, all running — org switching is a per-socket subscription
const engines = new Map<string, IncidentEngine>();
for (const org of ORGS) {
  const engine = new IncidentEngine(org.id);
  engine.start();
  engines.set(org.id, engine);
}
const defaultEngine = engines.get(ORGS[0].id)!;

// ---- simple in-memory token bucket per IP for the REST trigger ----
const RATE_LIMIT = { capacity: 10, refillPerSec: 10 / 60 }; // 10 requests/minute
const buckets = new Map<string, { tokens: number; last: number }>();

function allowRequest(ip: string): boolean {
  const now = Date.now();
  const bucket = buckets.get(ip) ?? { tokens: RATE_LIMIT.capacity, last: now };
  bucket.tokens = Math.min(RATE_LIMIT.capacity, bucket.tokens + ((now - bucket.last) / 1000) * RATE_LIMIT.refillPerSec);
  bucket.last = now;
  if (bucket.tokens < 1) {
    buckets.set(ip, bucket);
    return false;
  }
  bucket.tokens -= 1;
  buckets.set(ip, bucket);
  return true;
}

const app = express();
app.use(cors({ origin: CLIENT_ORIGIN }));
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));

// debug snapshot of an org's engine (statuses + alert states), handy for demos and troubleshooting
app.get("/api/state/:orgId", (req, res) => {
  const engine = engines.get(req.params.orgId);
  if (!engine) return res.status(404).json({ error: "unknown org" });
  res.json({
    instances: engine.getInstanceIds().map((id) => {
      const inst = engine.getInstance(id)!;
      return { id, status: inst.status, cpu: Math.round(inst.cpu) };
    }),
    alerts: engine.getAlerts().map((a) => ({ id: a.id, state: a.state, severity: a.severity })),
  });
});
app.get("/api/scenarios", (_req, res) => res.json(INCIDENT_SCENARIOS));

app.post("/api/trigger", (req, res) => {
  if (!allowRequest(req.ip ?? "unknown")) {
    return res.status(429).json({ error: "rate limit exceeded (10/min)" });
  }
  const { scenarioId, instanceId, orgId } = req.body ?? {};
  if (typeof scenarioId !== "string" || !VALID_SCENARIO_IDS.has(scenarioId)) {
    return res.status(400).json({ error: "unknown scenarioId" });
  }
  const engine = typeof orgId === "string" && engines.has(orgId) ? engines.get(orgId)! : defaultEngine;
  engine.triggerScenario(scenarioId, typeof instanceId === "string" ? instanceId : undefined);
  res.json({ ok: true });
});

const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

wss.on("connection", (socket: WebSocket) => {
  let currentOrg = ORGS[0].id;
  let unsubscribe: () => void = () => {};

  const subscribe = (orgId: string) => {
    unsubscribe();
    currentOrg = orgId;
    const engine = engines.get(orgId)!;
    socket.send(JSON.stringify(engine.hydratePayload()));
    const dispose = engine.onMessage((msg) => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(msg));
      }
    });
    unsubscribe = () => dispose();
  };

  subscribe(currentOrg);

  socket.on("message", (raw) => {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(raw.toString()) as ClientMessage;
    } catch {
      return; // ignore malformed client messages
    }
    const engine = engines.get(currentOrg)!;
    switch (msg.type) {
      case "trigger:incident":
        if (typeof msg.scenarioId === "string" && VALID_SCENARIO_IDS.has(msg.scenarioId)) {
          engine.triggerScenario(msg.scenarioId, typeof msg.instanceId === "string" ? msg.instanceId : undefined);
        }
        break;
      case "trigger:stress":
        engine.startStressTest();
        break;
      case "alert:action":
        if (typeof msg.alertId === "string") {
          engine.applyAlertAction(msg.alertId, msg.action, typeof msg.actor === "string" ? msg.actor : undefined);
        }
        break;
      case "instance:restart":
        if (typeof msg.instanceId === "string") {
          engine.restartInstance(msg.instanceId);
        }
        break;
      case "org:switch":
        if (typeof msg.orgId === "string" && VALID_ORG_IDS.has(msg.orgId)) {
          subscribe(msg.orgId);
        }
        break;
    }
  });

  socket.on("close", () => unsubscribe());
});

httpServer.listen(PORT, () => {
  console.log(
    `[synapse-server] listening on http://localhost:${PORT} (ws path /ws, cors origin ${CLIENT_ORIGIN}, orgs: ${[...engines.keys()].join(", ")})`
  );
});
