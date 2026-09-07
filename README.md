<div align="center">

# ⚡ Synapse — Incident Command Center

**A real-time DevOps observability dashboard**, built to prove one thing: a mock backend can still demand a *production-grade* frontend.

A persona-driven incident engine streams server-health events, structured error logs, alerts, and correlated traces over WebSocket into a high-density React dashboard that stays smooth under thousands of log events per minute.

[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)](client/tsconfig.json)
[![React 18](https://img.shields.io/badge/React-18-149ECA?logo=react&logoColor=white)](client/package.json)
[![Node.js](https://img.shields.io/badge/Node.js-Express%20%2B%20ws-339933?logo=node.js&logoColor=white)](server/package.json)
[![Tests](https://img.shields.io/badge/tests-29%20passing-2ea44f)](#-testing)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](#-license)
[![Live Demo](https://img.shields.io/badge/live%20demo-vercel-black?logo=vercel)](https://synapse-devops-client.vercel.app/)

</div>

> **Note on scope:** the *infrastructure being monitored* is entirely simulated — there is no real
> fleet of GPUs or Redis clusters behind this. But the transport, state management, virtualization,
> alert lifecycle, and rendering pipeline are all real, and built the way a production observability
> frontend actually has to be, not the way a static mockup would fake it.

---

<!--
  📸 Add screenshots here for maximum impact — a GitHub README with a real
  screenshot converts far better than one without. Two options:
    1. Drop PNGs into a `docs/screenshots/` folder and reference them below:
       ![Issues view](docs/screenshots/issues-critical.png)
    2. Or drag-and-drop images directly into a GitHub issue/PR comment box —
       GitHub hosts them and gives you a ready-made ![]() markdown snippet
       to paste here.
  Good shots to capture: the Issues view mid-incident (a CRITICAL row + lit-up
  alert bell), the incident timeline open, and the command palette.
-->

## 🔗 Live links

| | |
|---|---|
| **Live app** | [synapse-devops-client.vercel.app](https://synapse-devops-client.vercel.app/) |
| **API / server health** | [synapse-devops.onrender.com/health](https://synapse-devops.onrender.com/health) |
| **Repository** | [github.com/Aditya0105singh/SYNAPSE---DEVOPS](https://github.com/Aditya0105singh/SYNAPSE---DEVOPS) |

> The server runs on Render's free tier, which spins down after ~15 minutes idle — the first
> request after a quiet period can take 30-60s to wake it up. Give it a moment on first load.

## 📋 Table of contents

- [Why this exists](#-why-this-exists)
- [Features](#-features)
- [Architecture](#-architecture)
- [Tech stack](#-tech-stack)
- [Getting started](#-getting-started)
- [Project structure](#-project-structure)
- [Design decisions](#-design-decisions-the-why)
- [Testing](#-testing)
- [Deployment](#-deployment)
- [Known limitations](#-known-limitations)
- [License](#-license)

---

## 💡 Why this exists

Most portfolio dashboards are a static UI wired to `Math.random()`. Synapse instead has:

- a **stateful mock engine** with per-instance personas (an ML inference node fails with CUDA OOM,
  a payment processor fails deploys, Redis exhausts its connection pool) driving real state machines
- a **wire protocol** typed end-to-end and shared between server and client (`shared/`) so they can't drift
- a **rendering pipeline** engineered to survive thousands of log lines and dozens of messages per
  frame without dropping below 60fps — not claimed, [verifiable on screen](#-features) via the
  built-in perf readout

## ✨ Features

| Area | What it does |
|---|---|
| **Issues** | Virtualized instance table — sortable columns, "signal over noise" filter, per-row action menu (view details / jump to logs / acknowledge / restart / copy IP) |
| **Incident timeline** | Click any instance to see its correlated escalation history plus an auto-generated root-cause summary |
| **Real-time log stream** | Virtualized to thousands of entries with zero DOM growth — pause with a buffered-count badge, text + severity-chip filters, per-log copy / jump-to-instance / triage notes |
| **Overview** | Fleet status donut, noisiest-instances ranking, uptime leaderboard |
| **Performance** | CPU / p99 latency / bandwidth history as dependency-free SVG line charts |
| **Alerts** | Full lifecycle manager — open → acknowledged → snoozed → resolved, **synced across every connected client** |
| **Traces** | Per-incident waterfall of correlated spans sharing a `traceId` |
| **Compute / Databases / Network** | Category-scoped instance views |
| **Org switcher** | Three mock orgs with distinct fleets — switching re-hydrates the entire dashboard live |
| **Command palette** | `⌘K` / `Ctrl+K` — instances, navigation, theme, incident triggers, all keyboard-driven |
| **Demo control panel** | `Ctrl+Shift+D` — fire any scripted incident on any instance on demand, or run a 25 logs/sec stress test |
| **Export logs** | Current filtered buffer → real JSON or CSV file download |
| **Dark / light theme** | CSS-variable palettes, persisted, no-flash on load |
| **Resilience** | Capped reconnect with backoff + a manual retry banner, error boundary, defensive message parsing, rate-limited trigger endpoint, locked CORS |

## 🏗️ Architecture

```
┌────────────────────────────┐        WebSocket (/ws)          ┌─────────────────────────────┐
│  server/ (Node + Express)  │ ────────────────────────────────▶│  client/ (React 18 + Vite)  │
│                             │   hydrate → typed deltas         │                             │
│  IncidentEngine × 3 orgs    │   instance:update / log:event    │  useSocket (1 connection)   │
│   · persona state machines  │   metrics:update / alert:update  │    ↓ buffer                 │
│   · alert lifecycle         │   trace:update / timeline:event  │  rAF flush → Zustand store  │
│   · trace correlation       │◀────────────────────────────────│    ↓ narrow selectors       │
│   · 300-sample history      │   trigger / ack / restart /      │  virtualized table + logs   │
│   · stress / burst mode     │   org:switch                     │  (TanStack Virtual)         │
└────────────────────────────┘                                   └─────────────────────────────┘
               shared/ — single source of truth for every wire-protocol TypeScript type
```

**Data flow, in one paragraph:** each connected client is subscribed to exactly one org's
`IncidentEngine`. On connect it receives one `hydrate` message (full snapshot); after that, only
typed deltas stream. The client's `useSocket` hook buffers incoming deltas in a plain object and
flushes them into the Zustand store **at most once per animation frame**, so the UI never renders
faster than the screen refreshes no matter how bursty the event rate gets. Components subscribe to
narrow slices of that store, so one instance flipping to `CRITICAL` re-renders exactly one row.

## 🧰 Tech stack

| Layer | Choice | Why |
|---|---|---|
| Client | React 18 + TypeScript + Vite | Fast dev loop, strict typing end-to-end |
| State | [Zustand](https://github.com/pmndrs/zustand) | Selector-based subscriptions — no Context re-render storms, no Redux ceremony |
| Virtualization | [TanStack Virtual](https://tanstack.com/virtual) | Keeps DOM node count flat regardless of buffer size (verified: 5,000 logs → ~30 DOM rows) |
| UI primitives | [Radix UI](https://www.radix-ui.com/) + [cmdk](https://cmdk.paco.me/) | Real focus traps, ARIA semantics, and keyboard nav — not hand-rolled overlays |
| Styling | Tailwind CSS, CSS-variable theming | Dark/light palettes that swap live without a page reload |
| Server | Node.js + Express + [ws](https://github.com/websockets/ws) | Minimal, fast WebSocket transport; Express only serves the upgrade + a couple of REST routes |
| Shared types | Plain TS package (`shared/`) | One source of truth for the wire protocol — server and client can't silently diverge |
| Testing | [Vitest](https://vitest.dev/) + [React Testing Library](https://testing-library.com/react) | 29 tests across the engine state machine, the store's batching semantics, and components |

## 🚀 Getting started

```bash
git clone https://github.com/Aditya0105singh/SYNAPSE---DEVOPS.git
cd SYNAPSE---DEVOPS
npm install
npm run dev
```

Open **http://localhost:5173** — the server runs on `:4000`, and Vite proxies `/ws` and `/api` to it.

| Script | What it does |
|---|---|
| `npm run dev` | Client + server together, prefixed output |
| `npm run test` | Vitest — engine, store, and component tests |
| `npm run typecheck` | `tsc --noEmit` on server and client, strict mode |
| `npm run lint` | ESLint (typescript-eslint + react-hooks) |
| `npm run build` | Production client bundle |

**Try it in under a minute:**
1. Press `Ctrl+Shift+D` to open the demo control panel
2. Pick an instance and fire **Trigger CUDA OOM**
3. Watch the row flip to `CRITICAL`, the HUD's Active Alerts tick up, a matching JSON error log land in the stream, and the bell badge light up — all in lockstep
4. Click the instance to see the correlated incident timeline with an auto-generated root-cause summary
5. Press `⌘K` / `Ctrl+K` to drive the rest of the app without touching the mouse

## 📁 Project structure

```
synapse/
├── client/          React 18 + Vite dashboard
│   └── src/
│       ├── components/   layout, instances, logs, hud, palette, demo, charts, ui primitives
│       ├── views/         Overview, Performance, Alerts, Traces
│       ├── store/         Zustand store (single source of client truth)
│       ├── hooks/         useSocket — the WebSocket + rAF-batching layer
│       └── lib/           format/export/toast helpers
├── server/          Node + Express + ws mock incident engine
│   └── src/
│       ├── engine.ts       state machine, alert lifecycle, trace correlation, history buffer
│       ├── personas.ts     per-instance failure profiles and ambient log templates
│       └── index.ts        HTTP + WebSocket server, per-org subscriptions, rate limiting
└── shared/          TypeScript types shared by both — the wire protocol contract
```

## 🎯 Design decisions (the "why")

**Why batch WebSocket messages on `requestAnimationFrame`?**
The server can emit dozens of messages between two frames (especially in stress-test mode). Applying
each one to the store individually would trigger that many React render passes. Instead, `useSocket`
pushes parsed messages into a plain mutable buffer and flushes it into Zustand at most once per
animation frame — the UI can never render more often than the display refreshes, no matter the event
rate. Backpressure costs one array push per message.

**Why Zustand with narrow selectors instead of Context or Redux?**
Each `InstanceRow` subscribes to exactly its own instance (`s.instances.get(id)`); each HUD tile to
one metric. When one instance escalates, only that row re-renders — not the other rows, not the log
list, not the sidebar. Context re-renders every consumer on any change; Redux gets the same
selector-based isolation but with far more ceremony for a project this size.

**Why TanStack Virtual for the table and log viewer?**
The log buffer holds up to 5,000 entries — a deliberate ring-buffer cap so memory stays bounded no
matter how long the dashboard runs. Only the rows actually in the viewport exist in the DOM; scroll
position is simulated with a translated inner container. The perf readout (gauge icon in the top bar)
shows live FPS, events/sec, and DOM node count, so this claim is verifiable on screen, not just in
this paragraph.

**Why a persona-driven mock engine instead of random noise?**
Random data reads as fake. Each instance has a persona and a health state machine
(`healthy → medium → high → critical → recovered`). Escalations emit *correlated* artifacts — a
structured JSON error log, a timeline event, an alert, and trace spans sharing a `traceId` — so an
incident reads coherently across every panel, the way a real root cause does.

**Why is alert state server-side, not client-side?**
Acknowledge / resolve / snooze mutate the engine's in-memory alert map and broadcast `alert:update`
to every connected client. Open two browser tabs, acknowledge in one, and watch the other update —
the server is the single source of truth, exactly as a real incident tool has to behave.

**Honest demo scaling:** the HUD's 24H/1W/1M range tabs aggregate progressively larger windows of
the real 300-sample metrics history buffer. With only minutes of uptime there's no genuine week of
data behind them — the windows are demo-scaled — but every number is derived from stored samples,
never invented at render time.

## 🧪 Testing

**29 tests** across the two places a real bug would actually hide:

- **Engine state machine** — escalation order, alert lifecycle transitions, trace open/close,
  `recover_all`, metrics sanity (no `NaN`/divide-by-zero), per-org fleet composition
- **Client store** — rAF batch semantics, pause-buffering behavior, ring-buffer cap enforcement,
  status-change flash detection, `aria-live` announcement triggers
- **Components** — status badge rendering per state, log entry expand/collapse

```bash
npm run test        # 9 server + 20 client tests
npm run typecheck    # strict mode, zero errors
npm run lint         # zero errors (2 informational TanStack Virtual warnings)
```

## ☁️ Deployment

The client reads `VITE_WS_URL` (see `client/.env.example`) so it can point at a remote server; the
server reads `PORT` and `CLIENT_ORIGIN`.

> ⚠️ **The server cannot run on Vercel, Netlify Functions, or any other serverless platform.** It
> holds persistent WebSocket connections and runs background timers (`setInterval`) forever —
> serverless functions are request/response only and will crash it (`FUNCTION_INVOCATION_FAILED`).
> The server needs a host that keeps a process running: **Render** or **Railway**. The **client**
> (a static Vite build) is exactly what Vercel/Netlify are built for — deploy those two pieces
> separately.

**1. Server → Render** (a `render.yaml` Blueprint is included at the repo root):
1. On [render.com](https://render.com), **New → Blueprint**, connect this GitHub repo — Render reads `render.yaml` and configures the service automatically.
2. Deploy. Note the resulting URL, e.g. `https://synapse-server.onrender.com`.

**2. Client → Vercel:**
1. **New Project**, import this repo, set **Root Directory** to `client`.
2. Add an environment variable: `VITE_WS_URL` = `wss://<your-render-url>/ws` (note `wss://`, and the `/ws` path).
3. Deploy. Note the resulting URL, e.g. `https://synapse-devops.vercel.app`.

**3. Close the loop:** back on Render, set the `CLIENT_ORIGIN` env var to your Vercel URL from step 2
and restart the service — until this is set, the server's CORS lock defaults to `localhost` and will
reject the deployed client's requests.

## ⚠️ Known limitations

Being upfront about what this is and isn't:

- No real authentication, persistence, or database — every org's state lives in server memory and resets on restart
- No responsive/mobile layout — it's built for a desktop-density observability screen, the way the reference product it emulates is
- The historical HUD ranges (24H/1W/1M) are demo-scaled aggregations of a short-lived in-memory buffer, not genuine long-range history
- Rate limiting and CORS locking are real but intentionally lightweight — appropriate for a demo, not a hardened multi-tenant production service

## 📄 License

MIT — see [LICENSE](LICENSE).
