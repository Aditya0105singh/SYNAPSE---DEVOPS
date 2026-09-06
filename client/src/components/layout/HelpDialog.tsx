import { AppDialog } from "../ui/Dialog";

const SHORTCUTS: [string, string][] = [
  ["⌘K / Ctrl+K", "Open command palette"],
  ["Ctrl+Shift+D", "Toggle demo control panel"],
  ["Esc", "Close palette / dialogs"],
  ["Tab / Enter", "Navigate and select table rows"],
];

export function HelpDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <AppDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Help & Support"
      description="Keyboard shortcuts and quick tips for driving the dashboard."
    >
      <div className="space-y-1.5">
        {SHORTCUTS.map(([keys, label]) => (
          <div key={keys} className="flex items-center justify-between rounded-md bg-surface-2 px-3 py-2">
            <span className="text-[12px] text-ink-body">{label}</span>
            <kbd className="rounded border border-surface-border bg-surface-3 px-2 py-0.5 font-mono text-[11px] text-ink-mute">
              {keys}
            </kbd>
          </div>
        ))}
      </div>
      <p className="mt-4 text-[11px] leading-relaxed text-ink-faint">
        Everything on this dashboard is driven by a mock incident engine streaming over WebSocket. Use the demo
        control panel to fire scripted incidents, or the command palette to jump anywhere without the mouse.
      </p>
    </AppDialog>
  );
}
