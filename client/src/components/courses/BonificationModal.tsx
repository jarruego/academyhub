import { Modal, Table, Button, Select, App } from "antd";
import type { ColumnGroupType, ColumnType } from "antd/es/table";
import { User } from "../../shared/types/user/user";
import React from "react";
import { USERS_TABLE_COLUMNS } from "../../constants/tables/users-table-columns.constant";
import type { UseMutationResult } from '@tanstack/react-query';
import type { UpdateUserMainCenterPayload } from '../../hooks/api/centers/use-update-user-main-center.mutation';

interface BonificationModalProps {
  open: boolean;
  onCancel: () => void;
  onOk: () => void;
  users: User[];
  selectedUserIds: number[];
  selectedCenters: Record<number, number>;
  setSelectedCenters: React.Dispatch<React.SetStateAction<Record<number, number>>>;
  updateUserMainCenterMutation: UseMutationResult<void, unknown, UpdateUserMainCenterPayload>;
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
  updateUserMainCenterMutation,
  refetchUsersByGroup,
  message,
  onRemoveUser,
  contextHolder,
}) => {
  const columns: (ColumnGroupType<User> | ColumnType<User>)[] = [
    {
      title: 'Centro (empresa)',
      dataIndex: 'centro_select',
      render: (_: unknown, user: User) => {
        const selected = selectedCenters[user.id_user] ?? user.centers?.find(c => c.is_main_center)?.id_center ?? user.centers?.[0]?.id_center;
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Select
              id={`center-select-${user.id_user}`}
              style={{ minWidth: 220 }}
              value={selected}
              placeholder={user.centers?.length ? 'Selecciona centro' : 'Sin centros'}
              options={user.centers?.map(center => ({
                value: center.id_center,
                label: `${center.center_name} (${center.company_name ?? ''})${center.is_main_center ? ' (principal)' : ''}`
              }))}
              allowClear
              onChange={val => setSelectedCenters(prev => ({ ...prev, [user.id_user]: val }))}
            />
            {selected && (
              <Button
                type="primary"
                size="small"
                loading={updateUserMainCenterMutation.isPending}
                onClick={() => updateUserMainCenterMutation.mutate(
                  { userId: user.id_user, centerId: selected },
                  {
                    onSuccess: () => {
                      message.success('Centro principal actualizado');
                      refetchUsersByGroup();
                    },
                    onError: () => message.error('Error al actualizar el centro principal')
                  }
                )}
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
