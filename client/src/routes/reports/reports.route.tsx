import { useEffect, useMemo, useState } from "react";
import { Table, TablePaginationConfig } from 'antd';
import type { SorterResult, FilterValue } from 'antd/es/table/interface';
import { useReportsQuery } from '../../hooks/api/reports/use-reports.query';
import { ReportRow } from '../../shared/types/reports/report-row';
import { PaginationResult } from '../../shared/types/pagination';

export default function ReportsRoute() {
  useEffect(() => {
    document.title = "Informes";
  }, []);

  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(50);

  const [sortField, setSortField] = useState<string | undefined>(undefined);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | undefined>(undefined);

  const { data, isLoading } = useReportsQuery({ page, limit: pageSize, sort_field: sortField, sort_order: sortOrder });

  // Backend returns PaginationResult<ReportRow>
  const paginated: PaginationResult<ReportRow> | undefined = data;
  const rows: ReportRow[] = paginated?.data ?? [];
  const total: number | undefined = paginated?.total;

  const columns = useMemo(() => ([
    { title: 'Nombre', dataIndex: 'name', key: 'name', sorter: true },
    { title: 'Apellido 1', dataIndex: 'first_surname', key: 'first_surname', sorter: true },
    { title: 'Apellido 2', dataIndex: 'second_surname', key: 'second_surname', sorter: true },
    { title: 'DNI', dataIndex: 'dni', key: 'dni', sorter: true },
    { title: 'Email', dataIndex: 'email', key: 'email', sorter: true },
    { title: 'Teléfono', dataIndex: 'phone', key: 'phone', sorter: true },
    { title: 'Centro', dataIndex: 'center_name', key: 'center_name', sorter: true },
    { title: 'Employer number', dataIndex: 'employer_number', key: 'employer_number', sorter: true },
    { title: 'Empresa', dataIndex: 'company_name', key: 'company_name', sorter: true },
    { title: 'CIF empresa', dataIndex: 'company_cif', key: 'company_cif', sorter: true },
    { title: 'Grupo', dataIndex: 'group_name', key: 'group_name', sorter: true },
    { title: 'Inicio grupo', dataIndex: 'group_start_date', key: 'group_start_date', sorter: true },
    { title: 'Fin grupo', dataIndex: 'group_end_date', key: 'group_end_date', sorter: true },
    { title: 'Rol', dataIndex: 'role_shortname', key: 'role_shortname', sorter: true },
    { title: 'Completado (%)', dataIndex: 'completion_percentage', key: 'completion_percentage', sorter: true },
    { title: 'Curso', dataIndex: 'course_name', key: 'course_name', sorter: true },
    { title: 'ID Moodle', dataIndex: 'moodle_id', key: 'moodle_id', sorter: true },
    { title: 'Usuario Moodle', dataIndex: 'moodle_username', key: 'moodle_username', sorter: true },
    { title: 'Password Moodle', dataIndex: 'moodle_password', key: 'moodle_password', sorter: true },
  ]), []);

  const handleTableChange = (
    pagination: TablePaginationConfig,
  _filters: Record<string, FilterValue | null>,
    sorter: SorterResult<ReportRow> | SorterResult<ReportRow>[],
    _extra?: unknown
  ) => {
    const { current, pageSize: newSize } = pagination as TablePaginationConfig;
    if (current && current !== page) setPage(current);
    if (newSize && newSize !== pageSize) {
      setPageSize(newSize);
      setPage(1); // reset to first page when pageSize changes
    }

    // Normalize sorter (could be array for multiple-sort)
    const s = Array.isArray(sorter) ? sorter[0] : sorter;
    const columnKey = s?.columnKey as string | undefined;
    const order = s?.order === 'ascend' ? 'asc' : s?.order === 'descend' ? 'desc' : undefined;
    setSortField(columnKey);
    setSortOrder(order);
  };

  return (
    <div>
      <h1>Informes</h1>
      <Table
        rowKey={(record: ReportRow, idx?: number) => `${record.dni ?? ''}-${record.moodle_id ?? ''}-${idx ?? 0}`}
        loading={isLoading}
        dataSource={rows}
        columns={columns}
        pagination={{ current: page, pageSize, total }}
        onChange={handleTableChange}
      />
    </div>
  );
}
