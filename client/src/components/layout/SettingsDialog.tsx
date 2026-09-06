import { useState } from "react";
import { AppDialog } from "../ui/Dialog";
import { useStore } from "../../store/useStore";
import { cn } from "../../lib/cn";

function ToggleRow({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!value)}
      className="flex w-full items-center justify-between rounded-md bg-surface-2 px-3 py-2.5 text-left"
    >
      <span>
        <span className="block text-[12px] font-medium text-ink-body">{label}</span>
        <span className="block text-[11px] text-ink-faint">{hint}</span>
      </span>
      <span className={cn("h-4 w-7 shrink-0 rounded-full p-0.5 transition-colors", value ? "bg-accent/80" : "bg-surface-3")}>
        <span
          className={cn(
            "block h-3 w-3 rounded-full bg-white transition-transform",
            value ? "translate-x-3" : "translate-x-0"
          )}
        />
      </span>
    </button>
  );
}

export function SettingsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const theme = useStore((s) => s.theme);
  const toggleTheme = useStore((s) => s.toggleTheme);
  const signalOverNoise = useStore((s) => s.signalOverNoise);
  const toggleSignal = useStore((s) => s.toggleSignalOverNoise);
  // session-local preferences: intentionally not persisted, this is a demo environment
  const [desktopNotifs, setDesktopNotifs] = useState(false);
  const [soundOnCritical, setSoundOnCritical] = useState(false);

  return (
    <AppDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Settings"
      description="Session preferences. Theme persists across reloads; the rest reset per session."
    >
      <div className="space-y-2">
        <ToggleRow
          label="Dark theme"
          hint="Switch between the dark and light palettes"
          value={theme === "dark"}
          onChange={() => toggleTheme()}
        />
        <ToggleRow
          label="Signal over noise"
          hint="Hide healthy instances in the instance table"
          value={signalOverNoise}
          onChange={() => toggleSignal()}
        />
        <ToggleRow
          label="Desktop notifications"
          hint="Mock preference — wiring browser notifications is out of scope"
          value={desktopNotifs}
          onChange={setDesktopNotifs}
        />
        <ToggleRow
          label="Sound on critical alert"
          hint="Mock preference for the demo environment"
          value={soundOnCritical}
          onChange={setSoundOnCritical}
        />
      </div>
    </AppDialog>
  );
}
