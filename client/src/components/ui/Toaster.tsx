import { useToastStore } from "../../lib/toast";

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  return (
    <div aria-live="polite" className="fixed bottom-5 left-1/2 z-[70] flex -translate-x-1/2 flex-col gap-2">
      {toasts.map((t) => (
        <button
          key={t.id}
          onClick={() => dismiss(t.id)}
          className="animate-toastIn rounded-md border border-surface-border bg-surface-2 px-4 py-2 text-[12px] font-medium text-ink-body shadow-panel"
        >
          {t.message}
        </button>
      ))}
    </div>
  );
}
