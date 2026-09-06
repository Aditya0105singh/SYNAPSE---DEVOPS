import { useMemo, useState } from "react";
import {
  LayoutGrid,
  AlertTriangle,
  Zap,
  Bell,
  Mail,
  Waypoints,
  Cloud,
  Database,
  Network,
  Moon,
  Sun,
  HelpCircle,
  Settings,
  ChevronsUpDown,
  Check,
} from "lucide-react";
import { ORGS } from "@synapse/shared";
import { cn } from "../../lib/cn";
import { useStore, type View } from "../../store/useStore";
import { switchOrg } from "../../hooks/useSocket";
import { formatRelative } from "../../lib/format";
import { Menu, MenuTrigger, MenuContent, MenuItem } from "../ui/Menu";
import { HelpDialog } from "./HelpDialog";
import { SettingsDialog } from "./SettingsDialog";

function NavItem({
  icon: Icon,
  label,
  view,
  badge,
}: {
  icon: typeof LayoutGrid;
  label: string;
  view: View;
  badge?: number;
}) {
  const active = useStore((s) => s.view === view);
  const setView = useStore((s) => s.setView);
  return (
    <button
      onClick={() => setView(view)}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-[13px] font-medium transition-colors",
        active ? "bg-surface-3 text-ink-hi" : "text-ink-mute hover:bg-surface-2 hover:text-ink-body"
      )}
    >
      <Icon size={15} className={active ? "text-accent" : ""} />
      <span className="flex-1 text-left">{label}</span>
      {badge ? (
        <span className="rounded bg-status-critical/90 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
          {badge}
        </span>
      ) : active ? (
        <span className="h-1.5 w-1.5 rounded-full bg-status-critical" />
      ) : null}
    </button>
  );
}

function SectionLabel({ children }: { children: string }) {
  return <div className="px-3 pb-1.5 pt-4 text-[10px] font-semibold tracking-widest text-ink-faint">{children}</div>;
}

function OrgSwitcher() {
  const orgId = useStore((s) => s.orgId);
  const current = ORGS.find((o) => o.id === orgId) ?? ORGS[0];
  return (
    <Menu>
      <MenuTrigger asChild>
        <button className="mx-3 mb-2 flex items-center justify-between rounded-md border border-surface-border bg-surface-2 px-3 py-2 text-[12px] hover:border-ink-faint/40">
          <span className="flex items-center gap-2 font-medium text-ink-body">
            <span className="h-4 w-4 rounded bg-accent/20 text-center text-[10px] leading-4 text-accent">
              {current.name.charAt(0)}
            </span>
            {current.name}
          </span>
          <ChevronsUpDown size={13} className="text-ink-faint" />
        </button>
      </MenuTrigger>
      <MenuContent align="start">
        {ORGS.map((org) => (
          <MenuItem key={org.id} onSelect={() => org.id !== orgId && switchOrg(org.id)}>
            <span className="h-4 w-4 rounded bg-accent/20 text-center text-[10px] leading-4 text-accent">
              {org.name.charAt(0)}
            </span>
            <span className="flex-1">{org.name}</span>
            {org.id === orgId && <Check size={13} className="text-accent" />}
          </MenuItem>
        ))}
      </MenuContent>
    </Menu>
  );
}

function RecentAlerts() {
  const alerts = useStore((s) => s.alerts);
  const setView = useStore((s) => s.setView);
  const selectInstance = useStore((s) => s.selectInstance);

  const recent = useMemo(
    () => [...alerts.values()].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 3),
    [alerts]
  );

  if (!recent.length) {
    return <div className="px-3 py-1.5 text-[12px] text-ink-faint">No recent incidents.</div>;
  }
  return (
    <div className="space-y-0.5 pb-2 text-[12px] text-ink-mute">
      {recent.map((a) => (
        <button
          key={a.id}
          onClick={() => {
            setView("issues");
            selectInstance(a.instanceId);
          }}
          className="flex w-full items-center gap-1.5 truncate rounded-md px-3 py-1.5 text-left hover:bg-surface-2 hover:text-ink-body"
          title={a.title}
        >
          <span
            className={cn(
              "h-1.5 w-1.5 shrink-0 rounded-full",
              a.state === "resolved"
                ? "bg-status-healthy"
                : a.severity === "critical"
                  ? "bg-status-critical"
                  : "bg-status-medium"
            )}
          />
          <span className="truncate"># {a.instanceName}</span>
          <span className="ml-auto shrink-0 text-[10px] text-ink-faint">{formatRelative(a.updatedAt)}</span>
        </button>
      ))}
    </div>
  );
}

