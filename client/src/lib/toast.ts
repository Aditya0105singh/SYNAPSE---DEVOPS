import { create } from "zustand";

interface Toast {
  id: number;
  message: string;
}

interface ToastStore {
  toasts: Toast[];
  push: (message: string) => void;
  dismiss: (id: number) => void;
}

let nextId = 1;

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  push: (message) => {
    const id = nextId++;
    set((s) => ({ toasts: [...s.toasts, { id, message }].slice(-4) }));
    setTimeout(() => {
      useToastStore.getState().dismiss(id);
    }, 3200);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export function toast(message: string) {
  useToastStore.getState().push(message);
}
