import { useStore } from "../store/useStore";
import { LineChart } from "../components/charts/LineChart";

function ChartPanel({
  id,
  title,
  color,
  unit,
  selector,
}: {
  id: string;
  title: string;
  color: string;
  unit: string;
  selector: "avgCpuPct" | "p99LatencyMs" | "bandwidthTbps";
}) {
  const history = useStore((s) => s.metricsHistory);
  const data = history.map((m) => ({ t: m.ts, v: m[selector] }));

  return (
    <div id={id} className="rounded-lg border border-surface-border bg-surface-1 p-5">
      <h2 className="mb-3 text-[13px] font-semibold tracking-wide text-ink-body">{title}</h2>
      <LineChart data={data} color={color} unit={unit} />
    </div>
  );
}

export function PerformanceView() {
  const sampleCount = useStore((s) => s.metricsHistory.length);
  return (
    <div className="space-y-4">
      <p className="text-[11px] text-ink-faint">
        Rolling window of the last {sampleCount.toLocaleString()} metric snapshots (1 sample/sec, capped at 300),
        streamed from the server's in-memory history buffer.
      </p>
      <ChartPanel
        id="cpu-chart"
        title="AVERAGE CPU LOAD"
        color="rgb(var(--status-high))"
        unit="%"
        selector="avgCpuPct"
      />
      <ChartPanel
        id="latency-chart"
        title="P99 SYSTEM LATENCY"
        color="rgb(var(--status-healthy))"
        unit="ms"
        selector="p99LatencyMs"
      />
      <ChartPanel
        id="bandwidth-chart"
        title="NETWORK BANDWIDTH"
        color="rgb(var(--status-info))"
        unit="Tbps"
        selector="bandwidthTbps"
      />
    </div>
  );
}
