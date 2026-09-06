import type { LogEvent } from "@synapse/shared";

function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function exportLogsAsJson(logs: LogEvent[]) {
  download(`synapse-logs-${Date.now()}.json`, JSON.stringify(logs, null, 2), "application/json");
}

export function exportLogsAsCsv(logs: LogEvent[]) {
  const header = "timestamp,instance,severity,message";
  const rows = logs.map((l) =>
    [new Date(l.ts).toISOString(), l.instanceName, l.severity, csvEscape(l.message)].join(",")
  );
  download(`synapse-logs-${Date.now()}.csv`, [header, ...rows].join("\n"), "text/csv");
}
