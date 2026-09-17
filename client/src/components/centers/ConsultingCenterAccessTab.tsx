import { App, Button, Input, Typography, Descriptions } from 'antd';
import { ReloadOutlined, StopOutlined, CopyOutlined } from '@ant-design/icons';
import { useConsultingCenterTokenStatusQuery } from '../../hooks/api/consulting-center-token/use-consulting-center-token-status.query';
import { useIssueConsultingCenterTokenMutation } from '../../hooks/api/consulting-center-token/use-issue-consulting-center-token.mutation';
import { useRevokeConsultingCenterTokenMutation } from '../../hooks/api/consulting-center-token/use-revoke-consulting-center-token.mutation';

interface Props {
  centerId: number;
}

// Acceso externo del centro a su consultoría (token opaco, no JWT) — ver
// docs/consultoria.md, "Guards y acceso externo". Único y exclusivamente
// para centros dentro de una consultoría abierta — se genera solo la
// primera vez que se consulta esta pantalla, salvo que ya se hubiera
// revocado (2026-09-17, pedido explícito del usuario). El padre
// (center-detail.route.tsx) ya filtra para no montar este componente si el
// centro no es elegible — el `exists: false` de abajo es solo defensivo.
// Se guarda cifrado de forma reversible (APP_MASTER_KEY, mismo mecanismo
// que la contraseña SMTP de organización) además de su hash — ADMIN puede
// volver a verlo/copiarlo en cualquier momento.
export default function ConsultingCenterAccessTab({ centerId }: Props) {
  const { message, modal } = App.useApp();
  const { data: status, isLoading } = useConsultingCenterTokenStatusQuery(centerId);
  const { mutateAsync: issueToken, isPending: isIssuing } = useIssueConsultingCenterTokenMutation(centerId);
  const { mutateAsync: revokeToken, isPending: isRevoking } = useRevokeConsultingCenterTokenMutation(centerId);

  const handleRegenerate = () => {
    modal.confirm({
      title: '¿Regenerar el token?',
      content: 'El enlace anterior deja de funcionar al momento.',
      okText: 'Regenerar',
      cancelText: 'Cancelar',
      onOk: async () => {
        try {
          await issueToken();
          message.success('Token regenerado.');
        } catch {
          message.error('No se pudo regenerar el token.');
        }
      },
    });
  };

  const handleRevoke = () => {
    modal.confirm({
      title: '¿Revocar el token?',
      content: 'El centro dejará de poder usar su enlace de acceso externo al momento.',
      okText: 'Revocar',
      okType: 'danger',
      cancelText: 'Cancelar',
      onOk: async () => {
        try {
          await revokeToken();
          message.success('Token revocado.');
        } catch {
          message.error('No se pudo revocar el token.');
        }
      },
    });
  };

  const handleCopy = async (link: string) => {
    try {
      await navigator.clipboard.writeText(link);
      message.success('Enlace copiado.');
    } catch {
      message.error('No se pudo copiar — cópialo a mano.');
    }
  };

  if (isLoading || !status) return <div>Cargando...</div>;
  if (!status.exists) return <div>Este centro no participa en ninguna consultoría abierta.</div>;

  const isRevoked = !!status.revoked_at;
  const link = status.token ? `${window.location.origin}/consultoria-centro/${status.token}` : null;

  return (
    <div>
      <Typography.Paragraph type="secondary" style={{ marginTop: -4 }}>
        Enlace propio del centro para evaluar sus acciones formativas, sus competencias y registrar a los asistentes de sus propias acciones — sin necesidad de una cuenta de usuario normal. Alcance cerrado a los datos de este centro.
      </Typography.Paragraph>

      <Descriptions column={1} size="small" bordered style={{ maxWidth: 640, marginBottom: 16 }}>
        <Descriptions.Item label="Estado">{isRevoked ? 'Revocado' : 'Activo'}</Descriptions.Item>
        {link && (
          <Descriptions.Item label="Enlace">
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <Input.Password
                value={link}
                readOnly
                style={{ maxWidth: 400 }}
                visibilityToggle
              />
              <Button size="small" icon={<CopyOutlined />} onClick={() => handleCopy(link)}>
                Copiar
              </Button>
            </div>
          </Descriptions.Item>
        )}
        <Descriptions.Item label="Generado el">{new Date(status.created_at).toLocaleString()}</Descriptions.Item>
        {isRevoked && <Descriptions.Item label="Revocado el">{new Date(status.revoked_at as string).toLocaleString()}</Descriptions.Item>}
        <Descriptions.Item label="Último uso">{status.last_used_at ? new Date(status.last_used_at).toLocaleString() : 'Nunca'}</Descriptions.Item>
      </Descriptions>

      <div style={{ display: 'flex', gap: 8 }}>
        <Button icon={<ReloadOutlined />} loading={isIssuing} onClick={handleRegenerate}>
          Regenerar
        </Button>
        {!isRevoked && (
          <Button danger icon={<StopOutlined />} loading={isRevoking} onClick={handleRevoke}>
            Revocar
          </Button>
        )}
      </div>
    </div>
  );
}
