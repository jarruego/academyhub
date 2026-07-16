import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

/**
 * Preferencias de interfaz del usuario (tema y densidad).
 *
 * Viven en `localStorage`, no en la BD: son una preferencia del puesto de trabajo
 * (quien usa la app en un portátil de noche quiere oscuro; el mismo usuario en el
 * PC de oficina, claro). Guardarlas en `organization_settings` las haría globales
 * a toda la organización, que es justo lo contrario de lo que se quiere.
 */

export type ThemeMode = "light" | "dark";
export type Density = "comfortable" | "compact";

export interface UiPreferences {
  mode: ThemeMode;
  density: Density;
}

interface UiPreferencesContextValue extends UiPreferences {
  setMode: (mode: ThemeMode) => void;
  setDensity: (density: Density) => void;
  toggleMode: () => void;
}

const STORAGE_KEY = "academyhub.ui-preferences";

const DEFAULTS: UiPreferences = { mode: "light", density: "comfortable" };

/**
 * Lee las preferencias guardadas. Tolera JSON corrupto y valores desconocidos
 * (p. ej. de una versión anterior): ante la duda, se cae a los defaults.
 */
export function readStoredPreferences(raw: string | null): UiPreferences {
  if (!raw) return DEFAULTS;
  try {
    const parsed = JSON.parse(raw) as Partial<UiPreferences>;
    return {
      mode: parsed.mode === "dark" ? "dark" : "light",
      density: parsed.density === "compact" ? "compact" : "comfortable",
    };
  } catch {
    return DEFAULTS;
  }
}

const UiPreferencesContext = createContext<UiPreferencesContextValue | null>(null);

export function UiPreferencesProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<UiPreferences>(() =>
    readStoredPreferences(typeof window === "undefined" ? null : window.localStorage.getItem(STORAGE_KEY)),
  );

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch {
      // Modo privado o cuota llena: la preferencia sigue viva en memoria.
    }
  }, [prefs]);

  const setMode = useCallback((mode: ThemeMode) => setPrefs((p) => ({ ...p, mode })), []);
  const setDensity = useCallback((density: Density) => setPrefs((p) => ({ ...p, density })), []);
  const toggleMode = useCallback(
    () => setPrefs((p) => ({ ...p, mode: p.mode === "dark" ? "light" : "dark" })),
    [],
  );

  const value = useMemo(
    () => ({ ...prefs, setMode, setDensity, toggleMode }),
    [prefs, setMode, setDensity, toggleMode],
  );

  return <UiPreferencesContext.Provider value={value}>{children}</UiPreferencesContext.Provider>;
}

export function useUiPreferences(): UiPreferencesContextValue {
  const ctx = useContext(UiPreferencesContext);
  if (!ctx) throw new Error("useUiPreferences debe usarse dentro de <UiPreferencesProvider>");
  return ctx;
}