function ComputeUsage() {
  const costUsd = useStore((s) => s.metrics?.costUsd ?? 0);
  const budget = 2000;
  const filled = Math.round(Math.min(1, costUsd / budget) * 20);
  return (
    <div className="mx-3 mb-3 rounded-md border border-surface-border bg-surface-2 p-3">
      <div className="mb-2 flex items-center justify-between text-[11px]">
        <span className="font-medium text-ink-mute">COMPUTE USAGE</span>
        <span className="text-ink-faint">JULY</span>
      </div>
      <div className="mb-2 flex h-2 gap-0.5">
        {Array.from({ length: 20 }, (_, i) => (
          <div key={i} className={cn("flex-1 rounded-[1px]", i < filled ? "bg-accent" : "bg-surface-3")} />
        ))}
      </div>
      <div className="flex justify-between text-[11px] text-ink-faint">
        <span className="tabular text-ink-body">
          ${costUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </span>
        <span>${budget.toLocaleString()}</span>
      </div>
    </div>
  );
}

export function Sidebar() {
  const alertCount = useStore((s) => {
    let n = 0;
    for (const a of s.alerts.values()) if (a.state === "open") n++;
    return n;
  });
  const theme = useStore((s) => s.theme);
  const toggleTheme = useStore((s) => s.toggleTheme);
  const [helpOpen, setHelpOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <aside className="flex h-full w-[220px] shrink-0 flex-col border-r border-surface-border bg-surface-1">
      <div className="flex items-center gap-2 px-4 py-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-accent text-sm font-bold text-white">
          S
        </div>
        <span className="text-[15px] font-semibold tracking-tight text-ink-hi">SYNAPSE</span>
      </div>

      <OrgSwitcher />

      <nav className="flex-1 overflow-y-auto px-3">
        <SectionLabel>MAIN</SectionLabel>
        <div className="space-y-0.5">
          <NavItem icon={LayoutGrid} label="Overview" view="overview" />
          <NavItem icon={AlertTriangle} label="Issues" view="issues" />
          <NavItem icon={Zap} label="Performance" view="performance" />
          <NavItem icon={Bell} label="Alerts" view="alerts" badge={alertCount || undefined} />
        </div>

        <SectionLabel>OBSERVABILITY</SectionLabel>
        <div className="space-y-0.5">
          <NavItem icon={Mail} label="Log Stream" view="logstream" />
          <NavItem icon={Waypoints} label="Traces" view="traces" />
        </div>

        <SectionLabel>INFRASTRUCTURE</SectionLabel>
        <div className="space-y-0.5">
          <NavItem icon={Cloud} label="Compute" view="compute" />
          <NavItem icon={Database} label="Databases" view="databases" />
          <NavItem icon={Network} label="Network" view="network" />
        </div>

        <SectionLabel>RECENT</SectionLabel>
        <RecentAlerts />
      </nav>

      <ComputeUsage />

      <div className="space-y-0.5 border-t border-surface-border px-3 py-3 text-[13px] text-ink-mute">
        <button
          onClick={toggleTheme}
          className="flex w-full items-center justify-between rounded-md px-3 py-1.5 hover:bg-surface-2"
        >
          <span className="flex items-center gap-2.5">
            {theme === "dark" ? <Moon size={15} /> : <Sun size={15} />}
            {theme === "dark" ? "Dark Mode" : "Light Mode"}
          </span>
          <span
            className={cn(
              "h-4 w-7 rounded-full p-0.5 transition-colors",
              theme === "dark" ? "bg-accent/80" : "bg-surface-3"
            )}
          >
            <span
              className={cn(
                "block h-3 w-3 rounded-full bg-white transition-transform",
                theme === "dark" ? "translate-x-3" : "translate-x-0"
              )}
            />
          </span>
        </button>
        <button
          onClick={() => setHelpOpen(true)}
          className="flex w-full items-center gap-2.5 rounded-md px-3 py-1.5 hover:bg-surface-2"
        >
          <HelpCircle size={15} /> Help &amp; Support
        </button>
        <button
          onClick={() => setSettingsOpen(true)}
          className="flex w-full items-center gap-2.5 rounded-md px-3 py-1.5 hover:bg-surface-2"
        >
          <Settings size={15} /> Settings
        </button>
      </div>

      <HelpDialog open={helpOpen} onOpenChange={setHelpOpen} />
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </aside>
  );
}
