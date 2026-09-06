import { useMemo } from "react";
import type { InstanceStatus } from "@synapse/shared";
import { useStore } from "../store/useStore";
import { StatusBadge } from "../components/instances/StatusBadge";
import { formatUptime } from "../lib/format";
import { cn } from "../lib/cn";

const DONUT_ORDER: InstanceStatus[] = ["critical", "high", "medium", "deploying", "healthy", "offline"];

function StatusDonut() {
  const instances = useStore((s) => s.instances);
  const counts = useMemo(() => {
    const c = new Map<InstanceStatus, number>();
    for (const inst of instances.values()) c.set(inst.status, (c.get(inst.status) ?? 0) + 1);
    return c;
  }, [instances]);

  const total = instances.size || 1;
  const R = 40;
  const CIRC = 2 * Math.PI * R;
  const segments = useMemo(() => {
    const present = DONUT_ORDER.filter((s) => (counts.get(s) ?? 0) > 0);
    const arcs = present.map((status) => ((counts.get(status) ?? 0) / total) * CIRC);
    return present.map((status, i) => ({
      status,
      dash: arcs[i],
      offset: arcs.slice(0, i).reduce((a, b) => a + b, 0),
    }));
  }, [counts, total, CIRC]);

  return (
    <div className="flex items-center gap-6">
      <svg viewBox="0 0 100 100" className="h-32 w-32 -rotate-90">
        <circle cx="50" cy="50" r={R} fill="none" strokeWidth="12" className="stroke-surface-3" />
        {segments.map((seg) => (
          <circle
            key={seg.status}
            cx="50"
            cy="50"
            r={R}
            fill="none"
            strokeWidth="12"
            style={{ stroke: `rgb(var(--status-${seg.status}))` }}
            strokeDasharray={`${seg.dash} ${CIRC - seg.dash}`}
            strokeDashoffset={-seg.offset}
          />
        ))}
      </svg>
      <div className="space-y-1">
        {DONUT_ORDER.map((status) => (
          <div key={status} className="flex items-center gap-2 text-[12px]">
            <span className="h-2 w-2 rounded-full" style={{ background: `rgb(var(--status-${status}))` }} />
            <span className="w-20 uppercase tracking-wide text-ink-mute">{status}</span>
            <span className="tabular font-semibold text-ink-hi">{counts.get(status) ?? 0}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function NoisiestInstances() {
  const logs = useStore((s) => s.logs);
  const instances = useStore((s) => s.instances);
  const selectInstance = useStore((s) => s.selectInstance);
  const setView = useStore((s) => s.setView);

  const top = useMemo(() => {
    const counts = new Map<string, number>();
    for (const l of logs) counts.set(l.instanceId, (counts.get(l.instanceId) ?? 0) + 1);
    return [...counts.entries()]
      .map(([id, n]) => ({ inst: instances.get(id), n }))
      .filter((x) => x.inst)
      .sort((a, b) => b.n - a.n)
      .slice(0, 5);
  }, [logs, instances]);

  const maxN = top[0]?.n ?? 1;

  return (
    <div className="space-y-2">
      {top.map(({ inst, n }) => (
        <button
          key={inst!.id}
          onClick={() => {
            setView("issues");
            selectInstance(inst!.id);
          }}
          className="block w-full text-left"
        >
          <div className="mb-0.5 flex items-center justify-between text-[12px]">
            <span className="font-medium text-ink-body">{inst!.name}</span>
            <span className="tabular text-ink-faint">{n.toLocaleString()} events</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded bg-surface-3">
            <div className="h-full rounded bg-accent" style={{ width: `${(n / maxN) * 100}%` }} />
          </div>
        </button>
      ))}
      {top.length === 0 && <div className="text-[12px] text-ink-faint">No events yet.</div>}
    </div>
  );
}

function UptimeLeaderboard() {
  const instances = useStore((s) => s.instances);
  const sorted = useMemo(
    () => [...instances.values()].sort((a, b) => b.uptimeSec - a.uptimeSec).slice(0, 5),
    [instances]
  );
  return (
    <div className="space-y-1.5">
      {sorted.map((inst, i) => (
        <div key={inst.id} className="flex items-center gap-3 rounded-md bg-surface-2 px-3 py-2 text-[12px]">
          <span
            className={cn(
              "grid h-5 w-5 shrink-0 place-items-center rounded font-mono text-[10px] font-bold",
              i === 0 ? "bg-accent/20 text-accent" : "bg-surface-3 text-ink-mute"
            )}
          >
            {i + 1}
          </span>
          <span className="min-w-0 flex-1 truncate font-medium text-ink-body">{inst.name}</span>
          <StatusBadge status={inst.status} />
          <span className="tabular w-16 text-right text-ink-mute">{formatUptime(inst.uptimeSec)}</span>
        </div>
      ))}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-surface-border bg-surface-1 p-5">
      <h2 className="mb-4 text-[13px] font-semibold tracking-wide text-ink-body">{title}</h2>
      {children}
    </div>
  );
}

export function OverviewView() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="FLEET STATUS">
        <StatusDonut />
      </Panel>
      <Panel title="TOP 5 NOISIEST INSTANCES">
        <NoisiestInstances />
      </Panel>
      <div className="lg:col-span-2">
        <Panel title="UPTIME LEADERBOARD">
          <UptimeLeaderboard />
        </Panel>
      </div>
    </div>
  );
}
