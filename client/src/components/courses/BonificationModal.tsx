import { Modal, Table, Button, Select, App } from "antd";
import type { ColumnGroupType, ColumnType } from "antd/es/table";
import { User } from "../../shared/types/user/user";
import React from "react";
import { USERS_TABLE_COLUMNS } from "../../constants/tables/users-table-columns.constant";
import type { UseMutationResult } from '@tanstack/react-query';
import type { UpdateUserEnrollmentCenterPayload } from '../../hooks/api/groups/use-update-user-enrollment-center.mutation';

interface BonificationModalProps {
  open: boolean;
  onCancel: () => void;
  onOk: () => void;
  users: User[];
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
  const columns: (ColumnGroupType<User> | ColumnType<User>)[] = [
    {
      title: 'Centro (empresa)',
      dataIndex: 'centro_select',
      render: (_: unknown, user: User & { enrollment_center_id?: number | null }) => {
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
              onChange={val => setSelectedCenters(prev => ({ ...prev, [user.id_user]: val }))}
            />
            {selected && (
              <Button
                type="primary"
                size="small"
                loading={updateUserEnrollmentCenterMutation.isPending}
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
    ...USERS_TABLE_COLUMNS.filter(col => col.title !== 'Centro' && col.title !== 'Empresa'),
    {
      title: 'Acciones',
      key: 'acciones',
      render: (_: unknown, record: User) => (
        <Button danger size="small" onClick={() => onRemoveUser(record.id_user)}>
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
      >
        <Table<User>
          rowKey="id_user"
          dataSource={users.filter(u => selectedUserIds.includes(u.id_user))}
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
