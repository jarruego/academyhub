
import { Card, Typography, Button, Table, Space, Modal, message } from 'antd';
import { FileTextOutlined, PlusOutlined } from '@ant-design/icons';
import { useMailTemplatesQuery, MailTemplate, useDeleteMailTemplateMutation } from '../../hooks/api/mail/use-mail-templates';
import { useState } from 'react';
import CreateMailTemplateModal from './CreateMailTemplateModal';
import EditMailTemplateModal from './EditMailTemplateModal';


export default function MailTemplatesTab() {
  const { data, isLoading } = useMailTemplatesQuery();

  const [modalOpen, setModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<MailTemplate | null>(null);
  const deleteMutation = useDeleteMailTemplateMutation();
  const [modal, modalContextHolder] = Modal.useModal();
  const [messageApi, messageContextHolder] = message.useMessage();

  const handleEdit = (template: MailTemplate) => {
    setSelectedTemplate(template);
    setEditModalOpen(true);
  };

  const handleDelete = (template: MailTemplate) => {
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
      {modalContextHolder}
      {messageContextHolder}
      <Card
        title={<span><FileTextOutlined /> Plantillas de correo</span>}
        style={{ maxWidth: 900, margin: '0 auto' }}
        extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>Añadir plantilla</Button>}
      >
        <Typography.Paragraph>
          Aquí podrás crear y gestionar plantillas de correo con variables dinámicas para enviar notificaciones a los usuarios.<br />
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
            { title: 'Asunto', dataIndex: 'subject', key: 'subject' },
            { title: 'Tipo', dataIndex: 'is_html', key: 'is_html', render: (v: boolean) => v ? 'HTML' : 'Texto' },
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
      <CreateMailTemplateModal open={modalOpen} onOk={() => setModalOpen(false)} onCancel={() => setModalOpen(false)} />
      <EditMailTemplateModal open={editModalOpen} template={selectedTemplate} onOk={() => { setEditModalOpen(false); setSelectedTemplate(null); }} onCancel={() => { setEditModalOpen(false); setSelectedTemplate(null); }} />
    </>
  );
}
