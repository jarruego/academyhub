import { Alert, Card } from 'antd';
import SmsTemplatesTab from '../../components/sms/SmsTemplatesTab';
import { useRole } from '../../utils/permissions/use-role';
import { Role } from '../../hooks/api/auth/use-login.mutation';

export default function SmsTemplatesPage() {
  const role = useRole();

  // Solo ADMIN, mismo criterio que las plantillas de correo (docs/permissions-matrix.md).
  if (role?.toLowerCase() !== Role.ADMIN) {
    return (
      <Card>
        <Alert
          message="Acceso denegado"
          description="Solo los administradores pueden acceder a las plantillas de SMS."
          type="error"
          showIcon
        />
      </Card>
    );
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: 24 }}>
      <SmsTemplatesTab />
    </div>
  );
}
