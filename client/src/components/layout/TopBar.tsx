import { useMemo, useState } from "react";
import {
  Search,
  HelpCircle,
  Bell,
  ChevronDown,
  Download,
  Gauge,
  User,
  Moon,
  LogOut,
  Check,
  FileJson,
  FileSpreadsheet,
} from "lucide-react";
import { ConnectionStatusIndicator } from "./ConnectionStatusIndicator";
import { useStore, type View } from "../../store/useStore";
import { sendClientMessage } from "../../hooks/useSocket";
import { toast } from "../../lib/toast";
import { exportLogsAsCsv, exportLogsAsJson } from "../../lib/exportLogs";
import { formatRelative } from "../../lib/format";
import { Menu, MenuTrigger, MenuContent, MenuItem, MenuSeparator } from "../ui/Menu";
import { AppDialog } from "../ui/Dialog";
import { HelpDialog } from "./HelpDialog";
import { cn } from "../../lib/cn";

const VIEW_LABEL: Record<View, string> = {
  overview: "OVERVIEW",
  issues: "ISSUES",
  performance: "PERFORMANCE",
  alerts: "ALERTS",
  logstream: "LOG STREAM",
  traces: "TRACES",
  compute: "COMPUTE",
  databases: "DATABASES",
  network: "NETWORK",
};

