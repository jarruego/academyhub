import React, { useMemo, useState } from 'react';
import { Table, Button, message } from 'antd';
import { SaveOutlined, TeamOutlined, CloudDownloadOutlined, FileExcelOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { AuthzHide } from '../permissions/authz-hide';
import { Role } from '../../hooks/api/auth/use-login.mutation';
import { useUsersByGroupQuery } from '../../hooks/api/users/use-users-by-group.query';
import { useImportMoodleGroupMutation } from '../../hooks/api/moodle/use-import-moodle-group.mutation';
import { useGroupQuery } from '../../hooks/api/groups/use-group.query';
import { useCreateBonificationFileMutation } from '../../hooks/api/groups/use-create-bonification-file.mutation';
import { useUpdateUserMainCenterMutation } from '../../hooks/api/centers/use-update-user-main-center.mutation';
import { BonificationModal } from '../courses/BonificationModal';
import { User } from '../../shared/types/user/user';
import { USERS_TABLE_COLUMNS } from '../../constants/tables/users-table-columns.constant';

interface Props {
  groupId: number | null | undefined;
}

const GroupUsersManager: React.FC<Props> = ({ groupId }) => {
  const [messageApi, contextHolder] = message.useMessage();
  const navigate = useNavigate();
  const { data: usersData, isLoading, refetch } = useUsersByGroupQuery(groupId ? Number(groupId) : null);

  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [selectedCenters, setSelectedCenters] = useState<Record<number, number>>({});
  const [isBonificationModalOpen, setIsBonificationModalOpen] = useState(false);

  const createBonificationFile = useCreateBonificationFileMutation();
  const updateUserMainCenterMutation = useUpdateUserMainCenterMutation();
  const { mutateAsync: importMoodleGroup, isPending: importMoodleGroupPending } = useImportMoodleGroupMutation();
  const { data: groupData, isLoading: isGroupLoading } = useGroupQuery(groupId ? String(groupId) : undefined);


  const handleMark75 = () => {
    if (!usersData) return;
    const getRoleShortname = (user: User): string | null => {
      if (user.role_shortname) return user.role_shortname;
      // some responses may include a 'role' property; read it safely without using `any`
      const maybe = user as unknown as Record<string, unknown>;
      const r = maybe['role'];
      return typeof r === 'string' ? r : null;
    };
    const getPercent = (v: unknown) => {
      const n = Number(v ?? 0) || 0;
      return n > 0 && n <= 1 ? n * 100 : n;
    };
    const ids = usersData
      .filter((u: User) => {
        // only students
        const role = getRoleShortname(u);
        const isStudent = typeof role === 'string' ? role.toLowerCase() === 'student' : false;
        return isStudent && getPercent(u.completion_percentage) >= 75;
      })
      .map(u => u.id_user);
    setSelectedUserIds(ids);
  };

  const openBonification = () => {
    if (!selectedUserIds || selectedUserIds.length === 0) {
      messageApi.warning('Selecciona al menos un usuario para bonificar');
      return;
    }
    setIsBonificationModalOpen(true);
  };

  const handleConfirmBonification = async () => {
    if (!groupId) return;
    try {
      const blob = await createBonificationFile.mutateAsync({ groupId: Number(groupId), userIds: selectedUserIds });
      // download
      const selectedGroupName = `grupo_${groupId}`;
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedGroupName}.xml`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      messageApi.success('XML generado correctamente');
      setIsBonificationModalOpen(false);
    } catch (err) {
      messageApi.error('No se pudo generar el XML');
    }
  };

  const columns = useMemo(() => {
    return [
      ...USERS_TABLE_COLUMNS,
    ];
  }, []);

  return (
    <div>
      {contextHolder}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <AuthzHide roles={[Role.ADMIN]}>
            <Button
              type="default"
              icon={<TeamOutlined />}
              onClick={() => groupId ? navigate(`/groups/${groupId}/add-user`) : null}
            >
              Gestionar Usuarios del Grupo
            </Button>
            <Button
              type="default"
              icon={<FileExcelOutlined style={{ color: '#008000' }} />}
              onClick={() => groupId ? navigate(`/groups/${groupId}/import-users`) : null}
            >
              Importar XLS
            </Button>
            <Button
              type="default"
              icon={<CloudDownloadOutlined style={{ color: '#f56b00' }} />}
              onClick={async () => {
                if (!groupId) return;
                const moodleId = groupData?.moodle_id;
                if (!moodleId) {
                  message.warning('El grupo local no está asociado a un grupo de Moodle');
                  return;
                }

                try {
                  const response = await importMoodleGroup(moodleId);
                  const result = response.data;
                  if (result?.success) {
                    message.success(result.message || 'Usuarios importados desde Moodle');
                    refetch();
                  } else {
                    message.error(result?.error || 'Error al importar usuarios desde Moodle');
                  }
                } catch (err) {
                  console.error('Error importando usuarios desde Moodle:', err);
                  message.error('Error al traer usuarios desde Moodle');
                }
              }}
              loading={importMoodleGroupPending || isGroupLoading}
              disabled={isGroupLoading || !groupData?.moodle_id}
            >
              Traer de Moodle
            </Button>
          </AuthzHide>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button onClick={handleMark75} disabled={!usersData || usersData.length === 0}>Marcar ≥ 75%</Button>
          <Button onClick={openBonification} type="primary" icon={<SaveOutlined />}>
            Bonificar + XML FUNDAE
          </Button>
        </div>
      </div>

      <Table<User>
        rowKey="id_user"
        dataSource={usersData}
        columns={columns}
        loading={isLoading}
        pagination={false}
        // Fixed table header with vertical scroll
        scroll={{ y: 500 }}
        onRow={(record) => ({
          onDoubleClick: () => {
            try {
              const url = `${window.location.origin}/users/${record.id_user}`;
              window.open(url, '_blank', 'noopener,noreferrer');
            } catch (e) {
              // Fallback: open relative path
              window.open(`/users/${record.id_user}`, '_blank');
            }
          },
          style: { cursor: 'pointer' }
        })}
        rowSelection={{
          type: 'checkbox',
          selectedRowKeys: selectedUserIds,
          onChange: (keys: React.Key[]) => setSelectedUserIds(keys as number[]),
          getCheckboxProps: (record: User) => ({ id: `user-checkbox-${record.id_user}` }),
        }}
        size="small"
      />

      <BonificationModal
        open={isBonificationModalOpen}
        onCancel={() => setIsBonificationModalOpen(false)}
        onOk={handleConfirmBonification}
        users={usersData || []}
        selectedUserIds={selectedUserIds}
        selectedCenters={selectedCenters}
        setSelectedCenters={setSelectedCenters}
        updateUserMainCenterMutation={updateUserMainCenterMutation}
        refetchUsersByGroup={() => refetch?.()}
        message={messageApi}
        onRemoveUser={(id) => setSelectedUserIds(prev => prev.filter(x => x !== id))}
        contextHolder={contextHolder}
      />
    </div>
  );
};

export default GroupUsersManager;
