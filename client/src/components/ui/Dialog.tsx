import * as RadixDialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";

export function AppDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  wide,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-50 bg-black/60" />
        <RadixDialog.Content
          className={`fixed left-1/2 top-1/2 z-50 w-full ${wide ? "max-w-2xl" : "max-w-md"} -translate-x-1/2 -translate-y-1/2 rounded-lg border border-surface-border bg-surface-1 p-5 shadow-panel focus:outline-none`}
        >
          <div className="mb-3 flex items-start justify-between">
            <div>
              <RadixDialog.Title className="text-[14px] font-semibold text-ink-hi">{title}</RadixDialog.Title>
              {description && (
                <RadixDialog.Description className="mt-1 text-[12px] text-ink-mute">
                  {description}
                </RadixDialog.Description>
              )}
            </div>
            <RadixDialog.Close asChild>
              <button
                aria-label="Close dialog"
                className="grid h-7 w-7 place-items-center rounded-md text-ink-mute hover:bg-surface-3 hover:text-ink-hi"
              >
                <X size={15} />
              </button>
            </RadixDialog.Close>
          </div>
          {children}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
