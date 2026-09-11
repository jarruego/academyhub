import { App, Card, Typography, Button, Table, Space } from 'antd';
import { MobileOutlined, PlusOutlined } from '@ant-design/icons';
import { useSmsTemplatesQuery, SmsTemplate, useDeleteSmsTemplateMutation } from '../../hooks/api/sms/use-sms-templates';
import { useState } from 'react';
import CreateSmsTemplateModal from './CreateSmsTemplateModal';
import EditSmsTemplateModal from './EditSmsTemplateModal';

export default function SmsTemplatesTab() {
  const { data, isLoading } = useSmsTemplatesQuery();

  const [modalOpen, setModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<SmsTemplate | null>(null);
  const deleteMutation = useDeleteSmsTemplateMutation();
  const { message: messageApi, modal } = App.useApp();

  const handleEdit = (template: SmsTemplate) => {
    setSelectedTemplate(template);
    setEditModalOpen(true);
  };

  const handleDelete = (template: SmsTemplate) => {
    modal.confirm({
      title: '¿Eliminar plantilla?',
      content: `¿Seguro que quieres eliminar la plantilla "${template.name}"?`,
      okText: 'Eliminar',
      okType: 'danger',
      cancelText: 'Cancelar',
      onOk: async () => {
        await deleteMutation.mutateAsync(template.id);
        messageApi.success('Plantilla eliminada');
      },
    });
  };

  return (
    <>
      <Card
        title={<span><MobileOutlined /> Plantillas de SMS</span>}
        style={{ maxWidth: 900, margin: '0 auto' }}
        extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>Añadir plantilla</Button>}
      >
        <Typography.Paragraph>
          Aquí podrás crear y gestionar plantillas de SMS con variables dinámicas para el envío masivo a alumnos.<br />
          <b>Variables disponibles:</b>
          <ul>
            <li><code>{'{NOMBRE_CURSO}'}</code> — Nombre del curso</li>
            <li><code>{'{FECHA_INICIO}'}</code> — Fecha de inicio del curso</li>
            <li><code>{'{FECHA_FIN}'}</code> — Fecha de fin del curso</li>
            <li><code>{'{USUARIO_MOODLE}'}</code> — Usuario de Moodle</li>
            <li><code>{'{CLAVE_MOODLE}'}</code> — Clave de Moodle</li>
          </ul>
        </Typography.Paragraph>
        <Table
          dataSource={data}
          loading={isLoading}
          rowKey="id"
          pagination={false}
          style={{ marginTop: 24 }}
          columns={[
            { title: 'Nombre', dataIndex: 'name', key: 'name' },
            { title: 'Mensaje', dataIndex: 'message', key: 'message', ellipsis: true },
            { title: 'Última modificación', dataIndex: 'updatedAt', key: 'updatedAt', render: (v: string) => new Date(v).toLocaleString() },
            {
              title: 'Acciones',
              key: 'actions',
              render: (_, record) => (
                <Space>
                  <Button size="small" onClick={() => handleEdit(record)}>Editar</Button>
                  <Button size="small" danger onClick={() => handleDelete(record)} loading={deleteMutation.isPending}>Eliminar</Button>
                </Space>
              ),
            },
          ]}
        />
      </Card>
      <CreateSmsTemplateModal open={modalOpen} onOk={() => setModalOpen(false)} onCancel={() => setModalOpen(false)} />
      <EditSmsTemplateModal open={editModalOpen} template={selectedTemplate} onOk={() => { setEditModalOpen(false); setSelectedTemplate(null); }} onCancel={() => { setEditModalOpen(false); setSelectedTemplate(null); }} />
    </>
  );
}
