import { memo, useState } from "react";
import { ChevronRight, Copy, Crosshair, StickyNote } from "lucide-react";
import type { LogEvent } from "@synapse/shared";
import { cn } from "../../lib/cn";
import { formatTime } from "../../lib/format";
import { useStore } from "../../store/useStore";
import { toast } from "../../lib/toast";
import { AppDialog } from "../ui/Dialog";

const SEVERITY_STYLES: Record<string, string> = {
  critical: "text-status-critical",
  warning: "text-status-medium",
  info: "text-status-info",
  debug: "text-ink-mute",
};

const SEVERITY_BADGE: Record<string, string> = {
  critical: "bg-status-critical/15 text-status-critical border-status-critical/30",
  warning: "bg-status-medium/15 text-status-medium border-status-medium/30",
  info: "bg-status-info/15 text-status-info border-status-info/30",
  debug: "bg-surface-3 text-ink-mute border-surface-border",
};

function NoteDialog({ log, open, onOpenChange }: { log: LogEvent; open: boolean; onOpenChange: (o: boolean) => void }) {
  const existing = useStore((s) => s.logNotes.get(log.id) ?? "");
  const setLogNote = useStore((s) => s.setLogNote);
  const [draft, setDraft] = useState(existing);

  return (
    <AppDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Incident note"
      description={`Triage note for ${log.instanceName} — stored locally against this log entry.`}
    >
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={4}
        autoFocus
        placeholder="e.g. Correlates with the 11:40 deploy — paging the ML platform team."
        className="w-full rounded-md border border-surface-border bg-surface-2 p-2.5 text-[12px] text-ink-body outline-none placeholder:text-ink-faint focus:border-accent/50"
      />
      <div className="mt-3 flex justify-end gap-2">
        <button
          onClick={() => onOpenChange(false)}
          className="rounded-md border border-surface-border px-3 py-1.5 text-[12px] font-medium text-ink-mute hover:text-ink-body"
        >
          Cancel
        </button>
        <button
          onClick={() => {
            setLogNote(log.id, draft);
            onOpenChange(false);
            toast(draft.trim() ? "Note saved" : "Note removed");
          }}
          className="rounded-md bg-accent px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-accent-soft"
        >
          Save note
        </button>
      </div>
    </AppDialog>
  );
}

function LogEntryInner({ log }: { log: LogEvent }) {
  const [open, setOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const hasDetail = !!log.detail;
  const hasNote = useStore((s) => s.logNotes.has(log.id));
  const note = useStore((s) => s.logNotes.get(log.id));
  const selectInstance = useStore((s) => s.selectInstance);
  const setView = useStore((s) => s.setView);
  const canNote = log.severity === "critical" || log.severity === "warning";

  return (
    <div className="group border-b border-surface-border/50 px-4 py-2 font-mono text-[11.5px] leading-relaxed">
      <div
        onClick={() => hasDetail && setOpen((o) => !o)}
        className={cn("flex items-start gap-2", hasDetail && "cursor-pointer")}
      >
        {hasDetail ? (
          <ChevronRight
            size={12}
            className={cn("mt-0.5 shrink-0 text-ink-faint transition-transform", open && "rotate-90")}
          />
        ) : (
          <span className="w-3 shrink-0" />
        )}
        <span className="shrink-0 text-ink-faint">{formatTime(log.ts)}</span>
        <span className="shrink-0 font-semibold text-ink-body">{log.instanceName}</span>
        <span
          className={cn(
            "shrink-0 rounded border px-1 py-px text-[9px] font-bold tracking-wide",
            SEVERITY_BADGE[log.severity]
          )}
        >
          {log.severity.toUpperCase()}
        </span>
        {hasNote && <StickyNote size={11} className="mt-0.5 shrink-0 text-accent" aria-label="Has note" />}
        <span className={cn("min-w-0 flex-1 truncate", SEVERITY_STYLES[log.severity])}>{log.message}</span>

        {/* hover actions */}
        <span className="hidden shrink-0 items-center gap-1 group-hover:flex">
          <button
            aria-label="Copy log line"
            onClick={(e) => {
              e.stopPropagation();
              navigator.clipboard
                .writeText(`${new Date(log.ts).toISOString()} ${log.instanceName} [${log.severity}] ${log.message}`)
                .then(
                  () => toast("Log line copied"),
                  () => toast("Clipboard unavailable")
                );
            }}
            className="grid h-5 w-5 place-items-center rounded text-ink-faint hover:bg-surface-3 hover:text-ink-body"
          >
            <Copy size={11} />
          </button>
          <button
            aria-label="Jump to instance"
            onClick={(e) => {
              e.stopPropagation();
              setView("issues");
              selectInstance(log.instanceId);
            }}
            className="grid h-5 w-5 place-items-center rounded text-ink-faint hover:bg-surface-3 hover:text-ink-body"
          >
            <Crosshair size={11} />
          </button>
          {canNote && (
            <button
              aria-label="Create incident note"
              onClick={(e) => {
                e.stopPropagation();
                setNoteOpen(true);
              }}
              className="grid h-5 w-5 place-items-center rounded text-ink-faint hover:bg-surface-3 hover:text-accent"
            >
              <StickyNote size={11} />
            </button>
          )}
        </span>
      </div>

      {hasNote && note && (
        <div className="ml-5 mt-1 rounded border border-accent/25 bg-accent/5 px-2 py-1 text-[10.5px] text-ink-mute">
          <span className="font-semibold text-accent">NOTE</span> {note}
        </div>
      )}

      {open && log.detail && (
        <pre className="scrollbar-thin mt-2 ml-5 max-w-full overflow-x-auto rounded-md border border-surface-border bg-surface-0 p-3 text-[11px] text-ink-mute">
{JSON.stringify(log.detail, null, 2)}
        </pre>
      )}

      {noteOpen && <NoteDialog log={log} open={noteOpen} onOpenChange={setNoteOpen} />}
    </div>
  );
}

export const LogEntry = memo(LogEntryInner);
