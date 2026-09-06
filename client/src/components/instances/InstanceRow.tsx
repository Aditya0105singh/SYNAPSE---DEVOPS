import { memo } from "react";
import { MoreHorizontal, Eye, ScrollText, Check, RotateCcw, Copy } from "lucide-react";
import { useStore } from "../../store/useStore";
import { sendClientMessage } from "../../hooks/useSocket";
import { toast } from "../../lib/toast";
import { StatusBadge, statusStroke } from "./StatusBadge";
import { CpuSparkline } from "./CpuSparkline";
import { formatUptime } from "../../lib/format";
import { cn } from "../../lib/cn";
import { Menu, MenuTrigger, MenuContent, MenuItem, MenuSeparator } from "../ui/Menu";

export const ROW_GRID = "grid-cols-[2fr_1.1fr_0.6fr_1fr_0.9fr_0.7fr_40px]";

function InstanceRowInner({ id }: { id: string }) {
  const inst = useStore((s) => s.instances.get(id));
  const isFlashing = useStore((s) => s.flashIds.has(id));
  const selected = useStore((s) => s.selectedInstanceId === id);
  // primitive-returning selectors so rows only re-render when their own values change
  const activeAlertId = useStore((s) => {
    let latestId: string | null = null;
    let latestTs = -1;
    for (const a of s.alerts.values()) {
      if (a.instanceId === id && a.state !== "resolved" && a.updatedAt > latestTs) {
        latestId = a.id;
        latestTs = a.updatedAt;
      }
    }
    return latestId;
  });
  const acked = useStore((s) => {
    if (!activeAlertId) return false;
    return s.alerts.get(activeAlertId)?.state === "acknowledged";
  });
  const selectInstance = useStore((s) => s.selectInstance);
  const setView = useStore((s) => s.setView);
  const setLogFilter = useStore((s) => s.setLogFilter);

  if (!inst) return null;

  const degraded = inst.status === "high" || inst.status === "critical";

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`${inst.name}, status ${inst.status}, CPU ${Math.round(inst.cpu)} percent`}
      onClick={() => selectInstance(selected ? null : id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          selectInstance(selected ? null : id);
        }
      }}
      className={cn(
        "grid cursor-pointer items-center gap-3 border-b border-surface-border/60 px-4 py-3 text-[13px] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent hover:bg-surface-2/60",
        ROW_GRID,
        selected && "bg-surface-2",
        isFlashing && "animate-flashRow"
      )}
    >
      <div className="min-w-0">
        <div className="truncate font-medium text-ink-hi">{inst.name}</div>
        <div className="truncate text-[11px] text-ink-faint">{inst.ip}</div>
      </div>
      <div>
        <StatusBadge status={inst.status} acked={acked} />
      </div>
      <div className="tabular text-ink-body">{Math.round(inst.cpu)}%</div>
      <div>
        <CpuSparkline data={inst.cpuHistory} color={statusStroke(inst.status)} />
      </div>
      <div className="tabular text-ink-mute">
        {inst.memoryGb.toFixed(1)} GB
        <span className="text-ink-faint"> / {inst.memoryCapGb}GB</span>
      </div>
      <div className="tabular text-ink-mute">{formatUptime(inst.uptimeSec)}</div>

      <Menu>
        <MenuTrigger asChild>
          <button
            aria-label={`Actions for ${inst.name}`}
            onClick={(e) => e.stopPropagation()}
            className="grid h-7 w-7 place-items-center rounded-md text-ink-faint hover:bg-surface-3 hover:text-ink-body"
          >
            <MoreHorizontal size={15} />
          </button>
        </MenuTrigger>
        <MenuContent>
          <MenuItem onSelect={() => selectInstance(id)}>
            <Eye size={13} /> View details
          </MenuItem>
          <MenuItem
            onSelect={() => {
              setLogFilter(inst.name);
              setView("logstream");
            }}
          >
            <ScrollText size={13} /> View logs for this instance
          </MenuItem>
          <MenuItem
            disabled={!degraded || !activeAlertId || acked}
            onSelect={() => {
              if (activeAlertId) {
                sendClientMessage({ type: "alert:action", alertId: activeAlertId, action: "acknowledge" });
                toast(`Acknowledged incident on ${inst.name}`);
              }
            }}
          >
            <Check size={13} /> Acknowledge incident
          </MenuItem>
          <MenuSeparator />
          <MenuItem
            onSelect={() => {
              sendClientMessage({ type: "instance:restart", instanceId: id });
              toast(`Restart initiated for ${inst.name}`);
            }}
          >
            <RotateCcw size={13} /> Restart instance
          </MenuItem>
          <MenuItem
            onSelect={() => {
              navigator.clipboard.writeText(inst.ip).then(
                () => toast(`Copied ${inst.ip}`),
                () => toast("Clipboard unavailable")
              );
            }}
          >
            <Copy size={13} /> Copy IP
          </MenuItem>
        </MenuContent>
      </Menu>
    </div>
  );
}

export const InstanceRow = memo(InstanceRowInner);
