import { Table } from "antd";
import type { TableProps } from "antd";
import { useLinkNavigation } from "../../utils/click-navigation";

export interface DataTableProps<T> extends TableProps<T> {
  /**
   * Devuelve la URL de detalle de una fila. Si se indica, un clic simple en la
   * fila navega ahí en la misma pestaña, y un doble clic la abre en una
   * pestaña nueva (convención de navegación de la app, ver
   * `utils/click-navigation.ts`). Devolver `undefined` para una fila concreta
   * la deja sin enlace.
   */
  getRowUrl?: (record: T) => string | undefined;
  /**
   * Si es `true`, el clic simple de fila NO navega — solo el doble clic abre
   * el detalle (en pestaña nueva). Excepción puntual al gesto estándar
   * (clic = misma pestaña, doble clic = pestaña nueva) para listados donde un
   * clic simple no debe disparar ninguna navegación.
   */
  dblClickOnly?: boolean;
  /** Altura del cuerpo para scroll vertical interno (listados con altura fija). */
  scrollY?: number;
}

/**
 * Tabla base de los listados de la app. Sobre Ant `Table` aplica de forma
 * uniforme:
 *  - scroll horizontal (`x: 'max-content'`) para que las tablas anchas funcionen
 *    en móvil (decisión de diseño: scroll horizontal, no tarjetas);
 *  - densidad y orden de sort estándar;
 *  - navegación por fila vía `getRowUrl` (clic = misma pestaña, doble clic =
 *    pestaña nueva), fusionando cualquier `onRow` que pase el llamante
 *    (estilos, selección…).
 */
export function DataTable<T extends object>({
  getRowUrl,
  dblClickOnly,
  scrollY,
  onRow,
  scroll,
  ...rest
}: DataTableProps<T>) {
  const linkTo = useLinkNavigation();
  const mergedScroll: TableProps<T>["scroll"] = {
    x: "max-content",
    ...(scrollY ? { y: scrollY } : {}),
    ...scroll,
  };

  return (
    <Table<T>
      sortDirections={["ascend", "descend"]}
      scroll={mergedScroll}
      onRow={(record, index) => {
        const base = onRow?.(record, index) ?? {};
        if (!getRowUrl) return base;
        const url = getRowUrl(record);
        if (!url) return base;
        const { onClick, onDoubleClick } = linkTo(url);
        return {
          ...base,
          onClick: (event) => {
            base.onClick?.(event);
            if (!dblClickOnly) onClick?.(event);
          },
          onDoubleClick: (event) => {
            base.onDoubleClick?.(event);
            onDoubleClick?.(event);
          },
          style: { cursor: "pointer", ...(base.style ?? {}) },
        };
      }}
      {...rest}
    />
  );
}
