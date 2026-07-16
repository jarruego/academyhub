import { useState } from 'react';
import { Card, Table, Tag, Input, Select, Space, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { AuthzHide } from '../permissions/authz-hide';
import { Role } from '../../hooks/api/auth/use-login.mutation';
import { useAuditLogQuery, type AuditLogRow } from '../../hooks/api/audit/use-audit-log.query';
import { PageHeader } from '../common/PageHeader';

const METHOD_COLORS: Record<string, string> = {
  POST: 'green',
  PUT: 'blue',
  PATCH: 'gold',
  DELETE: 'red',
};

const formatDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleString('es-ES');
  } catch {
    return iso;
  }
};

export default function AuditLog() {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [method, setMethod] = useState<string | undefined>(undefined);
  const [actor, setActor] = useState<string | undefined>(undefined);

  const { data, isLoading, isFetching } = useAuditLogQuery({ page, limit, method, actor });

  const columns: ColumnsType<AuditLogRow> = [
    { title: 'Fecha', dataIndex: 'created_at', key: 'created_at', width: 170, render: (v: string) => formatDate(v) },
    { title: 'Usuario', dataIndex: 'actor_username', key: 'actor_username', width: 130, render: (v) => v ?? <Typography.Text type="secondary">—</Typography.Text> },
    { title: 'Rol', dataIndex: 'actor_role', key: 'actor_role', width: 90, render: (v) => v ?? '—' },
    {
      title: 'Método', dataIndex: 'method', key: 'method', width: 90,
      render: (v: string | null) => (v ? <Tag color={METHOD_COLORS[v] ?? 'default'}>{v}</Tag> : '—'),
    },
    { title: 'Ruta', dataIndex: 'path', key: 'path', ellipsis: true },
    { title: 'Objetivo', dataIndex: 'target', key: 'target', width: 140, ellipsis: true, render: (v) => v ?? '—' },
    { title: 'Estado', dataIndex: 'status_code', key: 'status_code', width: 80, render: (v) => v ?? '—' },
    { title: 'IP', dataIndex: 'ip', key: 'ip', width: 130, render: (v) => v ?? '—' },
  ];

  return (
    <AuthzHide roles={[Role.ADMIN]}>
      <PageHeader title="Registro de auditoría" />
      <Card bordered style={{ margin: '0 auto' }}>
        <Space style={{ marginBottom: 16, flexWrap: 'wrap' }}>
          <Input.Search
            placeholder="Filtrar por usuario"
            allowClear
            style={{ width: 220 }}
            onSearch={(value) => { setActor(value || undefined); setPage(1); }}
          />
          <Select
            placeholder="Método"
            allowClear
            style={{ width: 140 }}
            value={method}
            onChange={(value) => { setMethod(value || undefined); setPage(1); }}
            options={[
              { value: 'POST', label: 'POST' },
              { value: 'PUT', label: 'PUT' },
              { value: 'PATCH', label: 'PATCH' },
              { value: 'DELETE', label: 'DELETE' },
            ]}
          />
        </Space>

        <Table<AuditLogRow>
          rowKey="id"
          size="small"
          columns={columns}
          dataSource={data?.data ?? []}
          loading={isLoading || isFetching}
          scroll={{ x: 'max-content' }}
          pagination={{
            current: page,
            pageSize: limit,
            total: data?.total ?? 0,
            showSizeChanger: true,
            pageSizeOptions: ['25', '50', '100', '200'],
            showTotal: (total) => `${total} registros`,
            onChange: (nextPage, nextSize) => {
              setPage(nextPage);
              if (nextSize !== limit) setLimit(nextSize);
            },
          }}
        />
      </Card>
    </AuthzHide>
  );
}
