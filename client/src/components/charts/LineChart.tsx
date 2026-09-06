import { useMemo } from "react";

export interface LinePoint {
  t: number;
  v: number;
}

/**
 * Dependency-free SVG line chart for the metrics history buffer.
 * Fixed viewBox, responsive via width:100%; ~300 points max so no decimation needed.
 */
export function LineChart({
  data,
  color,
  unit,
  height = 120,
}: {
  data: LinePoint[];
  color: string;
  unit: string;
  height?: number;
}) {
  const W = 600;
  const H = 100;
  const PAD = 6;

  const { path, areaPath, min, max, latest } = useMemo(() => {
    if (data.length < 2) return { path: "", areaPath: "", min: 0, max: 0, latest: 0 };
    const values = data.map((d) => d.v);
    const lo = Math.min(...values);
    const hi = Math.max(...values);
    const span = hi - lo || 1;
    const step = (W - PAD * 2) / (data.length - 1);
    const y = (v: number) => H - PAD - ((v - lo) / span) * (H - PAD * 2);
    const pts = data.map((d, i) => `${(PAD + i * step).toFixed(1)},${y(d.v).toFixed(1)}`);
    return {
      path: `M${pts.join(" L")}`,
      areaPath: `M${PAD},${H - PAD} L${pts.join(" L")} L${(PAD + (data.length - 1) * step).toFixed(1)},${H - PAD} Z`,
      min: lo,
      max: hi,
      latest: values[values.length - 1],
    };
  }, [data]);

  if (data.length < 2) {
    return (
      <div className="grid h-[120px] place-items-center text-[11px] text-ink-faint">
        Collecting samples… charts fill in as history streams.
      </div>
    );
  }

  return (
    <div style={{ height }}>
      <div className="mb-1 flex items-baseline justify-between">
        <span className="tabular text-[15px] font-semibold text-ink-hi">
          {latest.toLocaleString(undefined, { maximumFractionDigits: 1 })}
          <span className="ml-1 text-[10px] font-medium text-ink-faint">{unit}</span>
        </span>
        <span className="tabular text-[10px] text-ink-faint">
          min {min.toFixed(1)} · max {max.toFixed(1)}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-[calc(100%-24px)] w-full">
        <path d={areaPath} style={{ fill: color, opacity: 0.08 }} />
        <path d={path} fill="none" style={{ stroke: color }} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}
