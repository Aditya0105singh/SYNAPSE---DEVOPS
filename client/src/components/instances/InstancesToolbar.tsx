import { Search, SlidersHorizontal } from "lucide-react";
import { useStore } from "../../store/useStore";
import { cn } from "../../lib/cn";

export function InstancesToolbar() {
  const filter = useStore((s) => s.instanceFilter);
  const setFilter = useStore((s) => s.setInstanceFilter);
  const signalOverNoise = useStore((s) => s.signalOverNoise);
  const toggle = useStore((s) => s.toggleSignalOverNoise);

  return (
    <div className="flex items-center gap-3 border-b border-surface-border px-4 py-3">
      <div className="flex flex-1 items-center gap-2 rounded-md border border-surface-border bg-surface-2 px-2.5 py-1.5">
        <Search size={13} className="text-ink-faint" />
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter servers..."
          className="w-full bg-transparent text-[12px] text-ink-body outline-none placeholder:text-ink-faint"
        />
      </div>
      <button
        onClick={toggle}
        title="Hide healthy instances"
        className={cn(
          "flex items-center gap-1.5 whitespace-nowrap rounded-md border px-2.5 py-1.5 text-[11px] font-medium transition-colors",
          signalOverNoise
            ? "border-accent/40 bg-accent/15 text-accent"
            : "border-surface-border bg-surface-2 text-ink-mute hover:text-ink-body"
        )}
      >
        <SlidersHorizontal size={13} />
        Signal over noise
      </button>
    </div>
  );
}
