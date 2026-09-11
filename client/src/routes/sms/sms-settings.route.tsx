import { Alert, Card } from 'antd';
import SmsConfigTab from '../../components/sms/SmsConfigTab';
import { useRole } from '../../utils/permissions/use-role';
import { Role } from '../../hooks/api/auth/use-login.mutation';

export default function SmsSettingsPage() {
  const role = useRole();

  // Solo ADMIN, mismo criterio que la configuración SMTP (docs/permissions-matrix.md).
  if (role?.toLowerCase() !== Role.ADMIN) {
    return (
      <Card>
        <Alert
          message="Acceso denegado"
          description="Solo los administradores pueden acceder a la configuración de SMS."
          type="error"
          showIcon
        />
      </Card>
    );
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: 24 }}>
      <SmsConfigTab />
    </div>
  );
}
