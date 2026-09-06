import { Command } from "cmdk";
import {
  Server,
  Zap,
  LayoutGrid,
  AlertTriangle,
  Bell,
  Mail,
  Waypoints,
  Cloud,
  Database,
  Network,
  Moon,
  SlidersHorizontal,
  CheckCheck,
  Gauge,
} from "lucide-react";
import { INCIDENT_SCENARIOS } from "@synapse/shared";
import { useStore, type View } from "../../store/useStore";
import { sendClientMessage } from "../../hooks/useSocket";
import { toast } from "../../lib/toast";
import { STATUS_LABEL } from "../../lib/format";

const VIEW_COMMANDS: { view: View; label: string; icon: typeof LayoutGrid }[] = [
  { view: "overview", label: "Go to Overview", icon: LayoutGrid },
  { view: "issues", label: "Go to Issues", icon: AlertTriangle },
  { view: "performance", label: "Go to Performance", icon: Zap },
  { view: "alerts", label: "Go to Alerts", icon: Bell },
  { view: "logstream", label: "Go to Log Stream", icon: Mail },
  { view: "traces", label: "Go to Traces", icon: Waypoints },
  { view: "compute", label: "Go to Compute", icon: Cloud },
  { view: "databases", label: "Go to Databases", icon: Database },
  { view: "network", label: "Go to Network", icon: Network },
];

const itemClass =
  "flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-[13px] text-ink-body data-[selected=true]:bg-surface-2";
const groupClass = "px-1 py-1 text-[10px] font-semibold tracking-wide text-ink-faint";

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const instances = useStore((s) => s.instances);
  const alerts = useStore((s) => s.alerts);
  const selectInstance = useStore((s) => s.selectInstance);
  const setInstanceFilter = useStore((s) => s.setInstanceFilter);
  const setView = useStore((s) => s.setView);
  const toggleTheme = useStore((s) => s.toggleTheme);
  const toggleSignalOverNoise = useStore((s) => s.toggleSignalOverNoise);

  const run = (fn: () => void) => {
    fn();
    onClose();
  };

  return (
    <Command.Dialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      label="Command palette"
      loop
      overlayClassName="fixed inset-0 z-50 bg-black/60"
      contentClassName="fixed left-1/2 top-[15vh] z-50 w-full max-w-xl -translate-x-1/2 overflow-hidden rounded-lg border border-surface-border bg-surface-1 shadow-panel"
    >
      <Command.Input
        autoFocus
        placeholder="Search servers, views, or actions..."
        className="w-full border-b border-surface-border bg-transparent px-4 py-3 text-[14px] text-ink-body outline-none placeholder:text-ink-faint"
      />
      <Command.List className="scrollbar-thin max-h-80 overflow-y-auto p-2">
        <Command.Empty className="px-3 py-6 text-center text-[13px] text-ink-faint">No matches found.</Command.Empty>

        <Command.Group heading="INSTANCES" className={groupClass}>
          {[...instances.values()].map((inst) => (
            <Command.Item
              key={inst.id}
              value={`${inst.name} ${inst.ip}`}
              onSelect={() =>
                run(() => {
                  setView("issues");
                  selectInstance(inst.id);
                  setInstanceFilter("");
                })
              }
              className={itemClass}
            >
              <Server size={14} className="text-ink-faint" />
              <span className="flex-1">{inst.name}</span>
              <span className="text-[11px] text-ink-faint">{inst.ip}</span>
              <span className="text-[10px] font-semibold text-ink-faint">{STATUS_LABEL[inst.status]}</span>
            </Command.Item>
          ))}
        </Command.Group>

        <Command.Group heading="NAVIGATE" className={groupClass}>
          {VIEW_COMMANDS.map(({ view, label, icon: Icon }) => (
            <Command.Item key={view} value={label} onSelect={() => run(() => setView(view))} className={itemClass}>
              <Icon size={14} className="text-ink-faint" />
              {label}
            </Command.Item>
          ))}
        </Command.Group>

        <Command.Group heading="ACTIONS" className={groupClass}>
          <Command.Item value="toggle theme dark light" onSelect={() => run(() => toggleTheme())} className={itemClass}>
            <Moon size={14} className="text-ink-faint" />
            Toggle theme
          </Command.Item>
          <Command.Item
            value="toggle signal over noise hide healthy"
            onSelect={() => run(() => toggleSignalOverNoise())}
            className={itemClass}
          >
            <SlidersHorizontal size={14} className="text-ink-faint" />
            Toggle signal over noise
          </Command.Item>
          <Command.Item
            value="acknowledge all alerts"
            onSelect={() =>
              run(() => {
                let n = 0;
                for (const a of alerts.values()) {
                  if (a.state === "open") {
                    sendClientMessage({ type: "alert:action", alertId: a.id, action: "acknowledge" });
                    n++;
                  }
                }
                toast(n ? `Acknowledged ${n} alert${n > 1 ? "s" : ""}` : "No open alerts");
              })
            }
            className={itemClass}
          >
            <CheckCheck size={14} className="text-ink-faint" />
            Acknowledge all alerts
          </Command.Item>
          <Command.Item
            value="run stress test high frequency logs"
            onSelect={() =>
              run(() => {
                sendClientMessage({ type: "trigger:stress" });
                toast("Stress test: ~25 logs/sec for 15s");
              })
            }
            className={itemClass}
          >
            <Gauge size={14} className="text-ink-faint" />
            Run log stress test
          </Command.Item>
          <Command.Item
            value="open demo control panel"
            onSelect={() => run(() => document.dispatchEvent(new CustomEvent("synapse:open-demo")))}
            className={itemClass}
          >
            <Zap size={14} className="text-ink-faint" />
            Open Demo Control Panel
          </Command.Item>
        </Command.Group>

        <Command.Group heading="TRIGGER INCIDENT" className={groupClass}>
          {INCIDENT_SCENARIOS.map((s) => (
            <Command.Item
              key={s.id}
              value={`trigger ${s.label}`}
              onSelect={() =>
                run(() => {
                  sendClientMessage({ type: "trigger:incident", scenarioId: s.id });
                  toast(`Fired: ${s.label}`);
                })
              }
              className={itemClass}
            >
              <Zap size={14} className="text-status-high" />
              {s.label}
            </Command.Item>
          ))}
        </Command.Group>
      </Command.List>
    </Command.Dialog>
  );
}
