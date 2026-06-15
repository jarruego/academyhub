import { useState } from 'react';
import { Card, Table, Tag, Input, Select, Space, Typography, Tooltip } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { AuthzHide } from '../permissions/authz-hide';
import { Role } from '../../hooks/api/auth/use-login.mutation';
import { useEmailLogQuery, type EmailLogRow } from '../../hooks/api/audit/use-email-log.query';

const SENDER_MODE_LABEL: Record<string, string> = {
  default: 'Organización',
  auth: 'Usuario',
  tutor: 'Tutor',
};

const formatDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleString('es-ES');
  } catch {
    return iso;
  }
};

export default function EmailLog() {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [status, setStatus] = useState<string | undefined>(undefined);
  const [actor, setActor] = useState<string | undefined>(undefined);
  const [recipient, setRecipient] = useState<string | undefined>(undefined);

  const { data, isLoading, isFetching } = useEmailLogQuery({ page, limit, status, actor, recipient });

  const columns: ColumnsType<EmailLogRow> = [
    { title: 'Fecha', dataIndex: 'created_at', key: 'created_at', width: 170, render: (v: string) => formatDate(v) },
    { title: 'Enviado por', dataIndex: 'actor_username', key: 'actor_username', width: 130, render: (v) => v ?? <Typography.Text type="secondary">—</Typography.Text> },
    { title: 'Destinatario', dataIndex: 'recipient', key: 'recipient', width: 200, ellipsis: true, render: (v) => v ?? '—' },
    { title: 'Asunto', dataIndex: 'subject', key: 'subject', ellipsis: true, render: (v) => v ?? '—' },
    { title: 'Plantilla', dataIndex: 'template_name', key: 'template_name', width: 140, ellipsis: true, render: (v) => v ?? '—' },
    {
      title: 'Remitente', dataIndex: 'sender_mode', key: 'sender_mode', width: 230,
      render: (v: string | null, row) => {
        const label = v ? (SENDER_MODE_LABEL[v] ?? v) : '—';
        // El correo real que ve el destinatario, entre paréntesis (más el nombre si lo hay)
        const realFrom = row.from_email
          ? (row.from_name ? `${row.from_name} <${row.from_email}>` : row.from_email)
          : null;
        return realFrom ? (
          <span>{label} <Typography.Text type="secondary">({realFrom})</Typography.Text></span>
        ) : label;
      },
    },
    {
      title: 'Moodle', dataIndex: 'via_moodle', key: 'via_moodle', width: 80,
      render: (v: boolean | null) => (v ? <Tag color="purple">Sí</Tag> : '—'),
    },
    {
      title: 'Estado', dataIndex: 'status', key: 'status', width: 110,
      render: (v: string, row) =>
        v === 'failed'
          ? (
            <Tooltip title={row.error_message ?? 'Error'}>
              <Tag color="error">Fallido</Tag>
            </Tooltip>
          )
          : <Tag color="success">Enviado</Tag>,
    },
  ];

  return (
    <AuthzHide roles={[Role.ADMIN]}>
      <Card title="Registro de envíos de correo" bordered style={{ margin: '0 auto' }}>
        <Space style={{ marginBottom: 16, flexWrap: 'wrap' }}>
          <Input.Search
            placeholder="Filtrar por remitente (usuario)"
            allowClear
            style={{ width: 220 }}
            onSearch={(value) => { setActor(value || undefined); setPage(1); }}
          />
          <Input.Search
            placeholder="Filtrar por destinatario"
            allowClear
            style={{ width: 220 }}
            onSearch={(value) => { setRecipient(value || undefined); setPage(1); }}
          />
          <Select
            placeholder="Estado"
            allowClear
            style={{ width: 140 }}
            value={status}
            onChange={(value) => { setStatus(value || undefined); setPage(1); }}
            options={[
              { value: 'sent', label: 'Enviado' },
              { value: 'failed', label: 'Fallido' },
            ]}
          />
        </Space>

        <Table<EmailLogRow>
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
            showTotal: (total) => `${total} envíos`,
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
