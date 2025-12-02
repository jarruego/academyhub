import React, { useMemo, useState } from 'react';
import { Table, Button, message, Modal, notification } from 'antd';
import { SaveOutlined, TeamOutlined, CloudDownloadOutlined, FileExcelOutlined, MailOutlined, MobileOutlined } from '@ant-design/icons';
import { AuthzHide } from '../permissions/authz-hide';
import CreateUserGroupModal from './CreateUserGroupModal';
import ImportUsersToGroupModal from './ImportUsersToGroupModal';
import { Role } from '../../hooks/api/auth/use-login.mutation';
import { useUsersByGroupQuery } from '../../hooks/api/users/use-users-by-group.query';
import { useGroupQuery } from '../../hooks/api/groups/use-group.query';
import { useCreateBonificationFileMutation } from '../../hooks/api/groups/use-create-bonification-file.mutation';
import { useUpdateUserEnrollmentCenterMutation } from '../../hooks/api/groups/use-update-user-enrollment-center.mutation';
import { BonificationModal } from '../courses/BonificationModal';
import { User } from '../../shared/types/user/user';
import { USERS_TABLE_COLUMNS } from '../../constants/tables/users-table-columns.constant';
import { useSyncMoodleGroupMembersMutation } from '../../hooks/api/moodle/use-sync-moodle-group-members.mutation';
import useExportUsersToMailCsv from '../../hooks/api/groups/use-export-users-mail-csv';
import useExportUsersToSmsCsv from '../../hooks/api/groups/use-export-users-sms-csv';

interface Props {
  groupId: number | null | undefined;
}

