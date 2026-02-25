import { Card, Typography } from 'antd';
import { FileTextOutlined } from '@ant-design/icons';

export default function MailTemplatesTab() {
  return (
    <Card title={<span><FileTextOutlined /> Plantillas de correo</span>} style={{ maxWidth: 700, margin: '0 auto' }}>
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
        <i>Próximamente podrás crear, editar y eliminar plantillas personalizadas.</i>
      </Typography.Paragraph>
    </Card>
  );
}
