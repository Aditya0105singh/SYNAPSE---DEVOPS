import { useMemo } from "react";
import { Activity, Cpu, Timer, AlertTriangle } from "lucide-react";
import type { MetricsSnapshot } from "@synapse/shared";
import { useStore, type HudRange, type View } from "../../store/useStore";
import { formatDelta } from "../../lib/format";
import { cn } from "../../lib/cn";

const RANGES: HudRange[] = ["1H", "24H", "1W", "1M"];

/**
 * Range → how many trailing samples of the 1s-cadence history we aggregate.
 * The buffer holds ~5 minutes; ranges are demo-scaled windows over real stored
 * data (documented in the README) rather than render-time randomness.
 */
const RANGE_WINDOW: Record<HudRange, number> = { "1H": 1, "24H": 60, "1W": 180, "1M": 300 };

type NumericKey = "bandwidthTbps" | "avgCpuPct" | "p99LatencyMs" | "activeAlerts";

interface Aggregated {
  value: number;
  delta: number;
}

function aggregate(history: MetricsSnapshot[], key: NumericKey, window: number): Aggregated | null {
  if (!history.length) return null;
  const slice = history.slice(-window);
  const avg = slice.reduce((s, m) => s + m[key], 0) / slice.length;
  // delta: second half of the window vs first half
  const mid = Math.floor(slice.length / 2);
  if (mid === 0) {
    const latest = history[history.length - 1];
    return { value: latest[key], delta: 0 };
  }
  const firstAvg = slice.slice(0, mid).reduce((s, m) => s + m[key], 0) / mid;
  const secondAvg = slice.slice(mid).reduce((s, m) => s + m[key], 0) / (slice.length - mid);
  return { value: avg, delta: secondAvg - firstAvg };
}

function MetricTile({
  icon: Icon,
  iconBg,
  label,
  value,
  delta,
  deltaGoodDirection,
  targetView,
  targetAnchor,
}: {
  icon: typeof Activity;
  iconBg: string;
  label: string;
  value: string;
  delta: { text: string; positive: boolean };
  deltaGoodDirection: "up" | "down";
  targetView: View;
  targetAnchor?: string;
}) {
  const setView = useStore((s) => s.setView);
  const range = useStore((s) => s.hudRange);
  const isGood = deltaGoodDirection === "up" ? delta.positive : !delta.positive;
  return (
    <button
      onClick={() => {
        setView(targetView);
        if (targetAnchor) {
          // wait a frame for the view to mount before scrolling to the chart
          requestAnimationFrame(() => document.getElementById(targetAnchor)?.scrollIntoView({ behavior: "smooth" }));
        }
      }}
      className="flex-1 rounded-lg border border-surface-border bg-surface-2 p-4 text-left transition-colors hover:border-accent/40"
    >
      <div className="mb-3 flex items-center gap-2">
        <span className={cn("grid h-6 w-6 place-items-center rounded", iconBg)}>
          <Icon size={13} className="text-white" />
        </span>
        <span className="text-[11px] font-medium tracking-wide text-ink-faint">{label}</span>
      </div>
      <div className="mb-1 text-[26px] font-semibold tabular text-ink-hi">{value}</div>
      <div className={cn("text-[12px] font-medium", isGood ? "text-status-healthy" : "text-status-critical")}>
        {delta.text} {range === "1H" ? "vs last hour" : `avg over ${range} window`}
      </div>
    </button>
  );
}

export function GlobalHUD() {
  const metrics = useStore((s) => s.metrics);
  const history = useStore((s) => s.metricsHistory);
  const range = useStore((s) => s.hudRange);
  const setHudRange = useStore((s) => s.setHudRange);

  const window = RANGE_WINDOW[range];
  const live = range === "1H";

  const agg = useMemo(() => {
    if (live) return null;
    return {
      bandwidth: aggregate(history, "bandwidthTbps", window),
      cpu: aggregate(history, "avgCpuPct", window),
      latency: aggregate(history, "p99LatencyMs", window),
      alerts: aggregate(history, "activeAlerts", window),
    };
  }, [history, window, live]);

  const bandwidthValue = live ? metrics?.bandwidthTbps : agg?.bandwidth?.value;
  const cpuValue = live ? metrics?.avgCpuPct : agg?.cpu?.value;
  const latencyValue = live ? metrics?.p99LatencyMs : agg?.latency?.value;
  const alertsValue = live ? metrics?.activeAlerts : agg?.alerts?.value;

  return (
    <div className="rounded-lg border border-surface-border bg-surface-1 p-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-[13px] font-semibold tracking-wide text-ink-body">GLOBAL INFRASTRUCTURE HEALTH</h2>
        <div className="flex overflow-hidden rounded-md border border-surface-border" role="group" aria-label="Time range">
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setHudRange(r)}
              aria-pressed={r === range}
              className={cn(
                "px-2.5 py-1 text-[11px] font-medium",
                r === range ? "bg-surface-3 text-ink-hi" : "text-ink-faint hover:text-ink-body"
              )}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-3">
        <MetricTile
          icon={Activity}
          iconBg="bg-sky-500"
          label="NETWORK BANDWIDTH (TBPS)"
          value={bandwidthValue != null ? `${bandwidthValue.toFixed(1)} TBPS` : "—"}
          delta={formatDelta(
            live ? (metrics?.bandwidthDeltaPct ?? 0) : Math.round((agg?.bandwidth?.delta ?? 0) * 100) / 100,
            live ? "%" : " Tbps"
          )}
          deltaGoodDirection="up"
          targetView="performance"
          targetAnchor="bandwidth-chart"
        />
        <MetricTile
          icon={Cpu}
          iconBg="bg-accent"
          label="AVERAGE CPU LOAD (%)"
          value={cpuValue != null ? `${Math.round(cpuValue)}%` : "—"}
          delta={formatDelta(
            live ? (metrics?.avgCpuDeltaPct ?? 0) : Math.round((agg?.cpu?.delta ?? 0) * 10) / 10,
            "%"
          )}
          deltaGoodDirection="down"
          targetView="performance"
          targetAnchor="cpu-chart"
        />
        <MetricTile
          icon={Timer}
          iconBg="bg-emerald-500"
          label="P99 SYSTEM LATENCY"
          value={latencyValue != null ? `${Math.round(latencyValue)} MS` : "—"}
          delta={formatDelta(
            live ? (metrics?.p99LatencyDeltaMs ?? 0) : Math.round(agg?.latency?.delta ?? 0),
            "ms"
          )}
          deltaGoodDirection="down"
          targetView="performance"
          targetAnchor="latency-chart"
        />
        <MetricTile
          icon={AlertTriangle}
          iconBg="bg-status-critical"
          label="ACTIVE ALERTS"
          value={alertsValue != null ? `${Math.round(alertsValue)}` : "—"}
          delta={formatDelta(
            live ? (metrics?.activeAlertsDeltaPct ?? 0) : Math.round((agg?.alerts?.delta ?? 0) * 10) / 10,
            live ? "%" : ""
          )}
          deltaGoodDirection="down"
          targetView="alerts"
        />
      </div>
    </div>
  );
}
