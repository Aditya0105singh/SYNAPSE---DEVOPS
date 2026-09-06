import { useEffect, useMemo, useState } from "react";
import { Zap, X, RotateCcw, Gauge } from "lucide-react";
import { INCIDENT_SCENARIOS } from "@synapse/shared";
import { useStore } from "../../store/useStore";
import { sendClientMessage } from "../../hooks/useSocket";
import { toast } from "../../lib/toast";

export function DemoPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const instances = useStore((s) => s.instances);
  const [firing, setFiring] = useState<string | null>(null);
  const [targetId, setTargetId] = useState<string>("auto");

  const instanceOptions = useMemo(() => [...instances.values()].map((i) => ({ id: i.id, name: i.name })), [instances]);

  useEffect(() => {
    if (!firing) return;
    const t = setTimeout(() => setFiring(null), 1200);
    return () => clearTimeout(t);
  }, [firing]);

  if (!open) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 w-80 overflow-hidden rounded-lg border border-accent/30 bg-surface-1 shadow-glow">
      <div className="flex items-center justify-between border-b border-surface-border bg-surface-2 px-4 py-2.5">
        <span className="flex items-center gap-2 text-[12px] font-semibold tracking-wide text-accent">
          <Zap size={13} />
          DEMO CONTROL PANEL
        </span>
        <button onClick={onClose} aria-label="Close demo panel" className="text-ink-faint hover:text-ink-body">
          <X size={14} />
        </button>
      </div>
      <div className="p-3">
        <p className="mb-3 text-[11px] leading-snug text-ink-faint">
          Fire a scripted incident on demand — the whole dashboard reacts live: status, sparkline, HUD alerts, and
          the log stream.
        </p>

        <label className="mb-1 block text-[10px] font-semibold tracking-wide text-ink-faint" htmlFor="demo-target">
          TARGET INSTANCE
        </label>
        <select
          id="demo-target"
          value={targetId}
          onChange={(e) => setTargetId(e.target.value)}
          className="mb-3 w-full rounded-md border border-surface-border bg-surface-2 px-2 py-1.5 text-[12px] text-ink-body outline-none focus:border-accent/50"
        >
          <option value="auto">Auto-pick a matching instance</option>
          {instanceOptions.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>

        <div className="space-y-1.5">
          {INCIDENT_SCENARIOS.map((s) => (
            <button
              key={s.id}
              onClick={() => {
                setFiring(s.id);
                sendClientMessage({
                  type: "trigger:incident",
                  scenarioId: s.id,
                  instanceId: targetId !== "auto" && s.id !== "recover_all" ? targetId : undefined,
                });
              }}
              className="flex w-full items-center gap-2 rounded-md border border-surface-border bg-surface-2 px-3 py-2 text-left text-[12px] font-medium text-ink-body transition-colors hover:border-accent/40 hover:bg-accent/10 hover:text-accent disabled:opacity-50"
              disabled={firing === s.id}
            >
              {s.id === "recover_all" ? <RotateCcw size={13} /> : <Zap size={13} className="shrink-0" />}
              {firing === s.id ? "Firing…" : s.label}
            </button>
          ))}

          <button
            onClick={() => {
              sendClientMessage({ type: "trigger:stress" });
              toast("Stress test: ~25 logs/sec for 15s — watch the perf readout");
            }}
            className="flex w-full items-center gap-2 rounded-md border border-status-info/30 bg-status-info/10 px-3 py-2 text-left text-[12px] font-medium text-status-info transition-colors hover:bg-status-info/20"
          >
            <Gauge size={13} className="shrink-0" />
            Stress test (25 logs/s × 15s)
          </button>
        </div>
      </div>
    </div>
  );
}
