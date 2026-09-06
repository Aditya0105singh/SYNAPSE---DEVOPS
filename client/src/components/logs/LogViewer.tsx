import { useEffect, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useStore } from "../../store/useStore";
import { LogEntry } from "./LogEntry";
import { EventsToolbar } from "./EventsToolbar";

function useFilteredLogs() {
  const logs = useStore((s) => s.logs);
  const filter = useStore((s) => s.logFilter.trim().toLowerCase());
  const severityFilter = useStore((s) => s.severityFilter);

  return logs.filter((l) => {
    if (!severityFilter[l.severity]) return false;
    if (!filter) return true;
    return (
      l.message.toLowerCase().includes(filter) ||
      l.instanceName.toLowerCase().includes(filter) ||
      l.severity.includes(filter)
    );
  });
}

export function LogViewer({ title }: { title?: string }) {
  const logs = useFilteredLogs();
  const parentRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);

  const virtualizer = useVirtualizer({
    count: logs.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 30,
    overscan: 12,
  });

  useEffect(() => {
    if (stickToBottomRef.current && logs.length) {
      virtualizer.scrollToIndex(logs.length - 1, { align: "end" });
    }
  }, [logs.length, virtualizer]);

  const handleScroll = () => {
    const el = parentRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickToBottomRef.current = distanceFromBottom < 80;
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-surface-border bg-surface-1">
      <div className="flex items-center justify-between px-5 pt-4">
        <h2 className="text-[13px] font-semibold tracking-wide text-ink-body">
          {title ?? "REAL-TIME EVENTS"} <span className="text-ink-faint">({logs.length.toLocaleString()})</span>
        </h2>
      </div>
      <EventsToolbar />
      <div ref={parentRef} onScroll={handleScroll} className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
        <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
          {virtualizer.getVirtualItems().map((row) => (
            <div
              key={logs[row.index].id}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${row.start}px)`,
              }}
            >
              <LogEntry log={logs[row.index]} />
            </div>
          ))}
          {logs.length === 0 && <div className="py-10 text-center text-[12px] text-ink-faint">No log events yet.</div>}
        </div>
      </div>
    </div>
  );
}
