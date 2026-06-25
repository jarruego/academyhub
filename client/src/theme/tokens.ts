import type { ThemeConfig } from "antd";

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
 * Breakpoint a partir del cual se considera "escritorio". Coincide con el `md`
 * (768 px) de Ant Design ya usado para el sidebar responsive. Centralizado aquí
 * para que `useIsMobile()` y los componentes compartidos lean el mismo valor.
 */
export const MOBILE_BREAKPOINT = "md" as const;
