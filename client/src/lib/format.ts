export function formatUptime(sec: number): string {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  return `${d}D ${String(h).padStart(2, "0")}H`;
}

export function formatDelta(v: number, unit = "%"): { text: string; positive: boolean } {
  const positive = v >= 0;
  return { text: `${positive ? "+" : ""}${v}${unit}`, positive };
}

export function formatTime(ts: number): string {
  const d = new Date(ts);
  let h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
}

export function formatRelative(ts: number): string {
  const diff = Math.max(0, Date.now() - ts);
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  return `${Math.floor(diff / 3_600_000)}h ago`;
}

export const STATUS_LABEL: Record<string, string> = {
  healthy: "HEALTHY",
  medium: "MEDIUM",
  high: "HIGH",
  critical: "CRITICAL",
  offline: "OFFLINE",
  deploying: "DEPLOYING",
};
