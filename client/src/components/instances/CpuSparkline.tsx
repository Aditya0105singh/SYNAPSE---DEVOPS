import { useMemo } from "react";
import type { CpuSample } from "@synapse/shared";

export function CpuSparkline({ data, color }: { data: CpuSample[]; color: string }) {
  const path = useMemo(() => {
    if (!data.length) return "";
    const w = 56;
    const h = 20;
    const max = 100;
    const step = w / Math.max(1, data.length - 1);
    return data
      .map((d, i) => `${i === 0 ? "M" : "L"}${(i * step).toFixed(1)},${(h - (d.v / max) * h).toFixed(1)}`)
      .join(" ");
  }, [data]);

  return (
    <svg width={56} height={20} viewBox="0 0 56 20" className="overflow-visible" aria-hidden="true">
      <path
        d={path}
        fill="none"
        style={{ stroke: color }}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
