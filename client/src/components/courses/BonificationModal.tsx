import { Modal, Table, Button, Select, App, Alert } from "antd";
import type { ColumnGroupType, ColumnType } from "antd/es/table";
import { User } from "../../shared/types/user/user";
import React, { useMemo, useState } from "react";
import { USERS_TABLE_COLUMNS, filterUsersTimeSpentColumn } from "../../constants/tables/users-table-columns.constant";
import type { UseMutationResult } from '@tanstack/react-query';
import type { UpdateUserEnrollmentCenterPayload } from '../../hooks/api/groups/use-update-user-enrollment-center.mutation';
import { useRole } from "../../utils/permissions/use-role";
import { Role } from "../../hooks/api/auth/use-login.mutation";
import { detectDocumentType } from "../../utils/detect-document-type";

interface BonificationModalProps {
  // Additional props
  open: boolean;
  onCancel: () => void;
  onOk: () => void;
  users: User[];
  itopTrainingEnabled: boolean;
  selectedUserIds: number[];
  selectedCenters: Record<number, number>;
  setSelectedCenters: React.Dispatch<React.SetStateAction<Record<number, number>>>;
  // mutation to update the enrollment center (user_group.id_center)
  groupId: number | null | undefined;
  updateUserEnrollmentCenterMutation: UseMutationResult<void, unknown, UpdateUserEnrollmentCenterPayload>;
  refetchUsersByGroup: () => void;
  message: ReturnType<typeof App.useApp>["message"];
  onRemoveUser: (userId: number) => void;
  contextHolder?: React.ReactNode;
}

