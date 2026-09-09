import { Collapse, Table, Typography, Tooltip, theme } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { CheckCircleOutlined, MinusCircleOutlined, StarOutlined } from '@ant-design/icons';
import { Role } from '../../hooks/api/auth/use-login.mutation';
import {
  PERMISSIONS_MATRIX_SECTIONS,
  PERMISSIONS_MATRIX_UPDATED_AT,
  PermissionMatrixAccess,
  PermissionMatrixRow,
} from './permissions-matrix.content';

const ROLE_LABELS: Record<Role, string> = {
  [Role.ADMIN]: 'Admin',
  [Role.MANAGER]: 'Manager',
  [Role.VIEWER]: 'Viewer',
  [Role.TUTOR]: 'Tutor',
  [Role.CONSULTOR]: 'Consultor',
};

const ROLE_ORDER: Role[] = [Role.ADMIN, Role.MANAGER, Role.VIEWER, Role.TUTOR, Role.CONSULTOR];

function AccessIcon({ value }: { value: PermissionMatrixAccess }) {
  const { token } = theme.useToken();
  if (value === 'yes') return <CheckCircleOutlined style={{ color: token.colorSuccess }} />;
  if (value === 'flag') {
    return (
      <Tooltip title="Solo si tiene marcado el permiso puntual de gestión de candidaturas (can_manage_candidates)">
        <StarOutlined style={{ color: token.colorWarning }} />
      </Tooltip>
    );
  }
  return <MinusCircleOutlined style={{ color: token.colorTextQuaternary }} />;
}

// Panel ADMIN-only en Gestión de usuarios: resumen legible de
// permissions-matrix.content.ts (que a su vez debe mantenerse en paralelo con
// docs/permissions-matrix.md — ver el comentario de cabecera de ese fichero).
export default function PermissionsMatrixPanel() {
  const columns: ColumnsType<PermissionMatrixRow> = [
    { title: 'Acción / Recurso', dataIndex: 'label', key: 'label', width: 300 },
    ...ROLE_ORDER.map((role) => ({
      title: ROLE_LABELS[role],
      key: role,
      align: 'center' as const,
      width: 90,
      render: (_: unknown, row: PermissionMatrixRow) => <AccessIcon value={row.access[role]} />,
    })),
    { title: 'Notas', dataIndex: 'note', key: 'note' },
  ];

  return (
    <Collapse
      style={{ marginTop: 16 }}
      items={[
        {
          key: 'permissions-matrix',
          label: 'Ver matriz de permisos por rol',
          children: (
            <>
              <Typography.Paragraph type="secondary">
                Resumen de qué puede hacer cada rol, área por área. El detalle técnico completo (endpoints y componentes concretos) vive en <code>docs/permissions-matrix.md</code>. Última actualización: {PERMISSIONS_MATRIX_UPDATED_AT}.
              </Typography.Paragraph>
              {PERMISSIONS_MATRIX_SECTIONS.map((section) => (
                <div key={section.key} style={{ marginBottom: 24 }}>
                  <Typography.Title level={5}>{section.title}</Typography.Title>
                  <Table
                    size="small"
                    pagination={false}
                    rowKey="label"
                    dataSource={section.rows}
                    columns={columns}
                    scroll={{ x: 'max-content' }}
                  />
                </div>
              ))}
            </>
          ),
        },
      ]}
    />
  );
}
