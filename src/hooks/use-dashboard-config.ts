"use client";

import { useState, useEffect, useCallback } from "react";

export interface WidgetConfig {
  id: string;
  hidden: boolean;
}

export interface DashboardConfig {
  statCards: WidgetConfig[];
  panels: WidgetConfig[];
}

export const DEFAULT_STAT_CARDS: WidgetConfig[] = [
  { id: "gateway",  hidden: false },
  { id: "model",    hidden: false },
  { id: "tasks",    hidden: false },
  { id: "journal",  hidden: false },
];

export const DEFAULT_PANELS: WidgetConfig[] = [
  { id: "agents",    hidden: false },
  { id: "tasks",     hidden: false },
  { id: "schedules", hidden: false },
  { id: "activity",  hidden: false },
];

export const STAT_CARD_LABELS: Record<string, string> = {
  gateway:  "Gateway",
  model:    "Primary model",
  tasks:    "Tasks",
  journal:  "Journal today",
};

export const PANEL_LABELS: Record<string, string> = {
  agents:    "Agents",
  tasks:     "Active tasks",
  schedules: "Upcoming schedules",
  activity:  "Recent activity",
};

const STORAGE_KEY = "clawdesk:dashboard-config";

function loadConfig(): DashboardConfig {
  if (typeof window === "undefined") return { statCards: DEFAULT_STAT_CARDS, panels: DEFAULT_PANELS };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { statCards: DEFAULT_STAT_CARDS, panels: DEFAULT_PANELS };
    const parsed = JSON.parse(raw) as DashboardConfig;
    // Merge with defaults to handle new widgets added in future versions
    const mergeList = (saved: WidgetConfig[], defaults: WidgetConfig[]): WidgetConfig[] => {
      const savedMap = new Map(saved.map((w) => [w.id, w]));
      // Start with saved order, add any new defaults at the end
      const result = saved.filter((w) => defaults.some((d) => d.id === w.id));
      defaults.forEach((d) => { if (!savedMap.has(d.id)) result.push(d); });
      return result;
    };
    return {
      statCards: mergeList(parsed.statCards ?? [], DEFAULT_STAT_CARDS),
      panels:    mergeList(parsed.panels    ?? [], DEFAULT_PANELS),
    };
  } catch { return { statCards: DEFAULT_STAT_CARDS, panels: DEFAULT_PANELS }; }
}

export function useDashboardConfig() {
  const [config, setConfig] = useState<DashboardConfig>(() => loadConfig());

  // Persist to localStorage on every change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  }, [config]);

  const toggleWidget = useCallback((section: "statCards" | "panels", id: string) => {
    setConfig((prev) => ({
      ...prev,
      [section]: prev[section].map((w) => w.id === id ? { ...w, hidden: !w.hidden } : w),
    }));
  }, []);

  const movePanel = useCallback((id: string, dir: "up" | "down") => {
    setConfig((prev) => {
      const arr = [...prev.panels];
      const idx = arr.findIndex((w) => w.id === id);
      if (idx < 0) return prev;
      const target = dir === "up" ? idx - 1 : idx + 1;
      if (target < 0 || target >= arr.length) return prev;
      [arr[idx], arr[target]] = [arr[target], arr[idx]];
      return { ...prev, panels: arr };
    });
  }, []);

  const reset = useCallback(() => {
    setConfig({ statCards: DEFAULT_STAT_CARDS, panels: DEFAULT_PANELS });
  }, []);

  return { config, toggleWidget, movePanel, reset };
}
