import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { UnitBase } from "./format";
import { isWindows } from "./platform";
import type { Lang } from "./i18n";
import { detectLang } from "./i18n";

export type ChartKind = "sunburst" | "treemap";

export interface Settings {
  lang: Lang;
  unitBase: UnitBase;
  exclude: string[];
  checkUpdates: boolean;
  chart: ChartKind;
}

const KEY = "squirreldisk.settings.v1";

const defaults = (): Settings => ({
  lang: detectLang(),
  unitBase: isWindows ? 1024 : 1000,
  exclude: [],
  checkUpdates: true,
  chart: "sunburst",
});

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...defaults(), ...JSON.parse(raw) };
  } catch {
    // Storage unavailable or corrupted: fall back to defaults.
  }
  return defaults();
}

interface SettingsContextValue {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(load);
  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        // Ignore: settings just won't persist.
      }
      return next;
    });
  }, []);
  const value = useMemo(() => ({ settings, update }), [settings, update]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings outside SettingsProvider");
  return ctx;
}
