import { Table } from "antd";
import type { TableProps } from "antd";
import { openDetail } from "../../utils/open-detail";

export interface DataTableProps<T> extends TableProps<T> {
  /**
   * Devuelve la URL de detalle de una fila. Si se indica, un clic simple en la
   * fila abre esa URL en una pestaña nueva (gesto de navegación único de los
   * listados). Devolver `undefined` para una fila concreta la deja sin enlace.
   */
  getRowUrl?: (record: T) => string | undefined;
  /** Altura del cuerpo para scroll vertical interno (listados con altura fija). */
  scrollY?: number;
}

/**
 * Tabla base de los listados de la app. Sobre Ant `Table` aplica de forma
 * uniforme:
 *  - scroll horizontal (`x: 'max-content'`) para que las tablas anchas funcionen
 *    en móvil (decisión de diseño: scroll horizontal, no tarjetas);
 *  - densidad y orden de sort estándar;
 *  - navegación por fila con clic simple → pestaña nueva vía `getRowUrl`,
 *    fusionando cualquier `onRow` que pase el llamante (estilos, selección…).
 */
export function DataTable<T extends object>({
  getRowUrl,
  scrollY,
  onRow,
  scroll,
  ...rest
}: DataTableProps<T>) {
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
        return {
          ...base,
          onClick: (event) => {
            base.onClick?.(event);
            openDetail(url);
          },
          style: { cursor: "pointer", ...(base.style ?? {}) },
        };
      }}
      {...rest}
    />
  );
}
