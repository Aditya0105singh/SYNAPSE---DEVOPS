import { cn } from "../../lib/cn";
import { useStore } from "../../store/useStore";

const CONFIG = {
  open: { label: "LIVE", dot: "bg-status-healthy", pulse: true },
  connecting: { label: "CONNECTING", dot: "bg-status-medium", pulse: true },
  reconnecting: { label: "RECONNECTING", dot: "bg-status-high", pulse: true },
  closed: { label: "OFFLINE", dot: "bg-status-critical", pulse: false },
} as const;

export function ConnectionStatusIndicator() {
  const status = useStore((s) => s.connStatus);
  const cfg = CONFIG[status];
  return (
    <div className="flex items-center gap-1.5 rounded-md border border-surface-border bg-surface-2 px-2.5 py-1 text-[11px] font-medium text-ink-mute">
      <span className={cn("h-1.5 w-1.5 rounded-full", cfg.dot, cfg.pulse && "animate-pulseDot")} />
      {cfg.label}
    </div>
  );
}
