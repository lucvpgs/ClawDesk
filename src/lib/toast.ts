type ToastType = "success" | "error" | "info" | "warning";
type Toast = { id: string; message: string; type: ToastType };
type Listener = (toasts: Toast[]) => void;

let toasts: Toast[] = [];
const listeners: Set<Listener> = new Set();

function notify() {
  listeners.forEach((l) => l([...toasts]));
}

export function toast(message: string, type: ToastType = "info") {
  const id = Math.random().toString(36).slice(2);
  toasts = [...toasts, { id, message, type }];
  notify();
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id);
    notify();
  }, 3500);
}

export function subscribeToasts(listener: Listener) {
  listeners.add(listener);
  listener([...toasts]);
  return () => listeners.delete(listener);
}
