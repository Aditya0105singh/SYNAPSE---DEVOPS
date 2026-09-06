import { useEffect, useState } from "react";
import { Sidebar } from "./components/layout/Sidebar";
import { TopBar, ExportLogsButton } from "./components/layout/TopBar";
import { GlobalHUD } from "./components/hud/GlobalHUD";
import { InstancesTable } from "./components/instances/InstancesTable";
import { LogViewer } from "./components/logs/LogViewer";
import { CommandPalette } from "./components/palette/CommandPalette";
import { DemoPanel } from "./components/demo/DemoPanel";
import { PerfReadout } from "./components/demo/PerfReadout";
import { ErrorBoundary } from "./components/ui/ErrorBoundary";
import { Toaster } from "./components/ui/Toaster";
import { Announcer } from "./components/ui/Announcer";
import { OverviewView } from "./views/OverviewView";
import { PerformanceView } from "./views/PerformanceView";
import { AlertsView } from "./views/AlertsView";
import { TracesView } from "./views/TracesView";
import { useSocket } from "./hooks/useSocket";
import { useStore, type View } from "./store/useStore";

const VIEW_META: Record<View, { title: string; subtitle: string }> = {
  overview: { title: "Overview", subtitle: "Fleet-wide rollup of health, noise, and uptime." },
  issues: { title: "Affected Instances", subtitle: "Real-time tracking of degraded infrastructure resources and active alerts." },
  performance: { title: "Performance", subtitle: "Historical metric trends from the rolling server-side buffer." },
  alerts: { title: "Alerts", subtitle: "Alert lifecycle: open → acknowledged → resolved, synced across every client." },
  logstream: { title: "Log Stream", subtitle: "Full-screen virtualized event stream with severity and text filters." },
  traces: { title: "Traces", subtitle: "Correlated incident timelines rendered as request waterfalls." },
  compute: { title: "Compute", subtitle: "Instances in the compute tier." },
  databases: { title: "Databases", subtitle: "Instances in the database tier." },
  network: { title: "Network", subtitle: "Instances in the network tier." },
};

function ConnectionLostBanner({ onRetry }: { onRetry: () => void }) {
  const connStatus = useStore((s) => s.connStatus);
  if (connStatus !== "closed") return null;
  return (
    <div className="flex items-center justify-center gap-3 border-b border-status-critical/40 bg-status-critical/15 px-4 py-2 text-[12px] font-medium text-status-critical">
      Connection lost — the server stopped responding after several retries.
      <button
        onClick={onRetry}
        className="rounded border border-status-critical/40 px-2 py-0.5 text-[11px] font-semibold hover:bg-status-critical/20"
      >
        Retry now
      </button>
    </div>
  );
}

function MainView({ view }: { view: View }) {
  switch (view) {
    case "overview":
      return <OverviewView />;
    case "performance":
      return <PerformanceView />;
    case "alerts":
      return <AlertsView />;
    case "traces":
      return <TracesView />;
    case "logstream":
      return <LogViewer title="LOG STREAM" />;
    case "compute":
      return <InstancesTable category="compute" title="COMPUTE INSTANCES" />;
    case "databases":
      return <InstancesTable category="database" title="DATABASE INSTANCES" />;
    case "network":
      return <InstancesTable category="network" title="NETWORK INSTANCES" />;
    case "issues":
      return (
        <>
          <GlobalHUD />
          <div className="grid min-h-0 flex-1 grid-cols-[1.4fr_1fr] gap-4">
            <InstancesTable />
            <LogViewer />
          </div>
        </>
      );
  }
}

export default function App() {
  const { retry } = useSocket();
  const view = useStore((s) => s.view);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);
  const [perfOpen, setPerfOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const cmdK = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k";
      const demoHotkey = e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "d";
      if (cmdK) {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
      if (demoHotkey) {
        e.preventDefault();
        setDemoOpen((v) => !v);
      }
    };
    const onOpenDemo = () => setDemoOpen(true);
    window.addEventListener("keydown", onKey);
    document.addEventListener("synapse:open-demo", onOpenDemo);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("synapse:open-demo", onOpenDemo);
    };
  }, []);

  const meta = VIEW_META[view];
  const fillView = view === "issues" || view === "logstream" || view === "alerts" || view === "traces";

  return (
    <ErrorBoundary>
      <div className="flex h-screen w-screen overflow-hidden bg-surface-0">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar onOpenPalette={() => setPaletteOpen(true)} onTogglePerf={() => setPerfOpen((v) => !v)} />
          <ConnectionLostBanner onRetry={retry} />

          <main
            className={`flex min-h-0 flex-1 flex-col gap-4 p-5 ${fillView ? "overflow-hidden" : "scrollbar-thin overflow-y-auto"}`}
          >
            <div className="flex shrink-0 items-center justify-between">
              <div>
                <h1 className="text-[18px] font-semibold tracking-tight text-ink-hi">{meta.title}</h1>
                <p className="text-[12px] text-ink-faint">{meta.subtitle}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[11px] text-ink-faint">
                  Live updates <span className="text-ink-body">(streaming)</span>
                </span>
                <ExportLogsButton />
              </div>
            </div>

            <MainView view={view} />
          </main>
        </div>

        <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
        <DemoPanel open={demoOpen} onClose={() => setDemoOpen(false)} />
        <PerfReadout open={perfOpen} />
        <Toaster />
        <Announcer />

        {!demoOpen && (
          <button
            onClick={() => setDemoOpen(true)}
            title="Demo Control Panel (Ctrl+Shift+D)"
            aria-label="Open demo control panel"
            className="fixed bottom-5 right-5 z-40 grid h-11 w-11 place-items-center rounded-full border border-accent/40 bg-surface-1 text-accent shadow-glow hover:bg-surface-2"
          >
            ⚡
          </button>
        )}
      </div>
    </ErrorBoundary>
  );
}
