import { useState } from 'react';
import { Card, Table, Tag, Input, Select, Space, Typography, Tooltip, Button } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { AuthzHide } from '../permissions/authz-hide';
import { STATUS_COLORS } from '../../theme/semantic-colors';
import { Role } from '../../hooks/api/auth/use-login.mutation';
import { useSmsLogQuery, type SmsLogRow, type MailrelaySmsStatus } from '../../hooks/api/sms/use-sms-log.query';
import { useRefreshSmsLogStatusMutation } from '../../hooks/api/sms/use-refresh-sms-log-status.mutation';
import { PageHeader } from '../common/PageHeader';

const MAILRELAY_STATUS_LABEL: Record<MailrelaySmsStatus, { label: string; color: string }> = {
  not_processed: { label: 'Pendiente', color: 'default' },
  processed: { label: 'Procesado', color: 'blue' },
  ignored: { label: 'Ignorado', color: 'default' },
  delivered: { label: 'Entregado', color: STATUS_COLORS.active },
  failed: { label: 'Fallido (Mailrelay)', color: STATUS_COLORS.inactive },
  expired: { label: 'Expirado', color: 'orange' },
};

const formatDate = (iso: string | null) => {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString('es-ES');
  } catch {
    return iso;
  }
};

export default function SmsLog() {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [status, setStatus] = useState<string | undefined>(undefined);
  const [actor, setActor] = useState<string | undefined>(undefined);
  const [recipient, setRecipient] = useState<string | undefined>(undefined);

  const { data, isLoading, isFetching } = useSmsLogQuery({ page, limit, status, actor, recipient });
  const refreshStatus = useRefreshSmsLogStatusMutation();

  const columns: ColumnsType<SmsLogRow> = [
    { title: 'Fecha', dataIndex: 'created_at', key: 'created_at', width: 170, render: (v: string) => formatDate(v) },
    { title: 'Enviado por', dataIndex: 'actor_username', key: 'actor_username', width: 130, render: (v) => v ?? <Typography.Text type="secondary">—</Typography.Text> },
    { title: 'Destinatario', dataIndex: 'recipient', key: 'recipient', width: 160, render: (v) => v ?? '—' },
    { title: 'Plantilla', dataIndex: 'template_name', key: 'template_name', width: 160, ellipsis: true, render: (v) => v ?? '—' },
    { title: 'Remitente', dataIndex: 'sender_name', key: 'sender_name', width: 130, render: (v) => v ?? '—' },
    {
      title: 'Estado', key: 'status', width: 220,
      render: (_: unknown, row) => {
        if (row.status === 'failed') {
          return (
            <Tooltip title={row.error_message ?? 'Error'}>
              <Tag color={STATUS_COLORS.inactive}>Fallido</Tag>
            </Tooltip>
          );
        }
        if (!row.mailrelay_status) {
          return <Tag>Enviado</Tag>;
        }
        const info = MAILRELAY_STATUS_LABEL[row.mailrelay_status];
        return <Tag color={info.color}>{info.label}</Tag>;
      },
    },
    {
      title: 'Última consulta', dataIndex: 'mailrelay_status_checked_at', key: 'mailrelay_status_checked_at', width: 170,
      render: (v: string | null) => formatDate(v) ?? <Typography.Text type="secondary">—</Typography.Text>,
    },
    {
      title: '', key: 'actions', width: 60, fixed: 'right',
      render: (_: unknown, row) => (
        <Tooltip title={row.mailrelay_id ? 'Actualizar estado' : 'Sin id de Mailrelay para consultar'}>
          <Button
            size="small"
            type="text"
            icon={<ReloadOutlined />}
            disabled={!row.mailrelay_id}
            loading={refreshStatus.isPending && refreshStatus.variables === row.id}
            onClick={() => refreshStatus.mutate(row.id)}
          />
        </Tooltip>
      ),
    },
  ];

  return (
    <AuthzHide roles={[Role.ADMIN]}>
      <PageHeader title="Registro de envíos de SMS" />
      <Card bordered style={{ margin: '0 auto' }}>
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

        <Table<SmsLogRow>
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
