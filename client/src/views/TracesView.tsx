import { useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import type { Trace } from "@synapse/shared";
import { useStore } from "../store/useStore";
import { formatRelative, formatTime } from "../lib/format";
import { cn } from "../lib/cn";

function Waterfall({ trace }: { trace: Trace }) {
  // active traces have no endedAt yet; use the furthest span edge so render stays pure
  const end =
    trace.endedAt ?? trace.spans.reduce((max, s) => Math.max(max, s.ts + s.durationMs), trace.startedAt + 1000);
  const total = Math.max(1, end - trace.startedAt);

  return (
    <div className="space-y-1.5 border-t border-surface-border/60 bg-surface-0/40 px-4 py-3">
      {trace.spans.map((span, i) => {
        const leftPct = ((span.ts - trace.startedAt) / total) * 100;
        const widthPct = Math.max(2, Math.min(100 - leftPct, (span.durationMs / total) * 100));
        return (
          <div key={i} className="grid grid-cols-[240px_1fr] items-center gap-3">
            <div className="truncate text-[10.5px] text-ink-mute" title={span.label}>
              <span className="mr-1.5 tabular text-ink-faint">{formatTime(span.ts)}</span>
              {span.label}
            </div>
            <div className="relative h-4 rounded bg-surface-2">
              <div
                className="absolute top-0.5 h-3 rounded-sm"
                style={{
                  left: `${leftPct}%`,
                  width: `${widthPct}%`,
                  background: `rgb(var(--status-${span.severity === "warning" ? "medium" : span.severity}))`,
                  opacity: 0.85,
                }}
                title={`${span.label} (${span.durationMs}ms)`}
              />
            </div>
          </div>
        );
      })}
      {trace.spans.length === 0 && <div className="text-[11px] text-ink-faint">No spans recorded yet.</div>}
    </div>
  );
}

export function TracesView() {
  const traces = useStore((s) => s.traces);
  const [openId, setOpenId] = useState<string | null>(null);

  const list = useMemo(() => [...traces.values()].sort((a, b) => b.startedAt - a.startedAt), [traces]);

  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-surface-border bg-surface-1">
      <div className="px-5 pb-3 pt-4">
        <h2 className="text-[13px] font-semibold tracking-wide text-ink-body">
          INCIDENT TRACES <span className="text-ink-faint">({list.length})</span>
        </h2>
        <p className="mt-1 text-[11px] text-ink-faint">
          Every incident is tagged with a traceId at escalation; its correlated events render as a waterfall.
        </p>
      </div>

      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto border-t border-surface-border">
        {list.map((t) => {
          const open = openId === t.traceId;
          const active = !t.endedAt;
          return (
            <div key={t.traceId} className="border-b border-surface-border/60">
              <button
                onClick={() => setOpenId(open ? null : t.traceId)}
                aria-expanded={open}
                className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-2/60"
              >
                <ChevronRight size={13} className={cn("shrink-0 text-ink-faint transition-transform", open && "rotate-90")} />
                <span
                  className={cn(
                    "shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-bold tracking-wide",
                    active
                      ? "border-status-critical/30 bg-status-critical/15 text-status-critical"
                      : "border-status-healthy/30 bg-status-healthy/15 text-status-healthy"
                  )}
                >
                  {active ? "ACTIVE" : "CLOSED"}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] font-medium text-ink-body">
                    {t.instanceName} · {t.scenarioId}
                  </span>
                  <span className="block font-mono text-[10px] text-ink-faint">{t.traceId}</span>
                </span>
                <span className="shrink-0 tabular text-[11px] text-ink-faint">
                  {t.spans.length} spans · {formatRelative(t.startedAt)}
                </span>
              </button>
              {open && <Waterfall trace={t} />}
            </div>
          );
        })}
        {list.length === 0 && (
          <div className="py-10 text-center text-[12px] text-ink-faint">
            No traces yet — trigger an incident from the demo panel and the correlated escalation will appear here.
          </div>
        )}
      </div>
    </div>
  );
}
