# Synapse — Incident Command Center

A real-time DevOps observability dashboard: a mock incident engine streams server-health events,
structured error logs, alerts, and traces over WebSocket to a high-density React dashboard that stays
smooth under thousands of log events.

> Portfolio project: the *infrastructure being monitored* is simulated, but everything else — the
> transport, state management, virtualization, alert lifecycle, and rendering pipeline — is real and
> engineered the way a production observability frontend would be.

## Architecture

```
┌────────────────────────────┐        WebSocket (/ws)         ┌─────────────────────────────┐
│  server/ (Node + Express)  │  ─────────────────────────────▶│  client/ (React 18 + Vite)  │
│                            │   hydrate → typed deltas        │                             │
│  IncidentEngine ×3 orgs    │   instance:update / log:event   │  useSocket (1 connection)   │
│  · persona state machines  │   metrics:update / alert:update │    ↓ buffer                 │
│  · alert lifecycle         │   trace:update / timeline:event │  rAF flush → Zustand store  │
│  · trace correlation       │◀─────────────────────────────   │    ↓ narrow selectors       │
│  · 300-sample history      │   trigger / ack / restart /     │  virtualized table + logs   │
│  · stress/burst mode       │   org:switch                    │  (TanStack Virtual)         │
└────────────────────────────┘                                 └─────────────────────────────┘
              shared/ — single source of truth for all wire-protocol TypeScript types
```

## Run it

```bash
npm install
npm run dev        # server on :4000, client on :5173 (vite proxies /ws + /api)
```

Then open http://localhost:5173. Useful scripts:

| Script | What it does |
|---|---|
| `npm run dev` | Both processes with prefixed output |
| `npm run test` | Vitest: engine state machine + store + component tests |
| `npm run typecheck` | `tsc --noEmit` on server and client (strict mode) |
| `npm run lint` | ESLint (typescript-eslint + react-hooks) |
| `npm run build` | Production client bundle (`server` runs via tsx) |

**Demo controls:** `Ctrl+Shift+D` opens the demo panel (fire scripted incidents on any instance,
run a 25 logs/sec stress test). `⌘K`/`Ctrl+K` opens the command palette — the whole app is drivable
from the keyboard.

## Design decisions (the "why")

**Why batch WebSocket messages on requestAnimationFrame?**
The server can emit dozens of messages between two frames (especially in stress mode). Applying each
message to the store individually would trigger that many React render passes. Instead, `useSocket`
pushes parsed messages into a plain mutable buffer and flushes it into Zustand at most once per
animation frame — the UI can never render more often than the display refreshes, no matter the
event rate. Backpressure costs one array push per message.

**Why Zustand with narrow selectors instead of Context/Redux?**
Each `InstanceRow` subscribes to exactly its own instance (`s.instances.get(id)`), each HUD tile to
one metric slice. When one instance escalates, only that row re-renders — the other rows, the log
list, and the sidebar don't. Context would re-render every consumer; Redux adds the same capability
with far more ceremony. Selectors deliberately return primitives or stable references so Zustand's
equality check can skip re-renders.

**Why TanStack Virtual for the log viewer and table?**
The log buffer holds up to 5,000 entries (a deliberate ring-buffer cap — memory stays bounded no
matter how long the dashboard runs). Only the ~30 rows in the viewport exist in the DOM; scroll
position is simulated with a translated inner container. The perf readout (gauge icon, top bar)
shows live FPS / events-per-sec / DOM-node counts so the claim is verifiable on screen.

**Why a persona-driven mock engine instead of random noise?**
Random data looks fake. Each instance has a persona (an ML inference node fails with CUDA OOM, the
payment processor fails deploys, Redis exhausts its connection pool) and a health state machine
(`healthy → medium → high → critical → recovered`). Escalations emit *correlated* artifacts: a
structured JSON error log, a timeline event, an alert, and trace spans that share a `traceId` — so
the incident reads coherently across every panel, like a real root cause.

**Why is alert state server-side?**
Acknowledge/resolve/snooze mutate the engine's in-memory alert map and broadcast `alert:update` to
every connected client. Open two tabs, ack in one, watch the other update — the server is the source
of truth, exactly as a real incident tool must behave (client-side ack state would silently desync).

**Honest demo scaling:** the HUD's 24H/1W/1M tabs aggregate progressively larger windows of the real
300-sample history buffer (avg + first-half/second-half delta). With minutes of uptime there is no
genuine week of data; the windows are demo-scaled, but the numbers are always derived from stored
samples, never invented at render time.

## Features

- **Issues** — virtualized instance table (sortable columns, signal-over-noise filter, per-row action
  menu: details / logs / acknowledge / restart / copy IP) + incident timeline with root-cause summary
  + live log stream (pause with buffered-count, text + severity-chip filters, per-log copy/jump/note)
- **Overview** — fleet status donut, noisiest instances, uptime leaderboard
- **Performance** — CPU / p99 latency / bandwidth history charts (dependency-free SVG)
- **Alerts** — full lifecycle manager (open → ack → snooze → resolve), synced across clients
- **Traces** — per-incident waterfall of correlated spans
- **Compute / Databases / Network** — category-scoped instance views
- **Org switcher** — three mock orgs with different fleets; switching re-hydrates the entire dashboard
- **Command palette** — instances, navigation, actions, incident triggers (cmdk on Radix Dialog)
- **Export logs** — current buffer as JSON or CSV (real file download)
- **Dark/light theme** — CSS-variable palettes, persisted, no-flash init
- **Resilience** — capped reconnect with backoff + retry banner, error boundary, defensive message
  parsing, REST rate limiting, scenario whitelist validation, locked CORS

## Deployment

The client reads `VITE_WS_URL` (see `client/.env.example`) so it can point at a remote server;
the server reads `PORT` and `CLIENT_ORIGIN`. Deploy the server to any Node host (Render/Railway:
build `npm install`, start `npm start -w server`, set `CLIENT_ORIGIN` to the client URL) and the
client to Vercel/Netlify (build `npm run build -w client`, publish `client/dist`, set `VITE_WS_URL`
to `wss://<server-host>/ws`).

## Testing

29 tests across the two risk centers: the engine state machine (escalation order, alert lifecycle,
trace open/close, recover-all, metrics sanity, per-org fleets) and the client store (rAF batch
semantics, pause buffering, ring-buffer cap, flash detection, aria-live announcements), plus
component tests for status badges and log expansion.
