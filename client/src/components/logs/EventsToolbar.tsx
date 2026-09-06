import { Pause, Play, Trash2, Search } from "lucide-react";
import type { Severity } from "@synapse/shared";
import { useStore } from "../../store/useStore";
import { cn } from "../../lib/cn";

const SEVERITIES: { key: Severity; label: string; activeClass: string }[] = [
  { key: "critical", label: "CRIT", activeClass: "border-status-critical/40 bg-status-critical/15 text-status-critical" },
  { key: "warning", label: "WARN", activeClass: "border-status-medium/40 bg-status-medium/15 text-status-medium" },
  { key: "info", label: "INFO", activeClass: "border-status-info/40 bg-status-info/15 text-status-info" },
  { key: "debug", label: "DEBUG", activeClass: "border-surface-border bg-surface-3 text-ink-body" },
];

export function EventsToolbar() {
  const filter = useStore((s) => s.logFilter);
  const setFilter = useStore((s) => s.setLogFilter);
  const paused = useStore((s) => s.logsPaused);
  const toggle = useStore((s) => s.toggleLogsPaused);
  const clear = useStore((s) => s.clearLogs);
  const pendingCount = useStore((s) => s.pendingLogCount);
  const severityFilter = useStore((s) => s.severityFilter);
  const toggleSeverity = useStore((s) => s.toggleSeverity);

  return (
    <div className="space-y-2 border-b border-surface-border px-4 py-2.5">
      <div className="flex items-center gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-md border border-surface-border bg-surface-2 px-2.5 py-1.5">
          <Search size={12} className="text-ink-faint" />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter logs..."
            className="w-full bg-transparent text-[12px] text-ink-body outline-none placeholder:text-ink-faint"
          />
        </div>
        {paused && pendingCount > 0 && (
          <button
            onClick={toggle}
            className="whitespace-nowrap rounded-md bg-accent/15 px-2 py-1.5 text-[11px] font-medium text-accent"
          >
            +{pendingCount} new
          </button>
        )}
        <button
          onClick={toggle}
          title={paused ? "Resume" : "Pause"}
          aria-label={paused ? "Resume log stream" : "Pause log stream"}
          className={cn(
            "grid h-7 w-7 place-items-center rounded-md border",
            paused
              ? "border-accent/40 bg-accent/15 text-accent"
              : "border-surface-border bg-surface-2 text-ink-mute hover:text-ink-body"
          )}
        >
          {paused ? <Play size={13} /> : <Pause size={13} />}
        </button>
        <button
          onClick={clear}
          title="Clear"
          aria-label="Clear log buffer"
          className="grid h-7 w-7 place-items-center rounded-md border border-surface-border bg-surface-2 text-ink-mute hover:text-ink-body"
        >
          <Trash2 size={13} />
        </button>
      </div>

      <div className="flex items-center gap-1.5" role="group" aria-label="Severity filters">
        {SEVERITIES.map((s) => {
          const active = severityFilter[s.key];
          return (
            <button
              key={s.key}
              onClick={() => toggleSeverity(s.key)}
              aria-pressed={active}
              className={cn(
                "rounded border px-1.5 py-0.5 text-[9px] font-bold tracking-wide transition-colors",
                active ? s.activeClass : "border-surface-border bg-transparent text-ink-faint opacity-60"
              )}
            >
              {s.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
