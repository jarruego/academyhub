import { useEffect, useMemo, useState, useRef, type Key, type CSSProperties } from "react";
import useTableScroll from '../../hooks/use-table-scroll';
import { useDebounce } from '../../hooks/use-debounce';
import { normalizeSearch } from '../../utils/normalize-search';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import { App, Table, TablePaginationConfig, Select, Space, DatePicker, Input, Button, Modal, Checkbox, theme } from 'antd';
import type { SorterResult, FilterValue, SortOrder } from 'antd/es/table/interface';
import { useReportsQuery, ReportsQueryParams } from '../../hooks/api/reports/use-reports.query';
import { useReportFacetsQuery, ReportFacetsParams } from '../../hooks/api/reports/use-report-facets.query';
import { useOrganizationSettingsQuery } from '../../hooks/api/organization/use-organization-settings.query';
import useReportExport from '../../hooks/api/reports/use-report-export';
import { useReportRolesQuery } from '../../hooks/api/reports/use-report-roles.query';
import type { ReportExportRequest } from '../../hooks/api/reports/use-export-report.mutation';
import { ReportRow } from '../../shared/types/reports/report-row';
import { PaginationResult } from '../../shared/types/pagination';
import { useAuthenticatedAxios } from '../../utils/api/use-authenticated-axios.util';
import { getApiHost } from '../../utils/api/get-api-host.util';
import { PageHeader } from '../../components/common/PageHeader';

