import { X } from "lucide-react";
import { useStore } from "../../store/useStore";
import { formatTime } from "../../lib/format";
import { cn } from "../../lib/cn";

const SEVERITY_DOT: Record<string, string> = {
  critical: "bg-status-critical",
  warning: "bg-status-medium",
  info: "bg-status-info",
  debug: "bg-ink-faint",
};

function rootCauseSummary(instanceName: string, events: { label: string; severity: string }[]) {
  const critical = events.filter((e) => e.severity === "critical" || e.severity === "warning");
  if (!critical.length) return `${instanceName} has no active incident correlation in the recent window.`;
  const latest = critical[critical.length - 1];
  return `${instanceName} is degraded: ${critical.length} correlated event${critical.length > 1 ? "s" : ""} in the recent window, most recently "${latest.label}".`;
}

export function IncidentTimeline() {
  const selectedId = useStore((s) => s.selectedInstanceId);
  const inst = useStore((s) => (selectedId ? s.instances.get(selectedId) : undefined));
  const timeline = useStore((s) => (selectedId ? s.timelines.get(selectedId) : undefined));
  const selectInstance = useStore((s) => s.selectInstance);

  if (!selectedId || !inst) return null;
  const events = timeline ?? [];

  return (
    <div className="border-b border-surface-border bg-surface-2/60 px-5 py-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="text-[12px] font-semibold tracking-wide text-ink-body">
            INCIDENT TIMELINE — {inst.name}
          </div>
          <div className="mt-1 text-[12px] text-ink-mute">{rootCauseSummary(inst.name, events)}</div>
        </div>
        <button
          onClick={() => selectInstance(null)}
          className="grid h-6 w-6 shrink-0 place-items-center rounded text-ink-faint hover:bg-surface-3 hover:text-ink-body"
        >
          <X size={14} />
        </button>
      </div>

      {events.length === 0 ? (
        <div className="text-[12px] text-ink-faint">No timeline events yet — this instance is quiet.</div>
      ) : (
        <div className="flex gap-0 overflow-x-auto pb-1">
          {events.map((ev, i) => (
            <div key={i} className="flex min-w-[180px] max-w-[220px] flex-col gap-1 pr-4">
              <div className="flex items-center gap-2">
                <span className={cn("h-2 w-2 rounded-full", SEVERITY_DOT[ev.severity])} />
                <span className="text-[10px] tabular text-ink-faint">{formatTime(ev.ts)}</span>
              </div>
              <div className="ml-4 border-l border-surface-border pl-3 text-[11px] leading-snug text-ink-body">
                {ev.label}
              </div>
              {i < events.length - 1 && <div className="ml-4 h-px w-4 self-end bg-surface-border" />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
