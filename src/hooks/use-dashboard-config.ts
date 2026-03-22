"use client";

import { useState, useEffect, useCallback } from "react";
import { DEFAULT_SLOT_METRICS } from "@/lib/dashboard-metrics";

export interface SlotConfig {
  metricId: string;
  hidden: boolean;
}

export interface WidgetConfig {
  id: string;
  hidden: boolean;
}

export interface DashboardConfig {
  slots: SlotConfig[];   // 4 configurable stat card slots
  panels: WidgetConfig[];
}

export const DEFAULT_PANELS: WidgetConfig[] = [
  { id: "agents",    hidden: false },
  { id: "tasks",     hidden: false },
  { id: "schedules", hidden: false },
  { id: "activity",  hidden: false },
];

export const PANEL_LABELS: Record<string, string> = {
  agents:    "Agents",
  tasks:     "Active tasks",
  schedules: "Upcoming schedules",
  activity:  "Recent activity",
};

const STORAGE_KEY = "clawdesk:dashboard-config-v2";

function defaultConfig(): DashboardConfig {
  return {
    slots:  DEFAULT_SLOT_METRICS.map((metricId) => ({ metricId, hidden: false })),
    panels: DEFAULT_PANELS,
  };
}

function loadConfig(): DashboardConfig {
  if (typeof window === "undefined") return defaultConfig();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultConfig();
    const parsed = JSON.parse(raw) as DashboardConfig;
    // Ensure we always have exactly 4 slots
    const slots = (parsed.slots ?? []).slice(0, 4);
    while (slots.length < 4) slots.push({ metricId: "tasks-active", hidden: false });
    // Merge panels with defaults
    const savedPanelMap = new Map((parsed.panels ?? []).map((w) => [w.id, w]));
    const panels = DEFAULT_PANELS.map((d) => savedPanelMap.get(d.id) ?? d);
    // Preserve saved order
    const savedOrder = (parsed.panels ?? []).filter((w) => panels.some((p) => p.id === w.id));
    const finalPanels = savedOrder.length === panels.length ? savedOrder : panels;
    return { slots, panels: finalPanels };
  } catch { return defaultConfig(); }
}

export function useDashboardConfig() {
  const [config, setConfig] = useState<DashboardConfig>(() => loadConfig());

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  }, [config]);

  const setSlotMetric = useCallback((slotIdx: number, metricId: string) => {
    setConfig((prev) => {
      const slots = prev.slots.map((s, i) => i === slotIdx ? { ...s, metricId } : s);
      return { ...prev, slots };
    });
  }, []);

  const toggleSlot = useCallback((slotIdx: number) => {
    setConfig((prev) => {
      const slots = prev.slots.map((s, i) => i === slotIdx ? { ...s, hidden: !s.hidden } : s);
      return { ...prev, slots };
    });
  }, []);

  const togglePanel = useCallback((id: string) => {
    setConfig((prev) => ({
      ...prev,
      panels: prev.panels.map((w) => w.id === id ? { ...w, hidden: !w.hidden } : w),
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

  const reset = useCallback(() => setConfig(defaultConfig()), []);

  return { config, setSlotMetric, toggleSlot, togglePanel, movePanel, reset };
}
