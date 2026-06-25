import { Grid } from "antd";
import { MOBILE_BREAKPOINT } from "../theme/tokens";

const { useBreakpoint } = Grid;

/**
 * Devuelve `true` en viewports móviles (por debajo del breakpoint `md`).
 *
 * Usa `screens.md === false` (no `!screens.md`) deliberadamente: en el primer
 * render `useBreakpoint()` aún no ha resuelto y todas las claves son `undefined`;
 * comparar con `false` evita el flash de "modo móvil" en escritorio. Misma
 * convención que el sidebar responsive (ver docs/client.md).
 */
export function useIsMobile(): boolean {
  const screens = useBreakpoint();
  return screens[MOBILE_BREAKPOINT] === false;
}
