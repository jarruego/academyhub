/**
 * Abre una ruta de detalle en una pestaña nueva.
 *
 * Gesto de navegación único de los listados (decisión de diseño): un clic simple
 * en una fila abre el detalle en pestaña nueva. Centraliza el `window.open(...)`
 * que antes estaba copiado con flags ligeramente distintos por toda la app.
 *
 * @param path Ruta absoluta de la app (p. ej. `/users/123`) o URL completa.
 */
export function openDetail(path: string): void {
  const url = path.startsWith("http") ? path : `${window.location.origin}${path}`;
  window.open(url, "_blank", "noopener,noreferrer");
}
