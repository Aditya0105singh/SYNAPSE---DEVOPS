import { useCallback, useEffect, useRef } from "react";
import type { ClientMessage, ServerMessage } from "@synapse/shared";
import { useStore, emptyBatch, type IncomingBatch } from "../store/useStore";

// VITE_WS_URL lets a deployed client point at a remote server; default is same-origin (vite proxy in dev)
const WS_URL =
  (import.meta.env.VITE_WS_URL as string | undefined) ??
  `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`;

const MAX_RECONNECT_ATTEMPTS = 8;

// Module-level socket handle: exactly one component (App) owns the connection via
// useSocket(); every other component sends through sendClientMessage without
// risking a second connection.
let activeSocket: WebSocket | null = null;

export function sendClientMessage(msg: ClientMessage) {
  if (activeSocket && activeSocket.readyState === WebSocket.OPEN) {
    activeSocket.send(JSON.stringify(msg));
    return;
  }
  // REST fallback only exists for the demo trigger path
  if (msg.type === "trigger:incident") {
    fetch("/api/trigger", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scenarioId: msg.scenarioId, instanceId: msg.instanceId }),
    }).catch(() => {});
  }
}

export function switchOrg(orgId: string) {
  useStore.getState().setOrg(orgId);
  sendClientMessage({ type: "org:switch", orgId });
}

export function useSocket() {
  const rafRef = useRef<number | null>(null);
  const bufferRef = useRef<IncomingBatch>(emptyBatch());
  const eventCountRef = useRef(0);
  const reconnectAttemptRef = useRef(0);
  const cancelledRef = useRef(false);
  // held in a ref so retry() and the reconnect timer can re-invoke connect without
  // the useCallback closure referencing itself before its own declaration
  const connectRef = useRef<() => void>(() => {});

  const connect = useCallback(() => {
    if (cancelledRef.current) return;
    useStore.getState().setConnStatus(reconnectAttemptRef.current > 0 ? "reconnecting" : "connecting");
    const socket = new WebSocket(WS_URL);
    activeSocket = socket;

    socket.onopen = () => {
      reconnectAttemptRef.current = 0;
    };

    socket.onmessage = (ev) => {
      eventCountRef.current++;
      let msg: ServerMessage;
      try {
        msg = JSON.parse(ev.data as string) as ServerMessage;
      } catch {
        console.warn("[synapse] dropped malformed server message");
        return;
      }
      try {
        switch (msg.type) {
          case "hydrate":
            bufferRef.current = emptyBatch(); // drop deltas buffered for the previous org/session
            useStore.getState().hydrate(msg);
            break;
          case "instance:update":
            bufferRef.current.instances.push(msg.instance);
            break;
          case "log:event":
            bufferRef.current.logs.push(msg.log);
            break;
          case "metrics:update":
            bufferRef.current.metrics = msg.metrics;
            break;
          case "timeline:event":
            bufferRef.current.timelineEvents.push({ instanceId: msg.instanceId, event: msg.event });
            break;
          case "alert:update":
            bufferRef.current.alerts.push(msg.alert);
            break;
          case "trace:update":
            bufferRef.current.traces.push(msg.trace);
            break;
        }
      } catch (err) {
        console.warn("[synapse] failed to apply server message", err);
      }
    };

    socket.onclose = () => {
      if (cancelledRef.current) return;
      reconnectAttemptRef.current++;
      if (reconnectAttemptRef.current > MAX_RECONNECT_ATTEMPTS) {
        useStore.getState().setConnStatus("closed");
        return;
      }
      useStore.getState().setConnStatus("reconnecting");
      const delay = Math.min(5000, 500 * 2 ** Math.min(4, reconnectAttemptRef.current));
      setTimeout(() => connectRef.current(), delay);
    };

    socket.onerror = () => {
      socket.close();
    };
  }, []);

  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  useEffect(() => {
    cancelledRef.current = false;

    const doFlush = () => {
      const buf = bufferRef.current;
      if (
        buf.instances.length ||
        buf.logs.length ||
        buf.metrics ||
        buf.timelineEvents.length ||
        buf.alerts.length ||
        buf.traces.length
      ) {
        useStore.getState().applyBatch(buf);
        bufferRef.current = emptyBatch();
      }
    };

    // flush the incoming buffer into the store at most once per animation frame...
    const flush = () => {
      rafRef.current = requestAnimationFrame(flush);
      doFlush();
    };
    rafRef.current = requestAnimationFrame(flush);
    // ...with an interval backstop: browsers suspend rAF in backgrounded/occluded
    // tabs, and without this the buffer would grow unbounded while hidden
    const backstopTimer = setInterval(doFlush, 500);

    const epsTimer = setInterval(() => {
      useStore.getState().setEventsPerSec(eventCountRef.current);
      eventCountRef.current = 0;
    }, 1000);

    connect();

    return () => {
      cancelledRef.current = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      clearInterval(epsTimer);
      clearInterval(backstopTimer);
      activeSocket?.close();
      activeSocket = null;
    };
  }, [connect]);

  const retry = useCallback(() => {
    reconnectAttemptRef.current = 0;
    connect();
  }, [connect]);

  return { retry };
}
