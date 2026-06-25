import { useMemo, useState } from "react";
import type { TablePaginationConfig } from "antd/es/table";

const PAGE_SIZE_OPTIONS = ["50", "100", "200", "500"];

/**
 * Paginación de listados paginados en servidor. Centraliza el `paginationConfig`
 * que estaba copiado literal en users.route y center-detail (total, showTotal,
 * showSizeChanger, pageSizeOptions) y el handler de cambio de tabla.
 *
 * @param total Total de registros (del servidor).
 * @param entityName Nombre plural para el "x-y de N {entityName}" (p. ej. "usuarios").
 * @param initialPageSize Tamaño de página inicial (por defecto 100).
 */
export function useListPagination(total: number, entityName: string, initialPageSize = 100) {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const resetPage = () => setCurrentPage(1);

  const handleTableChange = (pagination: TablePaginationConfig) => {
    setCurrentPage(pagination.current || 1);
    setPageSize(pagination.pageSize || initialPageSize);
  };

  const pagination: TablePaginationConfig = useMemo(
    () => ({
      current: currentPage,
      pageSize,
      total,
      showSizeChanger: true,
      showQuickJumper: true,
      showTotal: (t: number, range: [number, number]) => `${range[0]}-${range[1]} de ${t} ${entityName}`,
      pageSizeOptions: PAGE_SIZE_OPTIONS,
      onChange: (page: number, size: number) => {
        setCurrentPage(page);
        setPageSize(size);
      },
    }),
    [currentPage, pageSize, total, entityName],
  );

  return { currentPage, pageSize, resetPage, handleTableChange, pagination };
}
