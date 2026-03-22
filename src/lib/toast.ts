type ToastType = "success" | "error" | "info" | "warning";
type Toast = { id: string; message: string; type: ToastType };

export interface HistoryItem {
  id: string;
  message: string;
  type: ToastType;
  timestamp: number;
}

type Listener = (toasts: Toast[]) => void;
type HistoryListener = (history: HistoryItem[]) => void;

let toasts: Toast[] = [];
let history: HistoryItem[] = [];
const listeners: Set<Listener> = new Set();
const historyListeners: Set<HistoryListener> = new Set();

function notify() {
  listeners.forEach((l) => l([...toasts]));
}

function notifyHistory() {
  historyListeners.forEach((l) => l([...history]));
}

export function toast(message: string, type: ToastType = "info") {
  const id = Math.random().toString(36).slice(2);
  // Add to ephemeral toasts
  toasts = [...toasts, { id, message, type }];
  notify();
  // Add to persistent history (max 50 entries)
  history = [{ id, message, type, timestamp: Date.now() }, ...history].slice(0, 50);
  notifyHistory();
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

export function subscribeHistory(listener: HistoryListener) {
  historyListeners.add(listener);
  listener([...history]);
  return () => historyListeners.delete(listener);
}

export function clearHistory() {
  history = [];
  notifyHistory();
}
