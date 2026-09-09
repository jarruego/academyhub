import { Alert, Card } from 'antd';
import MailConfigTab from '../../components/mail/MailConfigTab';
import { useRole } from '../../utils/permissions/use-role';
import { Role } from '../../hooks/api/auth/use-login.mutation';

export default function CorreoPage() {
  const role = useRole();

  // Solo ADMIN (decisión 2026-09-09, ver docs/permissions-matrix.md): esta
  // pantalla ya estaba oculta del menú "Administración" para el resto de
  // roles, pero al no tener guard propio, quien tecleara la URL directamente
  // veía el formulario completo (host/usuario SMTP, password enmascarada).
  if (role?.toLowerCase() !== Role.ADMIN) {
    return (
      <Card>
        <Alert
          message="Acceso denegado"
          description="Solo los administradores pueden acceder a la configuración de correo."
          type="error"
          showIcon
        />
      </Card>
    );
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: 24 }}>
      <MailConfigTab />
    </div>
  );
}
