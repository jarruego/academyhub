import { Alert, Card } from 'antd';
import MailTemplatesTab from '../../components/mail/MailTemplatesTab';
import { useRole } from '../../utils/permissions/use-role';
import { Role } from '../../hooks/api/auth/use-login.mutation';

export default function MailTemplatesPage() {
  const role = useRole();

  // Solo ADMIN (decisión 2026-09-09, ver docs/permissions-matrix.md): igual
  // que smtp-settings.route.tsx, esta pantalla ya estaba oculta del menú
  // "Administración" pero sin guard propio era visible por URL directa.
  if (role?.toLowerCase() !== Role.ADMIN) {
    return (
      <Card>
        <Alert
          message="Acceso denegado"
          description="Solo los administradores pueden acceder a las plantillas de correo."
          type="error"
          showIcon
        />
      </Card>
    );
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: 24 }}>
      <MailTemplatesTab />
    </div>
  );
}
