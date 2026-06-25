import { useRef, type ReactNode } from "react";
import useTableScroll from "../../hooks/use-table-scroll";

interface ListPageLayoutProps {
  /** Controles del listado (búsqueda, filtros, botón de añadir). */
  toolbar: ReactNode;
  /**
   * Contenido (la tabla). Si es una función, recibe la altura calculada para el
   * scroll vertical interno (`scrollY`) — úsalo en listados de altura fija
   * paginados en servidor. Si es un nodo, se renderiza tal cual (paginación
   * natural en cliente).
   */
  children: ReactNode | ((args: { scrollY: number }) => ReactNode);
}

/**
 * Maquetación común de las páginas de listado: una barra de controles que se
 * apila a pantalla completa en móvil (clase `.list-controls`, ver index.css) y,
 * opcionalmente, el cálculo de la altura de tabla para scroll interno.
 *
 * Centraliza el patrón `wrapperRef`/`controlsRef` + `useTableScroll` y el
 * `div flex` de filtros que cada ruta repetía con estilos ligeramente distintos.
 */
export function ListPageLayout({ toolbar, children }: ListPageLayoutProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const controlsRef = useRef<HTMLDivElement | null>(null);
  const scrollY = useTableScroll(wrapperRef, controlsRef);

  return (
    <div ref={wrapperRef}>
      <div ref={controlsRef} className="list-controls">
        {toolbar}
      </div>
      {typeof children === "function" ? children({ scrollY }) : children}
    </div>
  );
}
