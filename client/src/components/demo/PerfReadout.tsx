import { useEffect, useState } from "react";
import { useStore } from "../../store/useStore";

export function PerfReadout({ open }: { open: boolean }) {
  const eventsPerSec = useStore((s) => s.eventsPerSec);
  const logCount = useStore((s) => s.logs.length);
  const instanceCount = useStore((s) => s.instances.size);
  const [fps, setFps] = useState(60);
  const [domNodes, setDomNodes] = useState(0);

  useEffect(() => {
    if (!open) return;
    let frames = 0;
    let last = performance.now();
    let raf = 0;
    const loop = (now: number) => {
      frames++;
      if (now - last >= 1000) {
        setFps(frames);
        frames = 0;
        last = now;
        setDomNodes(document.querySelectorAll("[data-log-row], [data-instance-row]").length || document.getElementsByTagName("*").length);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed bottom-5 left-[236px] z-50 rounded-lg border border-surface-border bg-surface-1/95 px-4 py-3 font-mono text-[11px] text-ink-mute shadow-panel backdrop-blur">
      <div className="mb-1.5 text-[10px] font-semibold tracking-wide text-ink-faint">PERFORMANCE</div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        <span>FPS</span>
        <span className="text-status-healthy">{fps}</span>
        <span>Events/sec</span>
        <span className="text-accent">{eventsPerSec}</span>
        <span>Logs in buffer</span>
        <span>{logCount.toLocaleString()}</span>
        <span>Instances tracked</span>
        <span>{instanceCount}</span>
        <span>DOM nodes</span>
        <span className="text-status-info">{domNodes}</span>
      </div>
    </div>
  );
}