export const BonificationModal: React.FC<BonificationModalProps> = ({
  open,
  onCancel,
  onOk,
  users,
  itopTrainingEnabled,
  selectedUserIds,
  selectedCenters,
  setSelectedCenters,
  groupId,
  updateUserEnrollmentCenterMutation,
  refetchUsersByGroup,
  message,
  onRemoveUser,
  contextHolder,
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const role = useRole();
  const canEdit = role === Role.ADMIN || role === Role.MANAGER;

  // Validate selected users for export errors
  // Validation logic
  const validationErrors = useMemo(() => {
    const selectedUsers = users.filter(u => selectedUserIds.includes(u.id_user));
    const errors: Array<{ userId: number; name: string; errors: string[] }> = [];

    // Email regex for basic validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    // Check for missing email, DNI/NIE, phone, invalid email format, and invalid DNI/NIE
    selectedUsers.forEach(user => {
      const userErrors: string[] = [];

      if (!user.email || String(user.email).trim().length === 0) {
        userErrors.push('Sin email');
      } else if (!emailRegex.test(String(user.email).trim())) {
        userErrors.push(`Email inválido: ${user.email}`);
      }

      if (!user.phone || String(user.phone).trim().length === 0) {
        userErrors.push('Sin teléfono');
      } else {
        // Validate phone: extract only digits and check if the resulting number is > 0
        const phoneDigits = String(user.phone).replace(/[^0-9]/g, '');
        if (phoneDigits.length === 0 || Number(phoneDigits) === 0) {
          userErrors.push(`Teléfono inválido: ${user.phone}`);
        }
      }

      if (!user.dni || String(user.dni).trim().length === 0) {
        userErrors.push('Sin DNI/NIE');
      } else {
        // Validate DNI/NIE format using detectDocumentType
        const docType = detectDocumentType(String(user.dni).trim());
        if (!docType) {
          userErrors.push(`DNI/NIE inválido: ${user.dni}`);
        }
      }

      // Validar CIF empresa vacío
      const cifVacio = !(user as any).enrollment_company_cif || String((user as any).enrollment_company_cif).trim().length === 0;
      if (cifVacio) {
        userErrors.push('CIF de empresa vacío');
      }

      if (userErrors.length > 0 || cifVacio) {
        errors.push({
          userId: user.id_user,
          name: `${user.name} ${user.first_surname || ''} ${user.second_surname || ''}`.trim(),
          errors: userErrors,
        });
      }
    });

    // Check for duplicate emails (similar emails)
    const emailMap = new Map<string, number[]>();
    selectedUsers.forEach(user => {
      if (user.email && emailRegex.test(String(user.email).trim())) {
        const email = String(user.email).toLowerCase().trim();
        if (!emailMap.has(email)) {
          emailMap.set(email, []);
        }
        emailMap.get(email)!.push(user.id_user);
      }
    });

    // Find duplicate emails
    for (const [email, userIds] of emailMap) {
      if (userIds.length > 1) {
        userIds.forEach(uid => {
          const user = selectedUsers.find(u => u.id_user === uid);
          if (user) {
            const existing = errors.find(e => e.userId === uid);
            if (existing) {
              existing.errors.push(`Email duplicado: ${email}`);
            } else {
              errors.push({
                userId: uid,
                name: `${user.name} ${user.first_surname || ''} ${user.second_surname || ''}`.trim(),
                errors: [`Email duplicado: ${email}`],
              });
            }
          }
        });
      }
    }

    return errors;
  }, [users, selectedUserIds]);

  // Extiende el tipo User para incluir enrollment_company_cif localmente
  type UserWithCif = User & { enrollment_company_cif?: string };

  const columns: (ColumnGroupType<UserWithCif> | ColumnType<UserWithCif>)[] = [
    {
      title: 'DNI/NIE',
      dataIndex: 'dni',
      width: 120,
      render: (dni: unknown) => (
        <span style={{ fontFamily: 'monospace' }}>
          {String(dni) || '-'}
        </span>
      ),
    },
    {
      title: 'Centro (empresa)',
      dataIndex: 'centro_select',
      render: (_: unknown, user: UserWithCif & { enrollment_center_id?: number | null }) => {
    // Prefer enrollment center if available (comes from backend as enrollment_center_id)
  const enrollmentCenterId = user.enrollment_center_id ?? undefined;
    const selected = selectedCenters[user.id_user] ?? enrollmentCenterId ?? user.centers?.find(c => c.is_main_center)?.id_center ?? user.centers?.[0]?.id_center;

        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Select
              id={`center-select-${user.id_user}`}
              style={{ minWidth: 220 }}
              popupMatchSelectWidth={false}
              value={selected}
              placeholder={user.centers?.length ? 'Selecciona centro' : 'Sin centros'}
              options={user.centers?.map(center => ({
                value: center.id_center,
                // Antd Select accepts ReactNode as label; render principal badge always for main center,
                // but render the red "Antiguo" badge only when this center is the currently selected value
                label: (
                  <span>
                    <span>{center.center_name}</span>
                    <span style={{ color: '#666', marginLeft: 6 }}>({center.company_name ?? ''})</span>
                    {center.is_main_center ? (
                      <span style={{ marginLeft: 8, backgroundColor: 'darkgreen', color: 'white', padding: '2px 6px', borderRadius: 8, fontSize: '0.75em' }}>(principal)</span>
                    ) : (center.id_center === enrollmentCenterId ? (
                      <span style={{ marginLeft: 8, backgroundColor: 'darkred', color: 'white', padding: '2px 6px', borderRadius: 8, fontSize: '0.75em' }}>Antiguo</span>
                    ) : null)}
                  </span>
                )
              }))}
              allowClear
              disabled={!canEdit}
              onChange={val => setSelectedCenters(prev => ({ ...prev, [user.id_user]: val }))}
            />
            {selected && (
              <Button
                type="primary"
                size="small"
                loading={updateUserEnrollmentCenterMutation.isPending}
                disabled={!canEdit}
                onClick={() => {
                  if (!groupId) {
                    message.error('Group ID desconocido');
                    return;
                  }
                  updateUserEnrollmentCenterMutation.mutate(
                    { groupId: Number(groupId), userId: user.id_user, centerId: Number(selected) },
                    {
                      onSuccess: () => {
                        message.success('Centro de matrícula actualizado');
                        refetchUsersByGroup();
                      },
                      onError: () => message.error('Error al actualizar el centro de matrícula')
                    }
                  );
                }}
              >
                Guardar
              </Button>
            )}
          </div>
        );
      }
    },
    {
      title: 'CIF Empresa',
      dataIndex: 'enrollment_company_cif',
      width: 140,
      sorter: (a, b) => {
        const cifA = (a.enrollment_company_cif || '').toLowerCase();
        const cifB = (b.enrollment_company_cif || '').toLowerCase();
        if (cifA < cifB) return -1;
        if (cifA > cifB) return 1;
        return 0;
      },
      render: (_: unknown, user: UserWithCif & { centers?: any[] }) => {
        const cif = user.enrollment_company_cif || '';
        // Buscar el centro seleccionado o principal
        const selectedCenterId = selectedCenters[user.id_user];
        let center = user.centers?.find(c => c.id_center === selectedCenterId);
        if (!center && user.centers?.length) {
          center = user.centers.find(c => c.is_main_center) || user.centers[0];
        }
        // CIF no está disponible en el tipo center, así que mostramos '-'
        return (
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: !cif ? 'red' : undefined, fontFamily: 'monospace' }}>{cif || '-'}</span>
            {!cif && center && (
              <Button
                size="small"
                type="primary"
                style={{ padding: '0 8px', fontSize: 12 }}
                loading={isRefreshing || updateUserEnrollmentCenterMutation.isPending}
                onClick={async () => {
                  if (!groupId || !center) return;
                  setIsRefreshing(true);
                  try {
                    await updateUserEnrollmentCenterMutation.mutateAsync({ groupId: Number(groupId), userId: user.id_user, centerId: center.id_center });
                    message.success('CIF actualizado desde el centro');
                    await Promise.resolve(refetchUsersByGroup());
                  } catch (err) {
                    message.error('No se pudo actualizar el CIF desde el centro');
                  } finally {
                    setIsRefreshing(false);
                  }
                }}
              >
                CIF centro
              </Button>
            )}
          </span>
        );
      },
    },
    ...filterUsersTimeSpentColumn(
      USERS_TABLE_COLUMNS.filter(col => col.title !== 'Centro' && col.title !== 'Empresa'),
      itopTrainingEnabled
    ),
    {
      title: 'Acciones',
      key: 'acciones',
      render: (_: unknown, record: User) => (
        <Button danger size="small" disabled={!canEdit} onClick={() => onRemoveUser(record.id_user)}>
          Quitar
        </Button>
      ),
    },
  ];

  return (
    <>
      {contextHolder}
      <Modal
        open={open}
        title="Bonificar usuarios seleccionados y crear XML FUNDAE"
        onCancel={onCancel}
        onOk={onOk}
        okText="Bonificar y generar XML"
        cancelText="Cancelar"
        width="90vw"
        style={{ top: 20, minHeight: '90vh', maxWidth: '90vw' }}
        styles={{ body: { minHeight: '80vh', maxHeight: '80vh', overflowY: 'auto' } }}
        confirmLoading={isRefreshing}
        okButtonProps={{ disabled: validationErrors.some(e => e.errors.some(err => err.includes('CIF de empresa vacío'))) || validationErrors.length > 0 }}
      >
        {/* Mensaje global si hay algún CIF vacío */}
        {validationErrors.some(e => e.errors.some(err => err.includes('CIF de empresa vacío'))) && (
          <Alert
            type="error"
            message="No se puede bonificar: hay usuarios con el CIF de empresa vacío."
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}
        {validationErrors.length > 0 && (
          <Alert
            type="error"
            message="Errores en usuarios detectados"
            description={
              <div style={{ marginTop: 8 }}>
                {validationErrors.map(error => (
                  <div key={error.userId} style={{ marginBottom: 12, padding: 8, backgroundColor: '#fff1f0', borderRadius: 4, border: '1px solid #ffccc7' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                      <strong>{error.name}</strong>
                      <Button
                        size="small"
                        type="primary"
                        onClick={() => window.open(`/users/${error.userId}`, '_blank', 'noopener')}
                      >
                        Corregir
                      </Button>
                    </div>
                    <ul style={{ margin: '4px 0 0 20px', paddingLeft: 0 }}>
                      {error.errors.map((err, idx) => (
                        <li key={idx} style={{ color: 'darkred' }}>
                          {err}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            }
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

        <Table<UserWithCif>
          rowKey="id_user"
          dataSource={users.filter(u => selectedUserIds.includes(u.id_user)) as UserWithCif[]}
          columns={columns}
          pagination={false}
          size="small"
          onRow={(record) => ({
            onDoubleClick: () => {
              const uid = Number(record.id_user);
              if (!Number.isFinite(uid)) return;
              window.open(`/users/${uid}`, '_blank', 'noopener');
            },
            style: { cursor: 'pointer' }
          })}
        />
        {selectedUserIds.length === 0 && <div style={{color: 'red', marginTop: 12}}>No hay usuarios seleccionados.</div>}
      </Modal>
    </>
  );
};
