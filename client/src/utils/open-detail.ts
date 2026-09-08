/**
 * Abre una ruta de detalle en una pestaña nueva.
 *
 * Es la acción del DOBLE clic en la convención de navegación de la app (ver
 * `utils/click-navigation.ts` y docs/client.md) — el clic simple navega en la
 * misma pestaña. Centraliza el `window.open(...)` que antes estaba copiado
 * con flags ligeramente distintos por toda la app; sigue usándose también
 * suelto para acciones puntuales que deliberadamente abren pestaña nueva.
 *
 * @param path Ruta absoluta de la app (p. ej. `/users/123`) o URL completa.
 */
export function openDetail(path: string): void {
  const url = path.startsWith("http") ? path : `${window.location.origin}${path}`;
  window.open(url, "_blank", "noopener,noreferrer");
}
