import { useEffect, useMemo, useState, useRef, type Key, type CSSProperties } from "react";
import useTableScroll from '../../hooks/use-table-scroll';
import { useDebounce } from '../../hooks/use-debounce';
import { normalizeSearch } from '../../utils/normalize-search';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import { Table, TablePaginationConfig, Select, Space, DatePicker, Input, Button, Modal, Checkbox } from 'antd';
import type { SorterResult, FilterValue, SortOrder } from 'antd/es/table/interface';
import { useReportsQuery, ReportsQueryParams } from '../../hooks/api/reports/use-reports.query';
import { useOrganizationSettingsQuery } from '../../hooks/api/organization/use-organization-settings.query';
import { useCoursesQuery } from '../../hooks/api/courses/use-courses.query';
import { useGroupsQuery } from '../../hooks/api/groups/use-groups.query';
import { useCompaniesQuery } from '../../hooks/api/companies/use-companies.query';
import { useCentersQuery } from '../../hooks/api/centers/use-centers.query';
import { useCentersByCompaniesQuery } from '../../hooks/api/centers/use-centers-by-companies.query';
import useReportExport from '../../hooks/api/reports/use-report-export';
import type { ReportExportRequest } from '../../hooks/api/reports/use-export-report.mutation';
import { ReportRow } from '../../shared/types/reports/report-row';
import { PaginationResult } from '../../shared/types/pagination';
import type { Center } from '../../shared/types/center/center';

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
  useEffect(() => {
    document.title = "Informes";
  }, []);

  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(100);
  // Refs to compute available space and provide isolated table scroll
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const controlsRef = useRef<HTMLDivElement | null>(null);
  // Reduce footerOffset so the table body gets a bit more vertical space
  const tableScrollY = useTableScroll(wrapperRef, controlsRef, { footerOffset: 5});
  const [selectedCompanies, setSelectedCompanies] = useState<number[]>([]);
  const [selectedCenters, setSelectedCenters] = useState<number[]>([]);
  const [availableCenters, setAvailableCenters] = useState<Center[]>([]);
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null] | undefined>(undefined);
  const [search, setSearch] = useState<string>('');
  const debouncedSearch = useDebounce(search, 350);
  // Normalize the debounced search using shared util
  const normalizedSearch = useMemo(() => normalizeSearch(debouncedSearch), [debouncedSearch]);
  const [selectedCourse, setSelectedCourse] = useState<number | undefined>(undefined);
  const [selectedGroup, setSelectedGroup] = useState<number[]>([]);
  const [completionFilter, setCompletionFilter] = useState<'all' | 'gte75' | 'eq100'>('all');

  const { data: orgSettings } = useOrganizationSettingsQuery();
  const itopTrainingEnabled = useMemo(() => {
    const settings = orgSettings?.settings ?? {};
    const plugins = (settings && typeof settings === 'object') ? (settings as Record<string, unknown>)['plugins'] : undefined;
    return !!(plugins && typeof plugins === 'object' && (plugins as Record<string, unknown>)['itop_training'] === true);
  }, [orgSettings]);

  // Default to sort by group end date (newest first)
  const [sortField, setSortField] = useState<string | undefined>('group_end_date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | undefined>('desc');

  // Fetch companies (for select options)
  const { data: companies } = useCompaniesQuery();
  // keep companies sorted alphabetically by name for the Select
  const sortedCompanies = useMemo(() => (companies && Array.isArray(companies)) ? [...companies].sort((a, b) => String(a.company_name ?? '').localeCompare(String(b.company_name ?? ''))) : [], [companies]);

  // When no companies selected, fetch all centers via the centers hook
  const { data: allCenters } = useCentersQuery();
  // Fetch centers for the selected companies (hook handles parallel requests & dedupe)
  const { data: centersForCompanies } = useCentersByCompaniesQuery(selectedCompanies?.length ? selectedCompanies : undefined);
  // Fetch courses and groups for the course/group filters
  const { data: courses } = useCoursesQuery();
  // Pass the numeric course id (or undefined) so the groups query can enable/disable itself
  const { data: groupsForCourse } = useGroupsQuery(selectedCourse);

  // Keep courses and groups sorted alphabetically by name for their Selects
  const sortedCourses = useMemo(() => (courses && Array.isArray(courses)) ? [...courses].sort((a, b) => String(a.course_name ?? '').localeCompare(String(b.course_name ?? ''))) : [], [courses]);
  const sortedGroups = useMemo(() => (groupsForCourse && Array.isArray(groupsForCourse)) ? [...groupsForCourse].sort((a, b) => String(a.group_name ?? '').localeCompare(String(b.group_name ?? ''))) : [], [groupsForCourse]);

  // Update available centers depending on selectedCompanies
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      // If no companies selected, show all centers (if available)
      if (!selectedCompanies || selectedCompanies.length === 0) {
        if (mounted) setAvailableCenters((allCenters ?? []).slice().sort((a: Center, b: Center) => String(a.center_name ?? '').localeCompare(String(b.center_name ?? ''))));
        return;
      }

      // If we already have allCenters, filter locally (fast and avoids many requests)
      if (allCenters && Array.isArray(allCenters)) {
        const filtered = allCenters.filter((c: Center) => selectedCompanies.includes(c.id_company)).slice().sort((a: Center, b: Center) => String(a.center_name ?? '').localeCompare(String(b.center_name ?? '')));
        if (mounted) setAvailableCenters(filtered);
        return;
      }
      // If we don't have allCenters, but the centersForCompanies query has data, use it.
      if (centersForCompanies && Array.isArray(centersForCompanies)) {
        if (mounted) setAvailableCenters(centersForCompanies.slice().sort((a: Center, b: Center) => String(a.center_name ?? '').localeCompare(String(b.center_name ?? ''))));
        return;
      }
    };
    load();
    return () => { mounted = false; };
  }, [selectedCompanies, allCenters, centersForCompanies]);

  // Build params including chosen company/center filters (arrays)
  const params: ReportsQueryParams = { page, limit: pageSize, sort_field: sortField, sort_order: sortOrder };
  if (selectedCompanies && selectedCompanies.length) params.id_company = selectedCompanies;
  if (selectedCenters && selectedCenters.length) params.id_center = selectedCenters;
  if (selectedCourse !== undefined && selectedCourse !== null) params.id_course = selectedCourse;
  if (selectedGroup && selectedGroup.length) params.id_group = selectedGroup;
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

  const { data, isLoading } = useReportsQuery(params);

  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [includePasswords, setIncludePasswords] = useState(false);
  const [exportReportType, setExportReportType] = useState<'dedication' | 'certification'>('dedication');

  const { exportPdf: doExportPdf } = useReportExport();
  const [modal, modalContextHolder] = Modal.useModal();

  const handleExport = async () => {
    try {
      setExportModalVisible(false);
  const payload: ReportExportRequest & { filename?: string } = { filter: params, include_passwords: includePasswords, filename: exportReportType === 'certification' ? 'report-certification.pdf' : 'report-dedication.pdf' };
  if (exportReportType === 'certification') payload.report_type = 'certification';
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

  

  // Server-side completion filtering is applied via params; use rows as returned by the API

  const columns = useMemo(() => ([
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
    { title: 'Empresa', dataIndex: 'company_name', key: 'company_name', sorter: true },
    { title: 'Centro', dataIndex: 'center_name', key: 'center_name', sorter: true },
  { title: 'Progreso', dataIndex: 'completion_percentage', key: 'completion_percentage', sorter: true },
  ...(itopTrainingEnabled ? [{ title: 'Tiempo usado', dataIndex: 'time_spent', key: 'time_spent', sorter: true, render: (val?: number | null) => formatTimeSpent(val) }] : []),
  { title: 'Nombre', dataIndex: 'name', key: 'name', sorter: true },
    { title: 'Apellido 1', dataIndex: 'first_surname', key: 'first_surname', sorter: true },
    { title: 'Apellido 2', dataIndex: 'second_surname', key: 'second_surname', sorter: true },
    
    // keep remaining columns after the requested primary ones
    { title: 'DNI', dataIndex: 'dni', key: 'dni', sorter: true },
    { title: 'Email', dataIndex: 'email', key: 'email', sorter: true },
    { title: 'Teléfono', dataIndex: 'phone', key: 'phone', sorter: true },
    { title: 'Nº Patronal', dataIndex: 'employer_number', key: 'employer_number', sorter: true },
    { title: 'CIF', dataIndex: 'company_cif', key: 'company_cif', sorter: true },
    { title: 'Rol', dataIndex: 'role_shortname', key: 'role_shortname', sorter: true },
    { title: 'ID Moodle', dataIndex: 'moodle_id', key: 'moodle_id', sorter: true },
    { title: 'Usuario Moodle', dataIndex: 'moodle_username', key: 'moodle_username', sorter: true },
    { title: 'Password Moodle', dataIndex: 'moodle_password', key: 'moodle_password', sorter: true },
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
      <h1>Informes</h1>
      {modalContextHolder}
      <div ref={controlsRef} style={{ marginBottom: 12 }}>
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
              onChange={(val) => { setSelectedCourse(val == null ? undefined : Number(val)); setSelectedGroup([]); setPage(1); clearSelection(); }}
              options={(sortedCourses || []).map(c => ({ label: c.course_name ?? String(c.id_course), value: c.id_course }))}
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
              onChange={(vals: number[]) => { setSelectedGroup(vals); setPage(1); clearSelection(); }}
              options={(sortedGroups || []).map(g => ({ label: g.group_name ?? String(g.id_group), value: g.id_group }))}
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
            <div style={{ marginBottom: 4, visibility: 'hidden' }}>Export</div>
            <Space>
              <Select
                value={exportReportType}
                onChange={(val) => setExportReportType(val as 'dedication' | 'certification')}
                options={[
                  { label: 'PDF Dedicación', value: 'dedication' },
                  { label: 'PDF Certificado', value: 'certification' },
                ]}
                style={{ minWidth: 220 }}
              />
              <Button type="primary" onClick={() => setExportModalVisible(true)}>Generar</Button>
            </Space>
          </div>
        </Space>

        {/* Second row: Company, Center and Date range */}
        <Space>
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
              onChange={(vals: number[]) => { setSelectedCompanies(vals); setSelectedCenters([]); /* reset centers selection when companies change */ setPage(1); clearSelection(); }}
              options={(sortedCompanies || []).map(c => ({ label: c.company_name ?? String(c.id_company), value: c.id_company }))}
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
              onChange={(vals: number[]) => { setSelectedCenters(vals); setPage(1); clearSelection(); }}
              options={(availableCenters || []).map(c => ({ label: c.center_name ?? String(c.id_center), value: c.id_center }))}
            />
          </div>
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
        </Space>
        {/* global select-all UI handled via table header checkbox; no external control */}
        <Modal
          title={
            (exportReportType === 'certification' ? 'Generar certificado' : 'Exportar informe')
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
                : 'Se generará un informe de dedicación con información detallada por usuario.'}
            </div>
            <div style={{ fontSize: 12, color: '#666' }}>
              {exportReportType === 'certification'
                ? 'El certificado incluirá un párrafo de certificación por cada grupo con las fechas del grupo.'
                : 'Puedes elegir incluir contraseñas en el PDF (acción sensible).'}
            </div>



            {/* Show the include passwords checkbox only for dedication reports */}
            {exportReportType !== 'certification' && (
              <div>
                <label>
                  <Checkbox checked={includePasswords} onChange={(e) => setIncludePasswords(e.target.checked)} /> Incluir contraseñas en el PDF
                </label>
                <div style={{ fontSize: 12, color: '#666' }}>Aviso: incluir contraseñas es una acción sensible y debe registrarse en auditoría.</div>
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
          pagination={{ current: page, pageSize, total, showSizeChanger: true, pageSizeOptions: ['500','1000','1500','2000'] }}
          rowSelection={rowSelection}
          onChange={handleTableChange}
          scroll={{ x: 'max-content', y: tableScrollY }}
        />
      </div>
    </div>
  );
}
