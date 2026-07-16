import { theme } from "antd";
import type { ThemeConfig } from "antd";
import type { Density, ThemeMode } from "./ui-preferences";

/**
 * Tema global de la aplicación. Única fuente de verdad para el `ConfigProvider`
 * (antes vivía inline en `main.tsx` con solo `colorPrimary`).
 *
 * - `token`: seed tokens globales (color de marca, radio, tipografía base).
 * - `components`: ajustes por componente. La densidad de tabla `middle` se fija
 *   aquí para que todos los listados compartan altura de fila sin repetir `size`.
 */
export const appTheme: ThemeConfig = {
  token: {
    colorPrimary: "#00b96b",
    borderRadius: 6,
    fontFamily: "Arial, sans-serif",
  },
  components: {
    Table: {
      // Densidad uniforme en todos los listados (equivale a size="middle").
      cellPaddingBlock: 10,
      cellPaddingInline: 12,
      headerBg: "#fafafa",
    },
    Tabs: {
      horizontalItemGutter: 24,
    },
  },
};

/**
 * Construye el tema final aplicando las preferencias del usuario.
 *
 * Los `algorithm` de Ant derivan toda la paleta a partir de los seed tokens, así
 * que el modo oscuro sale solo **siempre que nadie escriba colores a mano**: por
 * eso la limpieza de hexes es requisito de esta función y no un extra.
 */
export function buildTheme(mode: ThemeMode, density: Density): ThemeConfig {
  const algorithms = [mode === "dark" ? theme.darkAlgorithm : theme.defaultAlgorithm];
  if (density === "compact") algorithms.push(theme.compactAlgorithm);

  return {
    ...appTheme,
    algorithm: algorithms,
    components: {
      ...appTheme.components,
      Table: {
        ...appTheme.components?.Table,
        // El `headerBg` fijo delataría el modo claro sobre fondo oscuro; en oscuro
        // se deja que lo derive el algoritmo.
        ...(mode === "dark" ? { headerBg: undefined } : {}),
      },
    },
  };
}

/**
 * Breakpoint a partir del cual se considera "escritorio". Coincide con el `md`
 * (768 px) de Ant Design ya usado para el sidebar responsive. Centralizado aquí
 * para que `useIsMobile()` y los componentes compartidos lean el mismo valor.
 */
export const MOBILE_BREAKPOINT = "md" as const;
