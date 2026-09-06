import type { InstanceStatus } from "@synapse/shared";
import { cn } from "../../lib/cn";
import { STATUS_LABEL } from "../../lib/format";

const STYLES: Record<InstanceStatus, string> = {
  healthy: "bg-status-healthy/15 text-status-healthy border-status-healthy/30",
  medium: "bg-status-medium/15 text-status-medium border-status-medium/30",
  high: "bg-status-high/15 text-status-high border-status-high/30",
  critical: "bg-status-critical/15 text-status-critical border-status-critical/30",
  offline: "bg-status-offline/15 text-status-offline border-status-offline/30",
  deploying: "bg-status-info/15 text-status-info border-status-info/30",
};

const DOT: Record<InstanceStatus, string> = {
  healthy: "bg-status-healthy",
  medium: "bg-status-medium",
  high: "bg-status-high animate-pulseDot",
  critical: "bg-status-critical animate-pulseDot",
  offline: "bg-status-offline",
  deploying: "bg-status-info animate-pulseDot",
};

export function StatusBadge({ status, acked }: { status: InstanceStatus; acked?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded border px-1.5 py-0.5 text-[10px] font-semibold tracking-wide",
          STYLES[status]
        )}
      >
        <span className={cn("h-1.5 w-1.5 rounded-full", DOT[status])} />
        {STATUS_LABEL[status]}
      </span>
      {acked && (
        <span
          title="Active incident acknowledged"
          className="rounded border border-surface-border bg-surface-3 px-1 py-0.5 text-[9px] font-bold tracking-wide text-ink-mute"
        >
          ACK
        </span>
      )}
    </span>
  );
}

/** Sparkline stroke via theme CSS variables so it tracks light/dark palettes. */
export function statusStroke(status: InstanceStatus): string {
  return `rgb(var(--status-${status}))`;
}
