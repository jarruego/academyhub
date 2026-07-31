import { useMemo, useState } from 'react';
import { App, Table, Select, DatePicker, Space, Button, Dropdown } from 'antd';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import type { MenuProps } from 'antd';
import { SendOutlined, DownOutlined } from '@ant-design/icons';
import { useReportsQuery, ReportsQueryParams } from '../../hooks/api/reports/use-reports.query';
import { useReportFacetsQuery, ReportFacetsParams } from '../../hooks/api/reports/use-report-facets.query';
import { ReportRow } from '../../shared/types/reports/report-row';
import SendReportMailModal from '../mail/SendReportMailModal';

interface Props {
  centerId: number;
}

const getRowKey = (r: ReportRow) => (r.id_user != null && r.id_group != null) ? `${r.id_user}-${r.id_group}` : `${r.dni ?? ''}-${r.moodle_id ?? ''}`;

const isStudentRow = (r: ReportRow) => String(r.role_shortname ?? '').toLowerCase() === 'student';

const formatPercent = (v: unknown) => {
  const n = Number(v ?? 0) || 0;
  return `${n > 0 && n <= 1 ? Math.round(n * 100) : Math.round(n)}%`;
};

export default function CenterTrainingTab({ centerId }: Props) {
  const { message: messageApi } = App.useApp();
  const [selectedCourse, setSelectedCourse] = useState<number | undefined>(undefined);
  const [selectedGroup, setSelectedGroup] = useState<number[]>([]);
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null] | undefined>(undefined);
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
  const [isSendReportOpen, setIsSendReportOpen] = useState(false);

  const params: ReportsQueryParams = { id_center: [centerId], page: 1, limit: 2000 };
  if (selectedCourse != null) params.id_course = selectedCourse;
  if (selectedGroup.length) params.id_group = selectedGroup;
  if (dateRange?.[0] && dateRange?.[1]) {
    params.start_date = dateRange[0].startOf('day').toISOString();
    params.end_date = dateRange[1].endOf('day').toISOString();
  }

  const { data, isLoading } = useReportsQuery(params);
  const facetParams: ReportFacetsParams = { id_center: [centerId], id_course: selectedCourse, start_date: params.start_date, end_date: params.end_date };
  const { data: facets, isFetching: facetsLoading } = useReportFacetsQuery(facetParams);

  const rows: ReportRow[] = useMemo(() => data?.data ?? [], [data]);
  const selectedRows = useMemo(() => rows.filter((r) => selectedRowKeys.includes(getRowKey(r))), [rows, selectedRowKeys]);

  const seleccionMenuItems: MenuProps['items'] = [
    { key: 'sel-all', label: 'Seleccionar todos los alumnos' },
    { key: 'sel-75', label: 'Seleccionar ≥75%' },
    { key: 'sel-clear', label: 'Limpiar selección' },
  ];

  const handleSeleccionClick: MenuProps['onClick'] = ({ key }) => {
    if (key === 'sel-all') setSelectedRowKeys(rows.filter(isStudentRow).map(getRowKey));
    if (key === 'sel-75') setSelectedRowKeys(rows.filter((r) => isStudentRow(r) && Number(r.completion_percentage ?? 0) >= 75).map(getRowKey));
    if (key === 'sel-clear') setSelectedRowKeys([]);
  };

  const columns = [
    { title: 'Curso', dataIndex: 'course_name', key: 'course_name' },
    { title: 'Grupo', dataIndex: 'group_name', key: 'group_name' },
    { title: 'Nombre', dataIndex: 'name', key: 'name' },
    { title: 'Apellidos', key: 'apellidos', render: (_: unknown, r: ReportRow) => `${r.first_surname ?? ''} ${r.second_surname ?? ''}`.trim() },
    { title: 'DNI', dataIndex: 'dni', key: 'dni' },
    { title: 'Email', dataIndex: 'email', key: 'email' },
    { title: 'Rol', dataIndex: 'role_shortname', key: 'role_shortname' },
    { title: '%', dataIndex: 'completion_percentage', key: 'completion_percentage', render: formatPercent },
    { title: 'Inicio grupo', dataIndex: 'group_start_date', key: 'group_start_date', render: (v?: string) => v ? dayjs(v).format('DD/MM/YYYY') : '' },
    { title: 'Fin grupo', dataIndex: 'group_end_date', key: 'group_end_date', render: (v?: string) => v ? dayjs(v).format('DD/MM/YYYY') : '' },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
        <Space wrap align="end">
          <div>
            <div style={{ marginBottom: 4 }}>Curso</div>
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="Todos los cursos"
              style={{ minWidth: 220 }}
              loading={facetsLoading}
              value={selectedCourse}
              onChange={(v) => { setSelectedCourse(v == null ? undefined : Number(v)); setSelectedGroup([]); setSelectedRowKeys([]); }}
              options={(facets?.courses ?? []).map((c) => ({ label: c.course_name ?? String(c.id_course), value: c.id_course }))}
            />
          </div>
          <div>
            <div style={{ marginBottom: 4 }}>Grupo</div>
            <Select
              mode="multiple"
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="Todos los grupos"
              style={{ minWidth: 220 }}
              disabled={!selectedCourse}
              loading={facetsLoading}
              value={selectedGroup}
              onChange={(v) => { setSelectedGroup(v); setSelectedRowKeys([]); }}
              options={(facets?.groups ?? []).map((g) => ({ label: g.group_name ?? String(g.id_group), value: g.id_group }))}
            />
          </div>
          <div>
            <div style={{ marginBottom: 4 }}>Rango fechas grupo</div>
            <DatePicker.RangePicker
              style={{ minWidth: 260 }}
              value={dateRange}
              format="DD/MM/YYYY"
              onChange={(dates) => { setDateRange(dates as [Dayjs | null, Dayjs | null] | undefined); setSelectedRowKeys([]); }}
              allowClear
            />
          </div>
        </Space>
        <Space>
          <Dropdown menu={{ items: seleccionMenuItems, onClick: handleSeleccionClick }}>
            <Button disabled={!rows.length}>Selección <DownOutlined /></Button>
          </Dropdown>
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={() => {
              if (!selectedRowKeys.length) { messageApi.warning('Selecciona al menos un alumno'); return; }
              setIsSendReportOpen(true);
            }}
          >
            Enviar informe
          </Button>
        </Space>
      </div>

      <Table<ReportRow>
        rowKey={getRowKey}
        dataSource={rows}
        columns={columns}
        loading={isLoading}
        pagination={false}
        scroll={{ x: 'max-content', y: 500 }}
        size="small"
        rowSelection={{
          type: 'checkbox',
          selectedRowKeys,
          onChange: (keys) => setSelectedRowKeys(keys as string[]),
          getCheckboxProps: (record: ReportRow) => ({ disabled: !isStudentRow(record) }),
        }}
      />

      <SendReportMailModal
        open={isSendReportOpen}
        selection={{ selected_keys: selectedRows.map(getRowKey) }}
        onOk={() => { setIsSendReportOpen(false); setSelectedRowKeys([]); }}
        onCancel={() => setIsSendReportOpen(false)}
      />
    </div>
  );
}
