import { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowUp, ArrowDown } from "lucide-react";
import type { InstanceCategory, InstanceState } from "@synapse/shared";
import { useStore, type SortKey } from "../../store/useStore";
import { InstanceRow, ROW_GRID } from "./InstanceRow";
import { InstancesToolbar } from "./InstancesToolbar";
import { IncidentTimeline } from "./IncidentTimeline";
import { cn } from "../../lib/cn";

const STATUS_RANK: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  deploying: 3,
  healthy: 4,
  offline: 5,
};

function compare(a: InstanceState, b: InstanceState, key: SortKey): number {
  switch (key) {
    case "name":
      return a.name.localeCompare(b.name);
    case "status":
      return (STATUS_RANK[a.status] ?? 9) - (STATUS_RANK[b.status] ?? 9);
    case "cpu":
      return b.cpu - a.cpu;
    case "memory":
      return b.memoryGb - a.memoryGb;
    case "uptime":
      return b.uptimeSec - a.uptimeSec;
  }
}

function useFilteredIds(category?: InstanceCategory): string[] {
  const instances = useStore((s) => s.instances);
  const filter = useStore((s) => s.instanceFilter.trim().toLowerCase());
  const signalOverNoise = useStore((s) => s.signalOverNoise);
  const sortKey = useStore((s) => s.sortKey);
  const sortDir = useStore((s) => s.sortDir);

  const list = [...instances.values()]
    .filter((i) => !category || i.category === category)
    .filter((i) => !signalOverNoise || i.status !== "healthy")
    .filter((i) => !filter || i.name.toLowerCase().includes(filter) || i.ip.includes(filter))
    .sort((a, b) => {
      const cmp = compare(a, b, sortKey);
      return sortDir === "asc" ? cmp : -cmp;
    });

  return list.map((i) => i.id);
}

const HEADERS: { label: string; key: SortKey | null }[] = [
  { label: "NAME & IP", key: "name" },
  { label: "STATUS", key: "status" },
  { label: "CPU", key: "cpu" },
  { label: "CPU TREND", key: null },
  { label: "MEMORY", key: "memory" },
  { label: "UPTIME", key: "uptime" },
  { label: "", key: null },
];

function HeaderCell({ label, sortable }: { label: string; sortable: SortKey | null }) {
  const sortKey = useStore((s) => s.sortKey);
  const sortDir = useStore((s) => s.sortDir);
  const setSort = useStore((s) => s.setSort);
  if (!sortable) return <div>{label}</div>;
  const active = sortKey === sortable;
  return (
    <button
      onClick={() => setSort(sortable)}
      aria-label={`Sort by ${label}${active ? `, currently ${sortDir}ending` : ""}`}
      className={cn(
        "flex items-center gap-1 text-left uppercase tracking-wider hover:text-ink-body",
        active ? "text-ink-body" : "text-ink-faint"
      )}
    >
      {label}
      {active && (sortDir === "asc" ? <ArrowUp size={10} /> : <ArrowDown size={10} />)}
    </button>
  );
}

export function InstancesTable({ category, title }: { category?: InstanceCategory; title?: string }) {
  const ids = useFilteredIds(category);
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: ids.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 56,
    overscan: 8,
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-surface-border bg-surface-1">
      <div className="flex items-center justify-between px-5 pt-4">
        <h2 className="text-[13px] font-semibold tracking-wide text-ink-body">
          {title ?? "ACTIVE INSTANCES"} <span className="text-ink-faint">({ids.length})</span>
        </h2>
      </div>
      <InstancesToolbar />
      <IncidentTimeline />

      <div
        className={cn(
          "grid gap-3 border-b border-surface-border px-4 py-2 text-[10px] font-semibold tracking-wider text-ink-faint",
          ROW_GRID
        )}
      >
        {HEADERS.map((h) => (
          <HeaderCell key={h.label || "actions"} label={h.label} sortable={h.key} />
        ))}
      </div>

      <div ref={parentRef} className="scrollbar-thin min-h-0 flex-1 overflow-y-auto" data-instance-scroll>
        <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
          {virtualizer.getVirtualItems().map((row) => (
            <div
              key={ids[row.index]}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${row.start}px)`,
              }}
            >
              <InstanceRow id={ids[row.index]} />
            </div>
          ))}
          {ids.length === 0 && (
            <div className="py-10 text-center text-[12px] text-ink-faint">No instances match the current filter.</div>
          )}
        </div>
      </div>
    </div>
  );
}