function NotificationBell() {
  const alerts = useStore((s) => s.alerts);
  const setView = useStore((s) => s.setView);
  const open = useMemo(
    () => [...alerts.values()].filter((a) => a.state === "open").sort((a, b) => b.updatedAt - a.updatedAt),
    [alerts]
  );

  return (
    <Menu>
      <MenuTrigger asChild>
        <button
          aria-label={`Notifications: ${open.length} unacknowledged alerts`}
          className="relative grid h-8 w-8 place-items-center rounded-md border border-surface-border bg-surface-2 text-ink-mute hover:text-ink-body"
        >
          <Bell size={15} />
          {open.length > 0 && (
            <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-status-critical px-1 text-[9px] font-bold text-white">
              {open.length}
            </span>
          )}
        </button>
      </MenuTrigger>
      <MenuContent>
        <div className="px-2.5 py-1.5 text-[10px] font-semibold tracking-wide text-ink-faint">
          UNACKNOWLEDGED ALERTS
        </div>
        {open.length === 0 && <div className="px-2.5 py-2 text-[12px] text-ink-faint">All clear. Nothing open.</div>}
        {open.slice(0, 6).map((a) => (
          <div key={a.id} className="flex items-start gap-2 rounded px-2.5 py-1.5 hover:bg-surface-2">
            <span
              className={cn(
                "mt-1 h-1.5 w-1.5 shrink-0 rounded-full",
                a.severity === "critical" ? "bg-status-critical" : "bg-status-medium"
              )}
            />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[11.5px] font-medium text-ink-body">{a.instanceName}</div>
              <div className="truncate text-[10.5px] text-ink-mute" title={a.title}>
                {a.title}
              </div>
              <div className="text-[10px] text-ink-faint">{formatRelative(a.createdAt)}</div>
            </div>
            <button
              onClick={() => {
                sendClientMessage({ type: "alert:action", alertId: a.id, action: "acknowledge" });
                toast(`Acknowledged: ${a.instanceName}`);
              }}
              className="mt-0.5 shrink-0 rounded border border-surface-border px-1.5 py-0.5 text-[10px] font-semibold text-ink-mute hover:border-accent/40 hover:text-accent"
            >
              ACK
            </button>
          </div>
        ))}
        <MenuSeparator />
        <MenuItem onSelect={() => setView("alerts")}>
          <Check size={13} />
          Open alert manager
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}

function UserMenu() {
  const [profileOpen, setProfileOpen] = useState(false);
  const toggleTheme = useStore((s) => s.toggleTheme);

  return (
    <>
      <Menu>
        <MenuTrigger asChild>
          <button className="flex items-center gap-2 rounded-md border border-surface-border bg-surface-2 px-2.5 py-1.5 text-[13px] font-medium text-ink-body">
            <span className="grid h-5 w-5 place-items-center rounded-full bg-accent text-[10px] font-bold text-white">
              AS
            </span>
            ADITYA SINGH
            <ChevronDown size={13} className="text-ink-faint" />
          </button>
        </MenuTrigger>
        <MenuContent>
          <MenuItem onSelect={() => setProfileOpen(true)}>
            <User size={13} /> Profile
          </MenuItem>
          <MenuItem onSelect={() => toggleTheme()}>
            <Moon size={13} /> Toggle theme
          </MenuItem>
          <MenuSeparator />
          <MenuItem danger onSelect={() => toast("Signed out (mock) — no real session to tear down.")}>
            <LogOut size={13} /> Sign out
          </MenuItem>
        </MenuContent>
      </Menu>

      <AppDialog
        open={profileOpen}
        onOpenChange={setProfileOpen}
        title="Profile"
        description="Mock operator identity for this demo environment."
      >
        <div className="flex items-center gap-3 rounded-md bg-surface-2 p-3">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-accent text-[14px] font-bold text-white">
            AS
          </span>
          <div>
            <div className="text-[13px] font-semibold text-ink-hi">Aditya Singh</div>
            <div className="text-[11px] text-ink-mute">Site Reliability Engineer · On-call (primary)</div>
            <div className="text-[11px] text-ink-faint">aditya@sparkpixel.dev</div>
          </div>
        </div>
      </AppDialog>
    </>
  );
}

export function TopBar({ onOpenPalette, onTogglePerf }: { onOpenPalette: () => void; onTogglePerf: () => void }) {
  const eventsPerSec = useStore((s) => s.eventsPerSec);
  const view = useStore((s) => s.view);
  const [helpOpen, setHelpOpen] = useState(false);

  return (
    <header className="flex h-14 shrink-0 items-center gap-4 border-b border-surface-border bg-surface-1 px-5">
      <div className="flex items-center gap-1.5 text-[13px] text-ink-faint">
        <span className="text-ink-mute">SPARKPIXEL</span>
        <span>/</span>
        <span className="rounded bg-surface-3 px-1.5 py-0.5 font-medium text-ink-body">{VIEW_LABEL[view]}</span>
      </div>

      <button
        onClick={onOpenPalette}
        className="ml-4 flex w-72 items-center gap-2 rounded-md border border-surface-border bg-surface-2 px-3 py-1.5 text-[13px] text-ink-faint transition-colors hover:border-ink-faint/50"
      >
        <Search size={14} />
        <span className="flex-1 text-left">Search servers, IPs, or clusters...</span>
        <kbd className="rounded border border-surface-border bg-surface-3 px-1.5 py-0.5 text-[10px] text-ink-faint">
          ⌘K
        </kbd>
      </button>

      <div className="ml-auto flex items-center gap-3">
        <button
          onClick={onTogglePerf}
          title="Toggle performance readout"
          className="flex items-center gap-1.5 rounded-md border border-surface-border bg-surface-2 px-2.5 py-1.5 text-[11px] font-medium text-ink-mute hover:text-ink-body"
        >
          <Gauge size={13} />
          {eventsPerSec}/s
        </button>
        <ConnectionStatusIndicator />
        <button
          onClick={() => setHelpOpen(true)}
          aria-label="Help"
          className="grid h-8 w-8 place-items-center rounded-md border border-surface-border bg-surface-2 text-ink-mute hover:text-ink-body"
        >
          <HelpCircle size={15} />
        </button>
        <NotificationBell />
        <UserMenu />
      </div>

      <HelpDialog open={helpOpen} onOpenChange={setHelpOpen} />
    </header>
  );
}

export function ExportLogsButton() {
  const logs = useStore((s) => s.logs);
  return (
    <Menu>
      <MenuTrigger asChild>
        <button className="flex items-center gap-2 rounded-md bg-ink-hi px-3 py-1.5 text-[12px] font-semibold text-surface-1 hover:opacity-90">
          <Download size={13} />
          EXPORT LOGS
        </button>
      </MenuTrigger>
      <MenuContent>
        <MenuItem
          onSelect={() => {
            exportLogsAsJson(logs);
            toast(`Exported ${logs.length.toLocaleString()} logs as JSON`);
          }}
        >
          <FileJson size={13} /> Export as JSON
        </MenuItem>
        <MenuItem
          onSelect={() => {
            exportLogsAsCsv(logs);
            toast(`Exported ${logs.length.toLocaleString()} logs as CSV`);
          }}
        >
          <FileSpreadsheet size={13} /> Export as CSV
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}
