import { useCallback, useRef } from "react";
import { useNavigate, type NavigateFunction } from "react-router-dom";
import { openDetail } from "./open-detail";

/**
 * Convención de navegación de toda la app (ver docs/client.md "Table
 * navigation"): un clic simple navega en la MISMA pestaña; un doble clic abre
 * el detalle en una pestaña NUEVA. Antes era al revés (un solo clic ya abría
 * pestaña nueva vía `openDetail`) — se invirtió porque generaba demasiadas
 * pestañas. Las excepciones puntuales se añaden caso a caso, no aquí.
 *
 * El clic simple se retrasa `DOUBLE_CLICK_WINDOW_MS` para poder cancelarlo si
 * llega un segundo clic (evita navegar y abrir pestaña nueva a la vez en un
 * doble clic real). Los clics modificados (Ctrl/Cmd/Mayús/Alt) o que no sean
 * el botón izquierdo se dejan pasar sin intervenir, para no romper el gesto
 * nativo del navegador de abrir en pestaña nueva.
 */
export const DOUBLE_CLICK_WINDOW_MS = 250;

function isPlainLeftClick(e: React.MouseEvent): boolean {
  return e.button === 0 && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey;
}

export interface LinkClickHandlers {
  onClick?: (e: React.MouseEvent) => void;
  onDoubleClick?: (e: React.MouseEvent) => void;
}

/**
 * Fábrica de handlers sin hooks: recibe `navigate` y un ref de temporizador
 * obtenidos una única vez (arriba, con `useLinkNavigation()`), para poder
 * construir los handlers de cada fila dentro de un `.map()` o de
 * `Table.onRow`/`onCell`, donde no se pueden llamar hooks por iteración.
 */
export function makeLinkClickHandlers(
  navigate: NavigateFunction,
  timerRef: React.MutableRefObject<number | undefined>,
  url: string | undefined,
): LinkClickHandlers {
  if (!url) return {};
  return {
    onClick: (e) => {
      if (!isPlainLeftClick(e)) return;
      e.preventDefault();
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        timerRef.current = undefined;
        navigate(url);
      }, DOUBLE_CLICK_WINDOW_MS);
    },
    onDoubleClick: (e) => {
      e.preventDefault();
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = undefined;
      }
      openDetail(url);
    },
  };
}

/**
 * Hook: obtiene `navigate` y el ref del temporizador una sola vez, y devuelve
 * una función `linkTo(url)` lista para usar (en JSX directo o dentro de un
 * `.map()`/`onRow`/`onCell`).
 *
 * Uso directo: `<a {...linkTo(url)}>texto</a>` (o `<Link to={url} {...linkTo(url)}>`).
 * Dentro de una tabla: `onRow={(record) => linkTo(getUrl(record))}`.
 */
export function useLinkNavigation() {
  const navigate = useNavigate();
  const timerRef = useRef<number | undefined>(undefined);
  return useCallback((url: string | undefined) => makeLinkClickHandlers(navigate, timerRef, url), [navigate]);
}
