import { useMemo, useState } from "react";
import { Check, CheckCheck, Clock, Search } from "lucide-react";
import type { Alert, AlertState } from "@synapse/shared";
import { useStore } from "../store/useStore";
import { sendClientMessage } from "../hooks/useSocket";
import { toast } from "../lib/toast";
import { formatRelative } from "../lib/format";
import { cn } from "../lib/cn";

const STATE_STYLES: Record<AlertState, string> = {
  open: "bg-status-critical/15 text-status-critical border-status-critical/30",
  acknowledged: "bg-status-medium/15 text-status-medium border-status-medium/30",
  snoozed: "bg-status-info/15 text-status-info border-status-info/30",
  resolved: "bg-status-healthy/15 text-status-healthy border-status-healthy/30",
};

const STATE_FILTERS: { key: AlertState | "all"; label: string }[] = [
  { key: "all", label: "ALL" },
  { key: "open", label: "OPEN" },
  { key: "acknowledged", label: "ACK'D" },
  { key: "snoozed", label: "SNOOZED" },
  { key: "resolved", label: "RESOLVED" },
];

function AlertActions({ alert }: { alert: Alert }) {
  if (alert.state === "resolved") {
    return <span className="text-[11px] text-ink-faint">closed {formatRelative(alert.updatedAt)}</span>;
  }
  const act = (action: "acknowledge" | "resolve" | "snooze", label: string) => {
    sendClientMessage({ type: "alert:action", alertId: alert.id, action });
    toast(`${label}: ${alert.instanceName}`);
  };
  return (
    <div className="flex items-center gap-1.5">
      {alert.state === "open" && (
        <button
          onClick={() => act("acknowledge", "Acknowledged")}
          className="flex items-center gap-1 rounded border border-surface-border px-2 py-1 text-[10px] font-semibold text-ink-mute hover:border-status-medium/40 hover:text-status-medium"
        >
          <Check size={11} /> ACK
        </button>
      )}
      <button
        onClick={() => act("resolve", "Resolved")}
        className="flex items-center gap-1 rounded border border-surface-border px-2 py-1 text-[10px] font-semibold text-ink-mute hover:border-status-healthy/40 hover:text-status-healthy"
      >
        <CheckCheck size={11} /> RESOLVE
      </button>
      {alert.state !== "snoozed" && (
        <button
          onClick={() => act("snooze", "Snoozed 5m")}
          className="flex items-center gap-1 rounded border border-surface-border px-2 py-1 text-[10px] font-semibold text-ink-mute hover:border-status-info/40 hover:text-status-info"
        >
          <Clock size={11} /> SNOOZE
        </button>
      )}
    </div>
  );
}

export function AlertsView({ initialState = "all" }: { initialState?: AlertState | "all" }) {
  const alerts = useStore((s) => s.alerts);
  const selectInstance = useStore((s) => s.selectInstance);
  const setView = useStore((s) => s.setView);
  const [stateFilter, setStateFilter] = useState<AlertState | "all">(initialState);
  const [text, setText] = useState("");

  const list = useMemo(() => {
    const q = text.trim().toLowerCase();
    return [...alerts.values()]
      .filter((a) => stateFilter === "all" || a.state === stateFilter)
      .filter((a) => !q || a.instanceName.toLowerCase().includes(q) || a.title.toLowerCase().includes(q))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [alerts, stateFilter, text]);

  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-surface-border bg-surface-1">
      <div className="px-5 pt-4">
        <h2 className="text-[13px] font-semibold tracking-wide text-ink-body">
          ALERT MANAGER <span className="text-ink-faint">({list.length})</span>
        </h2>
      </div>

      <div className="flex items-center gap-2 border-b border-surface-border px-4 py-3">
        <div className="flex flex-1 items-center gap-2 rounded-md border border-surface-border bg-surface-2 px-2.5 py-1.5">
          <Search size={12} className="text-ink-faint" />
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Filter by instance or message..."
            className="w-full bg-transparent text-[12px] text-ink-body outline-none placeholder:text-ink-faint"
          />
        </div>
        <div className="flex gap-1" role="group" aria-label="Alert state filter">
          {STATE_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setStateFilter(f.key)}
              aria-pressed={stateFilter === f.key}
              className={cn(
                "rounded border px-2 py-1 text-[10px] font-semibold tracking-wide",
                stateFilter === f.key
                  ? "border-accent/40 bg-accent/15 text-accent"
                  : "border-surface-border text-ink-faint hover:text-ink-body"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
        {list.map((a) => (
          <div
            key={a.id}
            className="flex items-center gap-3 border-b border-surface-border/60 px-4 py-3 hover:bg-surface-2/60"
          >
            <span
              className={cn(
                "shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-bold tracking-wide",
                STATE_STYLES[a.state]
              )}
            >
              {a.state.toUpperCase()}
            </span>
            <span
              className={cn(
                "shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-bold tracking-wide",
                a.severity === "critical"
                  ? "border-status-critical/30 bg-status-critical/15 text-status-critical"
                  : "border-status-medium/30 bg-status-medium/15 text-status-medium"
              )}
            >
              {a.severity.toUpperCase()}
            </span>
            <button
              onClick={() => {
                setView("issues");
                selectInstance(a.instanceId);
              }}
              className="min-w-0 flex-1 text-left"
            >
              <div className="truncate text-[12.5px] font-medium text-ink-body">{a.instanceName}</div>
              <div className="truncate text-[11px] text-ink-mute" title={a.title}>
                {a.title}
              </div>
              <div className="text-[10px] text-ink-faint">
                opened {formatRelative(a.createdAt)}
                {a.ackBy ? ` · ack'd by ${a.ackBy}` : ""}
              </div>
            </button>
            <AlertActions alert={a} />
          </div>
        ))}
        {list.length === 0 && (
          <div className="py-10 text-center text-[12px] text-ink-faint">
            No alerts in this state. Fire an incident from the demo panel to see the lifecycle.
          </div>
        )}
      </div>
    </div>
  );
}
