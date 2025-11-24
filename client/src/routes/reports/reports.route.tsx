import { useEffect, useMemo, useState } from "react";
import { Table, TablePaginationConfig, Select, Space } from 'antd';
import type { SorterResult, FilterValue } from 'antd/es/table/interface';
import { useReportsQuery } from '../../hooks/api/reports/use-reports.query';
import { useCompaniesQuery } from '../../hooks/api/companies/use-companies.query';
import { useCentersQuery } from '../../hooks/api/centers/use-centers.query';
import { useCentersByCompaniesQuery } from '../../hooks/api/centers/use-centers-by-companies.query';
import { ReportRow } from '../../shared/types/reports/report-row';
import { PaginationResult } from '../../shared/types/pagination';
import type { Center } from '../../shared/types/center/center';

export default function ReportsRoute() {
  useEffect(() => {
    document.title = "Informes";
  }, []);

  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(50);
  const [selectedCompanies, setSelectedCompanies] = useState<number[]>([]);
  const [selectedCenters, setSelectedCenters] = useState<number[]>([]);
  const [availableCenters, setAvailableCenters] = useState<Center[]>([]);

  const [sortField, setSortField] = useState<string | undefined>(undefined);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | undefined>(undefined);

  // Fetch companies (for select options)
  const { data: companies } = useCompaniesQuery();

  // When no companies selected, fetch all centers via the centers hook
  const { data: allCenters } = useCentersQuery();
  // Fetch centers for the selected companies (hook handles parallel requests & dedupe)
  const { data: centersForCompanies } = useCentersByCompaniesQuery(selectedCompanies?.length ? selectedCompanies : undefined);

  // Update available centers depending on selectedCompanies
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      // If no companies selected, show all centers (if available)
      if (!selectedCompanies || selectedCompanies.length === 0) {
        if (mounted) setAvailableCenters(allCenters ?? []);
        return;
      }

      // If we already have allCenters, filter locally (fast and avoids many requests)
      if (allCenters && Array.isArray(allCenters)) {
        const filtered = allCenters.filter((c: Center) => selectedCompanies.includes(c.id_company));
        if (mounted) setAvailableCenters(filtered);
        return;
      }
      // If we don't have allCenters, but the centersForCompanies query has data, use it.
      if (centersForCompanies && Array.isArray(centersForCompanies)) {
        if (mounted) setAvailableCenters(centersForCompanies);
        return;
      }
    };
    load();
    return () => { mounted = false; };
  }, [selectedCompanies, allCenters, centersForCompanies]);

  // Build params including chosen company/center filters (arrays)
  const params: Record<string, any> = { page, limit: pageSize, sort_field: sortField, sort_order: sortOrder };
  if (selectedCompanies && selectedCompanies.length) params.id_company = selectedCompanies;
  if (selectedCenters && selectedCenters.length) params.id_center = selectedCenters;

  const { data, isLoading } = useReportsQuery(params);

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
      <Space style={{ marginBottom: 12 }}>
        <div>
          <div style={{ marginBottom: 4 }}>Empresa</div>
          <Select<any>
            mode="multiple"
            style={{ minWidth: 240 }}
            placeholder="Selecciona empresas"
            value={selectedCompanies}
            onChange={(vals) => { setSelectedCompanies(vals as number[]); setSelectedCenters([]); /* reset centers selection when companies change */ }}
            options={(companies || []).map(c => ({ label: c.company_name ?? String(c.id_company), value: c.id_company }))}
          />
        </div>
        <div>
          <div style={{ marginBottom: 4 }}>Centro</div>
          <Select<any>
            mode="multiple"
            style={{ minWidth: 240 }}
            placeholder="Selecciona centros"
            value={selectedCenters}
            onChange={(vals) => setSelectedCenters(vals as number[])}
            options={(availableCenters || []).map(c => ({ label: c.center_name ?? String(c.id_center), value: c.id_center }))}
          />
        </div>
      </Space>
      <Table
        rowKey={(record: ReportRow) => (record.id_user && record.id_group) ? `${record.id_user}-${record.id_group}` : `${record.dni ?? ''}-${record.moodle_id ?? ''}`}
        loading={isLoading}
        dataSource={rows}
        columns={columns}
        pagination={{ current: page, pageSize, total }}
        onChange={handleTableChange}
      />
    </div>
  );
}