const formatTimeSpent = (value?: number | null) => {
  if (value === null || value === undefined) return '-';
  const total = Number(value);
  if (!Number.isFinite(total) || total < 0) return '-';
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = Math.floor(total % 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
};

export default function ReportsRoute() {
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(500);
  // Refs to compute available space and provide isolated table scroll
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const controlsRef = useRef<HTMLDivElement | null>(null);
  // Reduce footerOffset so the table body gets a bit more vertical space
  const tableScrollY = useTableScroll(wrapperRef, controlsRef, { footerOffset: 5});
  const [selectedCompanies, setSelectedCompanies] = useState<number[]>([]);
  const [selectedCenters, setSelectedCenters] = useState<number[]>([]);
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null] | undefined>(undefined);
  const [search, setSearch] = useState<string>('');
  const debouncedSearch = useDebounce(search, 350);
  // Normalize the debounced search using shared util
  const normalizedSearch = useMemo(() => normalizeSearch(debouncedSearch), [debouncedSearch]);
  const [selectedCourse, setSelectedCourse] = useState<number | undefined>(undefined);
  const [selectedGroup, setSelectedGroup] = useState<number[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<number[]>([]);
  const [roleDefaultApplied, setRoleDefaultApplied] = useState(false);
  const [completionFilter, setCompletionFilter] = useState<'all' | 'gte75' | 'eq100'>('all');
  const [onlyBonified, setOnlyBonified] = useState<boolean>(false);
  const [selectedModalities, setSelectedModalities] = useState<string[]>([]);
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [selectedFundings, setSelectedFundings] = useState<string[]>([]);

  const { data: orgSettings } = useOrganizationSettingsQuery();
  const itopTrainingEnabled = orgSettings?.settings.plugins.itop_training ?? false;

  // Default to sort by group end date (newest first)
  const [sortField, setSortField] = useState<string | undefined>('group_end_date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | undefined>('desc');

  // Roles completos: para el default "student" y para que ese rol siga visible/etiquetado
  // aunque las facetas no lo incluyan. Las opciones visibles salen de las facetas.
  const { data: reportRoles } = useReportRolesQuery();
  const studentRole = useMemo(
    () => (reportRoles ?? []).find((r) => String(r.role_shortname ?? '').toLowerCase() === 'student'),
    [reportRoles],
  );
  const studentRoleId = studentRole?.id_role != null ? Number(studentRole.id_role) : undefined;

  // Select "student" by default once roles are loaded (if present)
  useEffect(() => {
    if (roleDefaultApplied) return;
    if (studentRoleId == null) return;
    setSelectedRoles([studentRoleId]);
    setRoleDefaultApplied(true);
  }, [studentRoleId, roleDefaultApplied]);

  // Build params including chosen company/center filters (arrays)
  const params: ReportsQueryParams = { page, limit: pageSize, sort_field: sortField, sort_order: sortOrder };
  if (selectedCompanies && selectedCompanies.length) params.id_company = selectedCompanies;
  if (selectedCenters && selectedCenters.length) params.id_center = selectedCenters;
  if (selectedCourse !== undefined && selectedCourse !== null) params.id_course = selectedCourse;
  if (selectedGroup && selectedGroup.length) params.id_group = selectedGroup;
  if (selectedRoles && selectedRoles.length) params.id_role = selectedRoles;
  if (normalizedSearch) params.search = normalizedSearch;
  if (dateRange && dateRange[0] && dateRange[1]) {
    // Send ISO datetimes covering the whole days so filtering is inclusive:
    // start at 00:00:00 and end at 23:59:59.999 in UTC (to avoid timezone issues send ISO strings).
    params.start_date = dateRange[0].startOf('day').toISOString();
    params.end_date = dateRange[1].endOf('day').toISOString();
  }

  // Map UI completion filter into server-side single threshold param
  if (completionFilter === 'gte75') params.completion_percentage = 75;
  if (completionFilter === 'eq100') params.completion_percentage = 100;

  // Solo alumnos marcados como bonificados en la BD (user_group.bonified = true)
  if (onlyBonified) params.bonified = true;

  // Ejes de clasificación del curso
  if (selectedModalities.length) params.modality = selectedModalities;
  if (selectedClients.length) params.client = selectedClients;
  if (selectedFundings.length) params.funding = selectedFundings;

  const { data, isLoading } = useReportsQuery(params);

  // Facetas: mismas condiciones de filtro que el listado, pero sin paginación ni
  // ordenación (no afectan al conjunto filtrado). Alimentan las opciones de los
  // desplegables de forma interdependiente (faceted search).
  const facetParams: ReportFacetsParams = {
    id_company: params.id_company,
    id_center: params.id_center,
    id_course: params.id_course,
    id_group: params.id_group,
    id_role: params.id_role,
    search: params.search,
    start_date: params.start_date,
    end_date: params.end_date,
    completion_percentage: params.completion_percentage,
    bonified: params.bonified,
    modality: params.modality,
    client: params.client,
    funding: params.funding,
  };
  const { data: facets, isFetching: facetsLoading } = useReportFacetsQuery(facetParams);

  // Autolimpieza: al recalcularse las facetas, descartar de cada selección los
  // valores que ya no estén disponibles, para mantener filtros y tabla coherentes.
  useEffect(() => {
    if (!facets) return;
    const companyIds = new Set(facets.companies.map((c) => c.id_company));
    setSelectedCompanies((prev) => { const next = prev.filter((id) => companyIds.has(id)); return next.length === prev.length ? prev : next; });
    const centerIds = new Set(facets.centers.map((c) => c.id_center));
    setSelectedCenters((prev) => { const next = prev.filter((id) => centerIds.has(id)); return next.length === prev.length ? prev : next; });
    const groupIds = new Set(facets.groups.map((g) => g.id_group));
    setSelectedGroup((prev) => { const next = prev.filter((id) => groupIds.has(id)); return next.length === prev.length ? prev : next; });
    // El rol "student" (default) es pegajoso: se conserva aunque las facetas no lo
    // incluyan; solo desaparece si el usuario lo deselecciona manualmente.
    const roleIds = new Set(facets.roles.map((r) => r.id_role));
    setSelectedRoles((prev) => { const next = prev.filter((id) => roleIds.has(id) || id === studentRoleId); return next.length === prev.length ? prev : next; });
    const courseIds = new Set(facets.courses.map((c) => c.id_course));
    setSelectedCourse((prev) => (prev != null && !courseIds.has(prev) ? undefined : prev));
    const modalitySet = new Set(facets.modalities);
    setSelectedModalities((prev) => { const next = prev.filter((v) => modalitySet.has(v)); return next.length === prev.length ? prev : next; });
    const clientSet = new Set(facets.clients);
    setSelectedClients((prev) => { const next = prev.filter((v) => clientSet.has(v)); return next.length === prev.length ? prev : next; });
    const fundingSet = new Set(facets.fundings);
    setSelectedFundings((prev) => { const next = prev.filter((v) => fundingSet.has(v)); return next.length === prev.length ? prev : next; });
  }, [facets, studentRoleId]);

  // Opciones del desplegable de Rol: las facetas + el rol "student" seleccionado aunque
  // las facetas no lo incluyan, para que siga mostrándose etiquetado (y no como id).
  const roleOptions = useMemo(() => {
    const base = (facets?.roles ?? []).map((r) => ({ label: r.role_shortname ?? String(r.id_role), value: r.id_role as number }));
    if (studentRoleId != null && selectedRoles.includes(studentRoleId) && !base.some((o) => o.value === studentRoleId)) {
      base.unshift({ label: studentRole?.role_shortname ?? 'student', value: studentRoleId });
    }
    return base;
  }, [facets, studentRoleId, studentRole, selectedRoles]);

  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [includePasswords, setIncludePasswords] = useState(false);
  const [exportReportType, setExportReportType] = useState<'dedication' | 'certification' | 'bonification' | 'excel'>('dedication');

  const { exportPdf: doExportPdf } = useReportExport();
  const request = useAuthenticatedAxios<PaginationResult<ReportRow>>();
  const { modal } = App.useApp();
  const { token } = theme.useToken();

  const handleExport = async () => {
    try {
      setExportModalVisible(false);
  const payload: ReportExportRequest & { filename?: string } = { filter: params, include_passwords: includePasswords, filename: exportReportType === 'certification' ? 'GENERAL Certificado.zip' : exportReportType === 'bonification' ? 'report-bonification.pdf' : 'GENERAL Dedicacion.zip' };
  if (exportReportType === 'certification') payload.report_type = 'certification';
  if (exportReportType === 'bonification') payload.report_type = 'bonification';
  // If user has explicit selections, send selected_keys; if user chose select-all-across-pages,
  // send select_all_matching with any deselected keys. Otherwise send only the filter.
  if (!selectAllMatching && selectedRowKeys && selectedRowKeys.length) {
    payload.selected_keys = selectedRowKeys as string[];
  } else if (selectAllMatching) {
    payload.select_all_matching = true;
    payload.deselected_keys = Array.from(deselectedIds.values());
  }

  await doExportPdf(payload);
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.error('Export error', err?.response ?? err);
      modal.error({ title: 'Error', content: 'No se pudo generar el PDF. Revisa la consola.' });
    }
  };

  // unified export handler used for both dedication and certification

  // Backend returns PaginationResult<ReportRow>
  const paginated: PaginationResult<ReportRow> | undefined = data;
  const rows: ReportRow[] = paginated?.data ?? [];
  const total: number | undefined = paginated?.total;

  const excelOldHeader = [
    'Tipo Curso',
    'Curso',
    'Grupo',
    'Fec. Ini. Curso',
    'Fec. Fin Curso',
    'F.Ini. Grupo',
    'F.Fin Grupo',
    'Id. Moodle',
    'Nombre Alumno',
    '1 Apellido',
    '2 Apellido',
    'Dni',
    'Email',
    'Teléfono',
    'Rol',
    'Cargo',
    '% Realizado',
    'Tiempo Empleado',
    'Centro',
    'Nº Patronal',
    'Empresa',
    'NIF',
  ];

  const escapeCsvCell = (value: unknown) => {
    if (value === null || value === undefined) return '""';
    const text = String(value).replace(/"/g, '""').replace(/\r?\n/g, ' ');
    return `"${text}"`;
  };

  const formatSpanishDecimal = (value: unknown) => {
    if (value === null || value === undefined || value === '') return '';
    const numberValue = Number(value);
    if (!Number.isFinite(numberValue)) return String(value);
    return numberValue.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const mapRowToExcelOld = (row: ReportRow) => {
    const completion = formatSpanishDecimal(row.completion_percentage);
    const timeSpent = row.time_spent === null || row.time_spent === undefined ? '' : formatTimeSpent(row.time_spent);

    return [
      row.modality ?? '',
      row.course_name ?? '',
      row.group_name ?? '',
      '',
      '',
      row.group_start_date ? dayjs(row.group_start_date).format('DD/MM/YYYY') : '',
      row.group_end_date ? dayjs(row.group_end_date).format('DD/MM/YYYY') : '',
      row.moodle_id ?? '',
      row.name ?? '',
      row.first_surname ?? '',
      row.second_surname ?? '',
      row.dni ?? '',
      row.email ?? '',
      row.phone ?? '',
      row.role_shortname ?? '',
      row.job_position ?? '',
      completion,
      timeSpent,
      row.center_name ?? '',
      row.employer_number ?? '',
      row.company_name ?? '',
      row.company_cif ?? '',
    ];
  };

  const buildExcelOldCsv = (sourceRows: ReportRow[]) => {
    const lines = [
      excelOldHeader.map(escapeCsvCell).join(';'),
      ...sourceRows.map((row) => mapRowToExcelOld(row).map(escapeCsvCell).join(';')),
    ];

    return lines.join('\r\n');
  };

  const fetchAllFilteredRowsForExcelOld = async () => {
    const batchSize = 2000;
    let currentPage = 1;
    let totalPages = 1;
    const allRows: ReportRow[] = [];

    while (currentPage <= totalPages) {
      const { data: pageResult } = await request({
        method: 'GET',
        url: `${getApiHost()}/reports`,
        params: { ...params, page: currentPage, limit: batchSize },
      });

      allRows.push(...(pageResult?.data ?? []));
      totalPages = Number(pageResult?.totalPages ?? 1);
      currentPage += 1;
    }

    return allRows;
  };

  const downloadCsvFile = (csvContent: string, filename: string) => {
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  };

  

  // Server-side completion filtering is applied via params; use rows as returned by the API

  const columns = useMemo(() => ([
    { title: 'Empresa', dataIndex: 'company_name', key: 'company_name', sorter: true },
    { title: 'Centro', dataIndex: 'center_name', key: 'center_name', sorter: true },
    { title: 'Nombre', dataIndex: 'name', key: 'name', sorter: true },
    { title: 'Apellido 1', dataIndex: 'first_surname', key: 'first_surname', sorter: true },
    { title: 'Apellido 2', dataIndex: 'second_surname', key: 'second_surname', sorter: true },

    { title: 'Progreso', dataIndex: 'completion_percentage', key: 'completion_percentage', sorter: true },
    ...(itopTrainingEnabled ? [{ title: 'Tiempo usado', dataIndex: 'time_spent', key: 'time_spent', sorter: true, render: (val?: number | null) => formatTimeSpent(val) }] : []),

    // keep remaining columns after the requested primary ones
    { title: 'DNI', dataIndex: 'dni', key: 'dni', sorter: true },
    { title: 'Email', dataIndex: 'email', key: 'email', sorter: true },
    { title: 'Teléfono', dataIndex: 'phone', key: 'phone', sorter: true },
    { title: 'Nº Patronal', dataIndex: 'employer_number', key: 'employer_number', sorter: true },
    { title: 'CIF', dataIndex: 'company_cif', key: 'company_cif', sorter: true },
    { title: 'Rol', dataIndex: 'role_shortname', key: 'role_shortname', sorter: true },
    { title: 'ID Moodle', dataIndex: 'moodle_id', key: 'moodle_id', sorter: true },
    { title: 'Usuario Moodle', dataIndex: 'moodle_username', key: 'moodle_username', sorter: true },

    { title: 'Curso', dataIndex: 'course_name', key: 'course_name', sorter: true },
    { title: 'Grupo', dataIndex: 'group_name', key: 'group_name', sorter: true },
    {
      title: 'Inicio grupo',
      dataIndex: 'group_start_date',
      key: 'group_start_date',
      sorter: true,
      render: (val: string | undefined) => val ? dayjs(val).format('DD/MM/YYYY') : '',
    },
    {
      title: 'Fin grupo',
      dataIndex: 'group_end_date',
      key: 'group_end_date',
      sorter: true,
      defaultSortOrder: 'descend' as SortOrder,
      render: (val: string | undefined) => val ? dayjs(val).format('DD/MM/YYYY') : '',
    },
  ]), [itopTrainingEnabled]);

  // Ensure each column has a minimum width so the table keeps readable columns
  // when there are many columns. We add a cell style with minWidth; the Table
  // scroll.x is already set so horizontal scrolling will appear when needed.
  const columnsWithMin = useMemo(() => columns.map(col => ({
    ...col as any,
    onCell: (record: Record<string, any>) => {
      // derive the raw value from the record using dataIndex (string key)
      const dataIndex = col.dataIndex as string | undefined;
      const raw = dataIndex ? record[dataIndex] : undefined;
      // if the column defines a render function, attempt to use it to produce the displayed value
      let display = '';
      try {
        if (typeof col.render === 'function') {
          // call render with the raw value and the record; if it returns a React node we stringify
          const r = (col as any).render(raw, record);
          display = (typeof r === 'string' || typeof r === 'number') ? String(r) : '';
        } else if (raw !== undefined && raw !== null) {
          display = String(raw);
        }
      } catch (err) {
        display = String(raw ?? '');
      }

      const title = `${col.title ?? ''}: ${display}`;
      // attach double-click handlers for certain cells to open detail pages
      let onDoubleClick: (() => void) | undefined;
      try {
        const idx = dataIndex;
        // course -> open course detail if id_course available
        if (idx === 'course_name' && record?.id_course) {
          const id = record.id_course;
          onDoubleClick = () => window.open(`${window.location.origin}/courses/${id}`, '_blank', 'noopener,noreferrer');
        }
        // group -> open group edit/detail (also when clicking group start/end date or progress)
        if ((idx === 'group_name' || idx === 'group_start_date' || idx === 'group_end_date' || idx === 'completion_percentage') && record?.id_group) {
          const id = record.id_group;
          onDoubleClick = () => window.open(`${window.location.origin}/groups/${id}/edit`, '_blank', 'noopener,noreferrer');
        }
        // company -> open company detail (also when clicking CIF)
        if ((idx === 'company_name' || idx === 'company_cif') && record?.id_company) {
          const id = record.id_company;
          onDoubleClick = () => window.open(`${window.location.origin}/companies/${id}`, '_blank', 'noopener,noreferrer');
        }
        // center -> open center edit/detail (also when clicking employer_number)
        if ((idx === 'center_name' || idx === 'employer_number') && record?.id_center) {
          const id = record.id_center;
          onDoubleClick = () => window.open(`${window.location.origin}/centers/${id}/edit`, '_blank', 'noopener,noreferrer');
        }
        // user-related fields -> open user detail (role, moodle id/username/password also open user)
        if (['name','first_surname','second_surname','dni','email','phone','role_shortname','moodle_id','moodle_username','moodle_password'].includes(String(idx)) && record?.id_user) {
          const id = record.id_user;
          onDoubleClick = () => window.open(`${window.location.origin}/users/${id}`, '_blank', 'noopener,noreferrer');
        }
      } catch (err) {
        // noop
      }

  const baseStyle: CSSProperties = { minWidth: 200, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', transition: 'background-color 0.12s ease' };
  if (onDoubleClick) (baseStyle as CSSProperties & { cursor?: string }).cursor = 'pointer';
  const cellProps: { style: CSSProperties; title: string; onDoubleClick?: () => void; onMouseEnter?: (e: React.MouseEvent) => void; onMouseLeave?: (e: React.MouseEvent) => void } = { style: baseStyle, title };
      if (onDoubleClick) {
        cellProps.onDoubleClick = onDoubleClick;
        // subtle green highlight on hover to indicate clickability
        cellProps.onMouseEnter = (e: React.MouseEvent) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#e6ffed'; };
        cellProps.onMouseLeave = (e: React.MouseEvent) => { (e.currentTarget as HTMLElement).style.backgroundColor = ''; };
      }
      return cellProps;
    }
  })), [columns]);

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

  // Selection state: support selecting rows on the current page.
  // Selection state supporting both per-page selection and global "select all matching" intent
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectAllMatching, setSelectAllMatching] = useState<boolean>(false);
  const [deselectedIds, setDeselectedIds] = useState<Set<string>>(new Set());

  // Helper to clear all selection state when filters/search change
  const clearSelection = () => {
    setSelectedIds(new Set());
    setSelectAllMatching(false);
    setDeselectedIds(new Set());
  };

  const getRowKey = (r: ReportRow) => (r.id_user && r.id_group) ? `${r.id_user}-${r.id_group}` : `${r.dni ?? ''}-${r.moodle_id ?? ''}`;

  const selectedRowKeys = useMemo(() => {
    if (selectAllMatching) {
      // visible rows minus any explicitly deselected
      return rows.map(getRowKey).filter(k => !deselectedIds.has(k));
    }
    return Array.from(selectedIds.values());
  }, [selectAllMatching, selectedIds, deselectedIds, rows]);

  // Number of rows that will be included in the export modal preview
  const exportCount = useMemo(() => {
    if (selectAllMatching) return Math.max(0, Number(total ?? 0) - (deselectedIds?.size ?? 0));
    if (selectedIds && selectedIds.size) return selectedIds.size;
    return Number(total ?? 0);
  }, [selectAllMatching, selectedIds, deselectedIds, total]);

  const onSelect = (record: ReportRow, selected: boolean) => {
    const k = getRowKey(record);
    if (selectAllMatching) {
      setDeselectedIds(prev => {
        const s = new Set(prev);
        if (!selected) s.add(k); else s.delete(k);
        return s;
      });
    } else {
      setSelectedIds(prev => {
        const s = new Set(prev);
        if (selected) s.add(k); else s.delete(k);
        return s;
      });
    }
  };

  const onSelectAllVisible = (selected: boolean, _selectedRows: ReportRow[], changeRows: ReportRow[]) => {
    const keys = changeRows.map(getRowKey);
    // If user checks the header select-all and there are more results than loaded rows,
    // interpret this as intent to select all matching results across pages.
    if (selected && total && total > rows.length) {
      setSelectAllMatching(true);
      setDeselectedIds(new Set());
      return;
    }

    // If user unchecks header and we were in selectAllMatching mode, clear global selection.
    if (!selected && selectAllMatching) {
      setSelectAllMatching(false);
      setSelectedIds(new Set());
      setDeselectedIds(new Set());
      return;
    }

    // Fallback: toggle selection for the visible changeRows (per-page behavior)
    setSelectedIds(prev => {
      const s = new Set(prev);
      const allSelected = keys.every(k => s.has(k));
      if (allSelected) keys.forEach(k => s.delete(k)); else keys.forEach(k => s.add(k));
      return s;
    });
  };

  const rowSelection = {
    selectedRowKeys,
    onChange: (selectedKeys: Key[], _rows: ReportRow[]) => {
      // If in global select-all mode, update the explicit deselections for visible rows
      if (selectAllMatching) {
        const visible = rows.map(getRowKey);
        const selectedSet = new Set(selectedKeys.map(String));
        setDeselectedIds(prev => {
          const s = new Set(prev);
          for (const k of visible) {
            if (selectedSet.has(k)) s.delete(k); else s.add(k);
          }
          return s;
        });
        return;
      }

      // Normal per-page selection: preserve selections from other pages and replace current page
      const currentPageKeys = rows.map(getRowKey);
      const preserved = Array.from(selectedIds.values()).filter(k => !currentPageKeys.includes(k));
      const newCurrent = selectedKeys.map(String).filter(k => currentPageKeys.includes(k));
      setSelectedIds(new Set([...preserved, ...newCurrent]));
    },
    onSelect,
    onSelectAll: onSelectAllVisible,
  } as const;

  return (
    <div>
      <div ref={controlsRef} style={{ marginBottom: 12 }}>
        <PageHeader title="Informes" />
        <div style={{ marginBottom: 12 }}>
          <Input.Search
            placeholder="Buscar por nombre, apellidos, email, dni, nss o teléfono"
            allowClear
            enterButton={false}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); clearSelection(); }}
            style={{ width: 600 }}
          />
        </div>
        <div style={{ marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* First row: Course & Groups */}
        <Space>
          <div>
            <div style={{ marginBottom: 4 }}>Curso</div>
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              filterOption={(input, option) => {
                // Compare labels and input ignoring accents/diacritics and case.
                const strip = (s?: unknown) => String(s ?? '')
                  .normalize('NFD')
                  .replace(/[\u0300-\u036f]/g, '')
                  .toLowerCase();
                return strip(option?.label).includes(strip(input));
              }}
              placeholder="Selecciona curso"
              style={{ minWidth: 240 }}
              // Let the dropdown width adapt to the longest option instead of
              // forcing it to match the select input width. When the user types
              // and filters options, the dropdown will resize accordingly.
              popupMatchSelectWidth={false}
              dropdownStyle={{ minWidth: 240 }}
              value={selectedCourse}
              loading={facetsLoading}
              onChange={(val) => { setSelectedCourse(val == null ? undefined : Number(val)); setSelectedGroup([]); setPage(1); clearSelection(); }}
              options={(facets?.courses ?? []).map(c => ({ label: c.course_name ?? String(c.id_course), value: c.id_course }))}
            />
          </div>
          <div>
            <div style={{ marginBottom: 4 }}>Modalidad</div>
            <Select<string[]>
              mode="multiple"
              allowClear
              showSearch
              optionFilterProp="label"
              filterOption={(input, option) => String(option?.label ?? '').toLowerCase().includes(String(input).toLowerCase())}
              style={{ minWidth: 200 }}
              placeholder="Modalidad"
              value={selectedModalities}
              loading={facetsLoading}
              onChange={(vals: string[]) => { setSelectedModalities(vals); setPage(1); clearSelection(); }}
              options={(facets?.modalities ?? []).map(v => ({ label: v, value: v }))}
            />
          </div>
          <div>
            <div style={{ marginBottom: 4 }}>Cliente</div>
            <Select<string[]>
              mode="multiple"
              allowClear
              showSearch
              optionFilterProp="label"
              filterOption={(input, option) => String(option?.label ?? '').toLowerCase().includes(String(input).toLowerCase())}
              style={{ minWidth: 200 }}
              placeholder="Cliente"
              value={selectedClients}
              loading={facetsLoading}
              onChange={(vals: string[]) => { setSelectedClients(vals); setPage(1); clearSelection(); }}
              options={(facets?.clients ?? []).map(v => ({ label: v, value: v }))}
            />
          </div>
          <div>
            <div style={{ marginBottom: 4 }}>Financiación</div>
            <Select<string[]>
              mode="multiple"
              allowClear
              showSearch
              optionFilterProp="label"
              filterOption={(input, option) => String(option?.label ?? '').toLowerCase().includes(String(input).toLowerCase())}
              style={{ minWidth: 200 }}
              placeholder="Financiación"
              value={selectedFundings}
              loading={facetsLoading}
              onChange={(vals: string[]) => { setSelectedFundings(vals); setPage(1); clearSelection(); }}
              options={(facets?.fundings ?? []).map(v => ({ label: v, value: v }))}
            />
          </div>
          <div>
            <div style={{ marginBottom: 4 }}>Grupo</div>
            <Select<number[]>
              allowClear
              showSearch
              optionFilterProp="label"
              filterOption={(input, option) => String(option?.label ?? '').toLowerCase().includes(String(input).toLowerCase())}
              placeholder="Selecciona grupo"
              style={{ minWidth: 240 }}
              mode="multiple"
              disabled={!selectedCourse}
              value={selectedGroup}
              loading={facetsLoading}
              onChange={(vals: number[]) => { setSelectedGroup(vals); setPage(1); clearSelection(); }}
              options={(facets?.groups ?? []).map(g => ({ label: g.group_name ?? String(g.id_group), value: g.id_group }))}
            />
          </div>
        </Space>

        {/* Fila 2 — Organización (empresa / centro / rol) */}
        <Space wrap>
          <div>
            <div style={{ marginBottom: 4 }}>Empresa</div>
            <Select<number[]>
              mode="multiple"
              showSearch
              optionFilterProp="label"
              filterOption={(input, option) => String(option?.label ?? '').toLowerCase().includes(String(input).toLowerCase())}
              style={{ minWidth: 240 }}
              placeholder="Selecciona empresas"
              value={selectedCompanies}
              loading={facetsLoading}
              onChange={(vals: number[]) => { setSelectedCompanies(vals); setSelectedCenters([]); /* reset centers selection when companies change */ setPage(1); clearSelection(); }}
              options={(facets?.companies ?? []).map(c => ({ label: c.company_name ?? String(c.id_company), value: c.id_company }))}
            />
          </div>
          <div>
            <div style={{ marginBottom: 4 }}>Centro</div>
            <Select<number[]>
              mode="multiple"
              showSearch
              optionFilterProp="label"
              filterOption={(input, option) => String(option?.label ?? '').toLowerCase().includes(String(input).toLowerCase())}
              style={{ minWidth: 240 }}
              placeholder="Selecciona centros"
              value={selectedCenters}
              loading={facetsLoading}
              onChange={(vals: number[]) => { setSelectedCenters(vals); setPage(1); clearSelection(); }}
              options={(facets?.centers ?? []).map(c => ({ label: c.center_name ?? String(c.id_center), value: c.id_center }))}
            />
          </div>
          <div>
            <div style={{ marginBottom: 4 }}>Rol</div>
            <Select<number[]>
              allowClear
              showSearch
              optionFilterProp="label"
              filterOption={(input, option) => String(option?.label ?? '').toLowerCase().includes(String(input).toLowerCase())}
              placeholder="Selecciona rol"
              style={{ minWidth: 240 }}
              mode="multiple"
              value={selectedRoles}
              loading={facetsLoading}
              onChange={(vals: number[]) => { setSelectedRoles(vals); setPage(1); clearSelection(); }}
              options={roleOptions}
            />
          </div>
        </Space>

        {/* Fila 3 — Criterios de la inscripción (fechas / progreso / bonificación) */}
        <Space wrap>
          <div>
            <div style={{ marginBottom: 4 }}>Rango fechas grupo</div>
            <DatePicker.RangePicker
              style={{ minWidth: 300 }}
              value={dateRange}
              format="DD/MM/YYYY"
              onChange={(dates) => {
                setDateRange(dates as [Dayjs | null, Dayjs | null] | undefined);
                  setPage(1);
                  clearSelection();
              }}
              allowClear
            />
          </div>
          <div>
            <div style={{ marginBottom: 4 }}>Filtro % completado</div>
            <Select
              style={{ minWidth: 160 }}
              value={completionFilter}
              onChange={(val) => { setCompletionFilter(val as any); setPage(1); setSelectedIds(new Set()); setSelectAllMatching(false); setDeselectedIds(new Set()); }}
              options={[
                { label: 'Todos (>=0%)', value: 'all' },
                { label: '>= 75%', value: 'gte75' },
                { label: '100%', value: 'eq100' },
              ]}
            />
          </div>
          <div>
            <div style={{ marginBottom: 4, visibility: 'hidden' }}>Bonificados</div>
            <Checkbox
              checked={onlyBonified}
              onChange={(e) => { setOnlyBonified(e.target.checked); setPage(1); clearSelection(); }}
            >
              Solo bonificados
            </Checkbox>
          </div>
        </Space>

        {/* Acción de exportación, separada de los filtros */}
        <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 12 }}>
          <Space>
            <span>Exportar</span>
            <Select
              value={exportReportType}
              onChange={(val) => setExportReportType(val as 'dedication' | 'certification' | 'bonification' | 'excel')}
              options={[
                { label: 'PDF Dedicación', value: 'dedication' },
                { label: 'PDF Certificado', value: 'certification' },
                { label: 'PDF Bonificada', value: 'bonification' },
                { label: 'Exportar a Excel OLD', value: 'excel' },
              ]}
              style={{ minWidth: 220 }}
            />
            <Button type="primary" onClick={() => {
              if (exportReportType === 'excel') {
                // Exportar solo seleccionados
                const selected = selectedRowKeys && selectedRowKeys.length ? rows.filter(row => selectedRowKeys.includes(getRowKey(row))) : [];
                if (!selected.length) {
                  modal.confirm({
                    title: 'Exportación a Excel OLD',
                    content: 'No ha seleccionado alumnos para exportar. ¿Desea exportar todos los registros filtrados?',
                    okText: 'Exportar todos',
                    cancelText: 'Cancelar',
                    onOk: async () => {
                      // Exportar todos los registros filtrados (todas las páginas)
                      try {
                        const allRows = await fetchAllFilteredRowsForExcelOld();
                        if (!allRows.length) {
                          modal.error({ title: 'Exportación a Excel OLD', content: 'No hay registros para exportar.' });
                          return;
                        }
                        const csvContent = buildExcelOldCsv(allRows);
                        downloadCsvFile(csvContent, 'informe-old.csv');
                      } catch (err) {
                        modal.error({ title: 'Exportación a Excel OLD', content: 'Error al obtener todos los registros.' });
                      }
                    },
                  });
                  return;
                }
                const csvContent = buildExcelOldCsv(selected);
                downloadCsvFile(csvContent, 'informe-old.csv');
              } else {
                setExportModalVisible(true);
              }
            }}>Generar</Button>
          </Space>
        </div>
        <Modal
          title={
            (exportReportType === 'certification' ? 'Generar certificado' : exportReportType === 'bonification' ? 'Generar bonificación' : 'Exportar informe')
            + ` (${exportCount ?? 0} registros)`
          }
          open={exportModalVisible}
          onOk={handleExport}
          onCancel={() => setExportModalVisible(false)}
          okText="Generar PDF"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 14 }}>
              {exportReportType === 'certification'
                ? 'Se generará un PDF de certificación agrupado por Centro → Curso → Grupo con los campos Nombre, Apellidos y DNI.'
                : exportReportType === 'bonification'
                ? 'Se generará un PDF de bonificación agrupado por Grupo → Empresa → Centro con el número total de alumnos.'
                : 'Se generará un informe de dedicación con información detallada por usuario.'}
            </div>
            <div style={{ fontSize: 12, color: token.colorTextSecondary }}>
              {exportReportType === 'certification'
                ? 'El certificado incluirá un párrafo de certificación por cada grupo con las fechas del grupo.'
                : exportReportType === 'bonification'
                ? 'El informe de bonificación muestra totales por grupo, empresa y centro sin detalles de usuarios.'
                : 'Puedes elegir incluir contraseñas en el PDF (acción sensible).'}
            </div>



            {/* Show the include passwords checkbox only for dedication reports */}
            {exportReportType !== 'certification' && exportReportType !== 'bonification' && (
              <div>
                <label>
                  <Checkbox checked={includePasswords} onChange={(e) => setIncludePasswords(e.target.checked)} /> Incluir contraseñas en el PDF
                </label>
                <div style={{ fontSize: 12, color: token.colorTextSecondary }}>Aviso: incluir contraseñas es una acción sensible y debe registrarse en auditoría.</div>
              </div>
            )}
          </div>
        </Modal>
      </div>
    </div>
    <div ref={wrapperRef}>
        <Table
          rowKey={(record: ReportRow) => (record.id_user && record.id_group) ? `${record.id_user}-${record.id_group}` : `${record.dni ?? ''}-${record.moodle_id ?? ''}`}
          loading={isLoading}
          dataSource={rows}
          columns={columnsWithMin}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            pageSizeOptions: ['500','1000','1500','2000'],
            showTotal: (t) => `${t} registros`,
          }}
          rowSelection={rowSelection}
          onChange={handleTableChange}
          scroll={{ x: 'max-content', y: tableScrollY }}
        />
      </div>
    </div>
  );
}