const GroupUsersManager: React.FC<Props> = ({ groupId }) => {
  const [messageApi, contextHolder] = message.useMessage();
  const [modal, modalContextHolder] = Modal.useModal();
  const [notificationApi, notificationContextHolder] = notification.useNotification();

  const extractSummary = (text?: string) => {
    if (!text) return '';
    const marker = '\nErrores:\n';
    const idx = text.indexOf(marker);
    return idx !== -1 ? text.slice(0, idx) : text;
  };
  const { data: usersData, isLoading, refetch } = useUsersByGroupQuery(groupId ? Number(groupId) : null);

  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [selectedCenters, setSelectedCenters] = useState<Record<number, number>>({});
  const [isBonificationModalOpen, setIsBonificationModalOpen] = useState(false);
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  const createBonificationFile = useCreateBonificationFileMutation();
  const updateUserEnrollmentCenterMutation = useUpdateUserEnrollmentCenterMutation();
  const { mutateAsync: syncMoodleGroupMembers, isPending: syncMoodleGroupMembersPending } = useSyncMoodleGroupMembersMutation();

  const { data: groupData, isLoading: isGroupLoading } = useGroupQuery(groupId ? String(groupId) : undefined);
  const exportUsersToMailCsv = useExportUsersToMailCsv();
  const exportUsersToSmsCsv = useExportUsersToSmsCsv();

  // NOTE: we intentionally avoid mounting a course query on every render because the
  // course short_name is only needed when exporting SMS CSV. Instead we pass the
  // groupData.id_course to the export hook and let it fetch the course lazily when
  // the export is triggered.


  const handleMark75 = () => {
    if (!usersData) return;
    const getRoleShortname = (user: User): string | null => {
      if (user.role_shortname) return user.role_shortname;
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
      const response = await createBonificationFile.mutateAsync({ groupId: Number(groupId), userIds: selectedUserIds });
      const blob = response.data as Blob;

      // Determine filename: prefer Content-Disposition from server, otherwise use group name
      let filename = `grupo_${groupId}.xml`;
      try {
        const cd = response.headers?.['content-disposition'] || response.headers?.['Content-Disposition'];
        if (cd) {
          // Common patterns: filename="name.xml" or filename*=UTF-8''name.xml
          const fnStar = /filename\*=(?:UTF-8''?)?([^;\n\r]+)/i.exec(cd);
          const fn = fnStar ? decodeURIComponent(fnStar[1].trim()) : (/filename="?([^";]+)"?/i.exec(cd)?.[1]);
          if (fn) filename = fn.replace(/\s+$/g, '');
        } else if (groupData?.group_name) {
          filename = `${groupData.group_name.replace(/[^a-zA-Z0-9_-]/g, '_')}.xml`;
        }
      } catch (err) {
        // fallback handled below
      }

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
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
    const moodleColumn = {
      title: 'M',
      dataIndex: 'id_moodle_user',
      key: 'moodle',
      width: 48,
      render: (_: unknown, user: User) => {
        // backend now returns id_moodle_user on the user when available
        const has = (user as any).id_moodle_user;
        if (typeof has === 'undefined' || has === null) return <span style={{ color: '#ff4d4f', fontWeight: 700 }}>N</span>;
        return <span style={{ color: '#52c41a', fontWeight: 700 }}>S</span>;
      }
    } as any;

    return [moodleColumn, ...USERS_TABLE_COLUMNS];
  }, [usersData]);

  // Compute totals for footer: total students and students with >=75% completion
  const { totalStudents, studentsAtOrAbove75 } = useMemo(() => {
    let total = 0;
    let at75 = 0;
    if (!usersData || usersData.length === 0) return { totalStudents: 0, studentsAtOrAbove75: 0 };

    const getRoleShortname = (user: User): string | null => {
      if (user.role_shortname) return user.role_shortname;
      const maybe = user as unknown as Record<string, unknown>;
      const r = maybe['role'];
      return typeof r === 'string' ? r : null;
    };

    const getPercent = (v: unknown) => {
      const n = Number(v ?? 0) || 0;
      return n > 0 && n <= 1 ? n * 100 : n;
    };

    for (const u of usersData) {
      const role = getRoleShortname(u);
      const isStudent = typeof role === 'string' ? role.toLowerCase() === 'student' : false;
      if (isStudent) {
        total += 1;
        const pct = getPercent(u.completion_percentage);
        if (pct >= 75) at75 += 1;
      }
    }

    return { totalStudents: total, studentsAtOrAbove75: at75 };
  }, [usersData]);

  return (
    <div>
  {contextHolder}
  {modalContextHolder}
  {notificationContextHolder}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <AuthzHide roles={[Role.ADMIN]}>
            <Button
              type="default"
              icon={<TeamOutlined />}
              onClick={() => groupId ? setIsManageModalOpen(true) : null}
            >
              Gestionar Usuarios del Grupo
            </Button>
            <Button
              type="default"
              icon={<FileExcelOutlined style={{ color: '#008000' }} />}
              onClick={() => groupId ? setIsImportModalOpen(true) : null}
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
                  messageApi.warning('El grupo local no está asociado a un grupo de Moodle');
                  return;
                }

                try {
                  // Call lightweight per-user sync instead of the full import
                  const response = await syncMoodleGroupMembers(moodleId);
                  const result = response.data;
                  if (result?.success) {
                    // Show both a toast and a persistent notification with the summary message
                    messageApi.success(result.message || 'Usuarios sincronizados desde Moodle');
                    notificationApi.success({
                      message: 'Sincronización completada',
                      description: result.message || 'Usuarios sincronizados desde Moodle',
                      duration: 5,
                    });

                    // If there are per-user errors, also show a modal with up to 10 entries.
                    // Open the modal slightly after showing notifications so they remain visible.
                    if (result.details && result.details.length > 0) {
                      const max = 10;
                      const items = result.details.slice(0, max).map((d: any, idx: number) => {
                        const idPart = d.userId ?? 'id?';
                        const userPart = d.username ? `${d.username} (${idPart})` : `${idPart}`;
                        return <li key={idx}>{`${userPart}: ${d.error}`}</li>;
                      });
                      const more = result.details.length > max ? <p>... y {result.details.length - max} más</p> : null;
                      setTimeout(() => {
                        const summary = extractSummary(result.message);
                        modal.info({
                          title: 'Sincronización completada con errores',
                          width: 600,
                          content: (
                            <div>
                              <p>{summary}</p>
                              <div>
                                <strong>Errores:</strong>
                                <ul style={{ marginTop: 8 }}>{items}</ul>
                                {more}
                              </div>
                            </div>
                          ),
                        });
                      }, 100);
                    }
                    refetch();
                  } else {
                    // If the operation returned failure, show details if present
                    if (result?.details && result.details.length > 0) {
                      const max = 10;
                      const items = result.details.slice(0, max).map((d: any, idx: number) => {
                        const idPart = d.userId ?? 'id?';
                        const userPart = d.username ? `${d.username} (${idPart})` : `${idPart}`;
                        return <li key={idx}>{`${userPart} - ${d.error}`}</li>;
                      });
                      const more = result.details.length > max ? <p>... y {result.details.length - max} más</p> : null;
                      // Show modal including the summary message and the list of errors
                      setTimeout(() => {
                        const summary = extractSummary(result.message);
                        modal.error({
                          title: 'Error al sincronizar usuarios desde Moodle',
                          width: 600,
                          content: (
                            <div>
                              <p>{summary}</p>
                              <div>
                                <strong>Errores:</strong>
                                <ul style={{ marginTop: 8 }}>{items}</ul>
                                {more}
                              </div>
                            </div>
                          ),
                        });
                      }, 100);
                    } else {
                      messageApi.error(result?.error || result?.message || 'Error al sincronizar usuarios desde Moodle');
                    }
                  }
                } catch (err) {
                  console.error('Error sincronizando usuarios desde Moodle:', err);
                  messageApi.error('Error al traer usuarios desde Moodle');
                }
              }}
              loading={(syncMoodleGroupMembersPending) || isGroupLoading}
              disabled={isGroupLoading || !groupData?.moodle_id}
            >
              Traer Moodle
            </Button>
            <Button
              type="default"
              icon={<MailOutlined />}
              onClick={async () => {
                if (!usersData || usersData.length === 0) return messageApi.warning('No hay usuarios para exportar');
                if (!selectedUserIds || selectedUserIds.length === 0) return messageApi.warning('Selecciona al menos un usuario para exportar');
                try {
                  const result = await exportUsersToMailCsv(selectedUserIds, usersData, groupData?.group_name);
                  if (!result || result.rowsCount === 0) {
                    // treated as cancellation (user closed save dialog) or nothing exported
                    messageApi.info('Exportación cancelada');
                    return;
                  }
                  messageApi.success(`CSV exportado correctamente (${result.rowsCount} filas)`);
                } catch (err) {
                  console.error('Error exportando CSV', err);
                  messageApi.error('Error al exportar CSV');
                }
              }}
              disabled={isGroupLoading}
            >
              .csv
            </Button>
            <Button
              type="default"
              icon={<MobileOutlined />}
              onClick={async () => {
                if (!usersData || usersData.length === 0) return messageApi.warning('No hay usuarios para exportar');
                if (!selectedUserIds || selectedUserIds.length === 0) return messageApi.warning('Selecciona al menos un usuario para exportar');
                try {
                  const courseId = groupData?.id_course;
                  const groupName = groupData?.group_name ?? '';
                  const result = await exportUsersToSmsCsv(selectedUserIds, usersData, courseId, groupName);
                  if (!result || result.rowsCount === 0) {
                    messageApi.info('Exportación cancelada');
                    return;
                  }
                  messageApi.success(`CSV SMS exportado correctamente (${result.rowsCount} filas)`);
                } catch (err) {
                  console.error('Error exportando SMS CSV', err);
                  messageApi.error('Error al exportar SMS CSV');
                }
              }}
              disabled={isGroupLoading}
            >
              SMS .csv
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
        footer={() => (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 16, paddingRight: 8 }}>
            <strong>Estudiantes:</strong>&nbsp;{totalStudents}
            <span>•</span>
            <strong>≥75%:</strong>&nbsp;{studentsAtOrAbove75}
          </div>
        )}
        onRow={(record) => ({
          onDoubleClick: () => {
            const uid = Number(record.id_user);
            if (!Number.isFinite(uid)) return;
            try {
              const url = `${window.location.origin}/users/${uid}`;
              window.open(url, '_blank', 'noopener,noreferrer');
            } catch (e) {
              // Fallback: open relative path
              window.open(`/users/${uid}`, '_blank');
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

      <CreateUserGroupModal open={isManageModalOpen} groupId={groupId ? String(groupId) : undefined} onClose={() => setIsManageModalOpen(false)} />
      <ImportUsersToGroupModal open={isImportModalOpen} groupId={groupId ? String(groupId) : undefined} onClose={() => setIsImportModalOpen(false)} onSuccess={() => setIsImportModalOpen(false)} />

      <BonificationModal
        open={isBonificationModalOpen}
        onCancel={() => setIsBonificationModalOpen(false)}
        onOk={handleConfirmBonification}
        users={usersData || []}
        selectedUserIds={selectedUserIds}
        selectedCenters={selectedCenters}
        setSelectedCenters={setSelectedCenters}
        groupId={groupId}
        updateUserEnrollmentCenterMutation={updateUserEnrollmentCenterMutation}
        refetchUsersByGroup={() => refetch?.()}
        message={messageApi}
        onRemoveUser={(id) => setSelectedUserIds(prev => prev.filter(x => x !== id))}
        contextHolder={contextHolder}
      />
    </div>
  );
};

export default GroupUsersManager;
