import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Table, Button, message, Modal, notification, Dropdown, Tag } from 'antd';
import type { MenuProps } from 'antd';
import { Tooltip } from 'antd';
import { SaveOutlined, TeamOutlined, CloudDownloadOutlined, FileExcelOutlined, MailOutlined, MergeCellsOutlined, MobileOutlined, DownOutlined } from '@ant-design/icons';
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
import { USERS_TABLE_COLUMNS, filterUsersTimeSpentColumn } from '../../constants/tables/users-table-columns.constant';
import { useOrganizationSettingsQuery } from '../../hooks/api/organization/use-organization-settings.query';
import { useSyncMoodleGroupMembersMutation } from '../../hooks/api/moodle/use-sync-moodle-group-members.mutation';
import useMoodleGroupMembersApi from '../../hooks/api/moodle/use-moodle-group-members.api';
import useExportUsersToMailCsv from '../../hooks/api/groups/use-export-users-mail-csv';
import useExportUsersToSmsCsv from '../../hooks/api/groups/use-export-users-sms-csv';
import SendMailToGroupModal from '../mail/SendMailToGroupModal';
import { getCourseProfile } from '../../utils/course-profile';

interface Props {
  groupId: number | null | undefined;
  courseName?: string;
  courseModality?: string | null;
  courseOrigin?: string | null;
  courseFunding?: string | null;
  groupStart?: string | Date | null;
  groupEnd?: string | Date | null;
  highlightUserId?: number | null;
}

interface SyncDetail {
  userId?: number;
  username?: string;
  error: string;
}

interface SyncResponse {
  success?: boolean;
  message?: string;
  error?: string;
  details?: SyncDetail[];
}

interface UserToCreate {
  localUserId: number;
  name?: string;
  email?: string;
  suggestedUsername: string;
}

const getRoleShortname = (user: User): string | null => {
  if (user.role_shortname) return user.role_shortname;
  const maybe = user as unknown as Record<string, unknown>;
  const role = maybe['role'];
  return typeof role === 'string' ? role : null;
};

const isStudentUser = (user: User): boolean => {
  const role = getRoleShortname(user);
  return typeof role === 'string' ? role.toLowerCase() === 'student' : false;
};

const GroupUsersManager: React.FC<Props> = ({ groupId, courseName, courseModality, courseOrigin, courseFunding, groupStart, groupEnd, highlightUserId }) => {
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
  const sortedUsers = useMemo(() => {
    const list = usersData ?? [];
    return [...list].sort((a, b) => {
      const byName = (a.name ?? '').localeCompare(b.name ?? '');
      if (byName !== 0) return byName;
      return (a.first_surname ?? '').localeCompare(b.first_surname ?? '');
    });
  }, [usersData]);

  const { data: orgSettings } = useOrganizationSettingsQuery();
  const itopTrainingEnabled = useMemo(() => {
    const settings = orgSettings?.settings ?? {};
    const plugins = (settings && typeof settings === 'object') ? (settings as Record<string, unknown>)['plugins'] : undefined;
    return !!(plugins && typeof plugins === 'object' && (plugins as Record<string, unknown>)['itop_training'] === true);
  }, [orgSettings]);

  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);

  const appliedHighlightUserRef = useRef(false);
  useEffect(() => {
    if (appliedHighlightUserRef.current) return;
    if (highlightUserId == null || sortedUsers.length === 0) return;
    appliedHighlightUserRef.current = true;
    setSelectedUserIds((prev) => (prev.includes(highlightUserId) ? prev : [...prev, highlightUserId]));
    const timeoutId = window.setTimeout(() => {
      const row = document.querySelector(`tr[data-row-key="${highlightUserId}"]`);
      row?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 300);
    return () => window.clearTimeout(timeoutId);
  }, [highlightUserId, sortedUsers]);

  const [selectedCenters, setSelectedCenters] = useState<Record<number, number>>({});
  const [isBonificationModalOpen, setIsBonificationModalOpen] = useState(false);
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isSendMailOpen, setIsSendMailOpen] = useState(false);

  const createBonificationFile = useCreateBonificationFileMutation();
  const updateUserEnrollmentCenterMutation = useUpdateUserEnrollmentCenterMutation();
  const { mutateAsync: syncMoodleGroupMembers, isPending: syncMoodleGroupMembersPending } = useSyncMoodleGroupMembersMutation();

  const { data: groupData, isLoading: isGroupLoading } = useGroupQuery(groupId ? String(groupId) : undefined);
  const { previewUsersToCreate, addUsers } = useMoodleGroupMembersApi();
  const exportUsersToMailCsv = useExportUsersToMailCsv();
  const exportUsersToSmsCsv = useExportUsersToSmsCsv();
  // Capacidades de UI derivadas de la tipología del curso (fuente única de verdad).
  const profile = useMemo(
    () => getCourseProfile({ modality: courseModality, origin: courseOrigin, funding: courseFunding }),
    [courseModality, courseOrigin, courseFunding],
  );

  const handleMarkBelow75 = () => {
    if (!usersData) return;
    const getPercent = (v: unknown) => {
      const n = Number(v ?? 0) || 0;
      return n > 0 && n <= 1 ? n * 100 : n;
    };
    const ids = usersData
      .filter((u: User) => {
        const percent = getPercent(u.completion_percentage);
        return isStudentUser(u) && percent > 0 && percent < 75;
      })
      .map(u => u.id_user);
    setSelectedUserIds(ids);
  };

  const handleMarkZero = () => {
    if (!usersData) return;
    const ids = usersData
      .filter((u: User) => isStudentUser(u) && Number(u.completion_percentage ?? 0) === 0)
      .map(u => u.id_user);
    setSelectedUserIds(ids);
  };

  const handleMark75 = () => {
    if (!usersData) return;
    const getPercent = (v: unknown) => {
      const n = Number(v ?? 0) || 0;
      return n > 0 && n <= 1 ? n * 100 : n;
    };
    const ids = usersData
      .filter((u: User) => isStudentUser(u) && getPercent(u.completion_percentage) >= 75)
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

      let filename = `grupo_${groupId}.xml`;
      try {
        const cd = response.headers?.['content-disposition'] || response.headers?.['Content-Disposition'];
        if (cd) {
          const fnStar = /filename\*=(?:UTF-8''?)?([^;\n\r]+)/i.exec(cd);
          const fn = fnStar ? decodeURIComponent(fnStar[1].trim()) : (/filename="?([^";]+)"?/i.exec(cd)?.[1]);
          if (fn) filename = fn.replace(/\s+$/g, '');
        } else if (groupData?.group_name) {
          filename = `${groupData.group_name.replace(/[^a-zA-Z0-9_-]/g, '_')}.xml`;
        }
      } catch {
        // fallback filename already set
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
      let detail: string | undefined;
      const anyErr = err as { response?: { data?: unknown } };
      const data = anyErr?.response?.data;

      try {
        if (data instanceof Blob) {
          const text = await data.text();
          try {
            const json = JSON.parse(text) as {
              message?: string | string[];
              usersMissingDni?: Array<{ id_user?: number; email?: string }>;
              usersMissingEducationLevel?: Array<{ id_user?: number; email?: string }>;
            };
            if (json?.message) {
              const baseMsg = Array.isArray(json.message) ? json.message.join(', ') : json.message;
              if (json.usersMissingDni && json.usersMissingDni.length > 0) {
                const usersInfo = json.usersMissingDni
                  .map(u => u.email ?? (u.id_user ? `ID ${u.id_user}` : 'Usuario sin identificar'))
                  .join(', ');
                detail = `${baseMsg}. Usuarios: ${usersInfo}`;
              } else if (json.usersMissingEducationLevel && json.usersMissingEducationLevel.length > 0) {
                const usersInfo = json.usersMissingEducationLevel
                  .map(u => u.email ?? (u.id_user ? `ID ${u.id_user}` : 'Usuario sin identificar'))
                  .join(', ');
                detail = `${baseMsg}. Usuarios: ${usersInfo}`;
              } else {
                detail = baseMsg;
              }
            } else if (text) {
              detail = text;
            }
          } catch {
            if (text) detail = text;
          }
        } else if (typeof data === 'object' && data && 'message' in (data as Record<string, unknown>)) {
          const msg = (data as { message?: string | string[] }).message;
          detail = Array.isArray(msg) ? msg.join(', ') : msg;
        }
      } catch {
        // ignore parsing errors and show generic message
      }

      messageApi.error(detail || 'No se pudo generar el XML');
    }
  };

  const handleTraerMoodle = async () => {
    if (!groupId) return;
    const moodleId = groupData?.moodle_id;
    if (!moodleId) {
      messageApi.warning('El grupo local no está asociado a un grupo de Moodle');
      return;
    }
    try {
      const response = await syncMoodleGroupMembers(moodleId);
      const result = response.data;
      if (result?.success) {
        messageApi.success(result.message || 'Usuarios sincronizados desde Moodle');
        notificationApi.success({
          message: 'Sincronización completada',
          description: result.message || 'Usuarios sincronizados desde Moodle',
          duration: 5,
        });
        if (result.details && result.details.length > 0) {
          const max = 10;
          const items = result.details.slice(0, max).map((d: SyncDetail, idx: number) => {
            const idPart = d.userId ?? 'id?';
            const userPart = d.username ? `${d.username} (${idPart})` : `${idPart}`;
            return <li key={idx}>{`${userPart}: ${d.error}`}</li>;
          });
          const more = result.details.length > max ? <p>... y {result.details.length - max} más</p> : null;
          setTimeout(() => {
            modal.info({
              title: 'Sincronización completada con errores',
              width: 600,
              content: (
                <div>
                  <p>{extractSummary(result.message)}</p>
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
      } else if (result?.details && result.details.length > 0) {
        const max = 10;
        const items = result.details.slice(0, max).map((d: SyncDetail, idx: number) => {
          const idPart = d.userId ?? 'id?';
          const userPart = d.username ? `${d.username} (${idPart})` : `${idPart}`;
          return <li key={idx}>{`${userPart} - ${d.error}`}</li>;
        });
        const more = result.details.length > max ? <p>... y {result.details.length - max} más</p> : null;
        setTimeout(() => {
          modal.error({
            title: 'Error al sincronizar usuarios desde Moodle',
            width: 600,
            content: (
              <div>
                <p>{extractSummary(result.message)}</p>
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
    } catch (err) {
      console.error('Error sincronizando usuarios desde Moodle:', err);
      messageApi.error('Error al traer usuarios desde Moodle');
    }
  };

  const handleSubirMoodle = async () => {
    if (!groupId) return;
    if (!selectedUserIds || selectedUserIds.length === 0) {
      messageApi.warning('Selecciona al menos un usuario para subir a Moodle');
      return;
    }
    try {
      const toCreate = await previewUsersToCreate(Number(groupId), selectedUserIds);
      if (Array.isArray(toCreate) && toCreate.length > 0) {
        modal.confirm({
          title: `Se crearán ${toCreate.length} usuario(s) en Moodle`,
          width: 700,
          content: (
            <div>
              <p>Los siguientes usuarios no tienen cuenta en Moodle y se crearán si continúas:</p>
              <ul style={{ maxHeight: 300, overflowY: 'auto' }}>{toCreate.map((t: UserToCreate) => (
                <li key={t.localUserId} style={{ marginBottom: 6 }}>
                  <strong>{t.name || `Usuario ${t.localUserId}`}</strong>
                  {t.email ? ` — ${t.email}` : ''}
                  <div>Usuario sugerido: <code>{t.suggestedUsername}</code></div>
                </li>
              ))}</ul>
              <p style={{ marginTop: 8 }}><em>Se generará una contraseña segura para cada cuenta. Se almacenará localmente en el mapeo de Moodle.</em></p>
            </div>
          ),
          onOk: async () => {
            try {
              const resp = await addUsers(Number(groupId), selectedUserIds);
              const result = (resp as { data?: SyncResponse })?.data;
              if (result?.success) {
                messageApi.success(result.message || 'Usuarios añadidos a Moodle');
                if (result.details && result.details.length > 0) {
                  const max = 10;
                  const items = result.details.slice(0, max).map((d: SyncDetail, idx: number) => <li key={idx}>{`${d.userId ?? 'id?'} - ${d.error}`}</li>);
                  const more = result.details.length > max ? <p>... y {result.details.length - max} más</p> : null;
                  setTimeout(() => {
                    modal.info({
                      title: 'Subida a Moodle con avisos',
                      width: 600,
                      content: (
                        <div>
                          <p>{extractSummary(result.message)}</p>
                          <ul style={{ marginTop: 8 }}>{items}</ul>
                          {more}
                        </div>
                      )
                    });
                  }, 100);
                }
              } else {
                if (result?.details && result.details.length > 0) {
                  const max = 10;
                  const items = result.details.slice(0, max).map((d: SyncDetail, idx: number) => <li key={idx}>{`${d.userId ?? 'id?'} - ${d.error}`}</li>);
                  const more = result.details.length > max ? <p>... y {result.details.length - max} más</p> : null;
                  setTimeout(() => {
                    modal.error({
                      title: 'Error al añadir usuarios a Moodle',
                      width: 600,
                      content: (
                        <div>
                          <p>{extractSummary(result.message)}</p>
                          <ul style={{ marginTop: 8 }}>{items}</ul>
                          {more}
                        </div>
                      )
                    });
                  }, 100);
                } else {
                  messageApi.error(result?.error || result?.message || 'Error al añadir usuarios a Moodle');
                }
              }
            } catch (err) {
              console.error('Error añadiendo usuarios a Moodle:', err);
              messageApi.error('Error al subir usuarios a Moodle');
            } finally {
              refetch();
            }
          },
          okText: 'Crear y subir',
          cancelText: 'Cancelar',
        });
      } else {
        modal.confirm({
          title: 'Subir usuarios a Moodle',
          content: `¿Deseas añadir ${selectedUserIds.length} usuario(s) seleccionados al grupo de Moodle asociado?`,
          onOk: async () => {
            try {
              const resp = await addUsers(Number(groupId), selectedUserIds);
              const result = (resp as { data?: SyncResponse })?.data;
              if (result?.success) {
                messageApi.success(result.message || 'Usuarios añadidos a Moodle');
                if (result.details && result.details.length > 0) {
                  const max = 10;
                  const items = result.details.slice(0, max).map((d: SyncDetail, idx: number) => <li key={idx}>{`${d.userId ?? 'id?'} - ${d.error}`}</li>);
                  const more = result.details.length > max ? <p>... y {result.details.length - max} más</p> : null;
                  setTimeout(() => {
                    modal.info({
                      title: 'Subida a Moodle con avisos',
                      width: 600,
                      content: (
                        <div>
                          <p>{extractSummary(result.message)}</p>
                          <ul style={{ marginTop: 8 }}>{items}</ul>
                          {more}
                        </div>
                      )
                    });
                  }, 100);
                }
              } else {
                messageApi.error(result?.error || result?.message || 'Error al añadir usuarios a Moodle');
              }
            } catch (err) {
              console.error('Error añadiendo usuarios a Moodle:', err);
              messageApi.error('Error al subir usuarios a Moodle');
            } finally {
              refetch();
            }
          }
        });
      }
    } catch (err) {
      console.error('Error previsualizando usuarios a crear en Moodle:', err);
      messageApi.error('No se pudo previsualizar la creación de usuarios en Moodle');
    }
  };

  const columns = useMemo(() => {
    // Porcentaje, tiempo y finalizado solo aplican a alumnos (no a tutores/otros
    // roles); para el resto la celda queda vacía. Vale para cualquier tipo de curso.
    const studentOnly = (column: (typeof USERS_TABLE_COLUMNS)[number]) => ({
      ...column,
      render: (value: unknown, user: User, index: number) =>
        isStudentUser(user)
          ? (column.render ? column.render(value, user, index) : (value as React.ReactNode))
          : '-',
    });

    const finalizedColumn = studentOnly({
      title: 'Finalizado',
      dataIndex: ['finalized'],
      key: 'finalized',
      sorter: { compare: (a: User, b: User) => Number(a.finalized ?? false) - Number(b.finalized ?? false) },
      render: (_: unknown, user: User) => (
        <Tag color={user.finalized ? 'green' : 'red'}>{user.finalized ? 'Finalizado' : 'No finalizado'}</Tag>
      ),
    });

    const gateStudentColumns = (cols: (typeof USERS_TABLE_COLUMNS)[number][]) =>
      cols.map((column) =>
        column.title === 'Porcentaje' || column.title === 'Tiempo usado' ? studentOnly(column) : column,
      );

    if (profile.isPresential) {
      // En presencial el porcentaje/tiempo no aplican (no hay Moodle): se sustituye
      // la columna Porcentaje por el estado de finalización.
      return USERS_TABLE_COLUMNS
        .filter((column) => column.title !== 'Tiempo usado')
        .map((column) => (column.title === 'Porcentaje' ? finalizedColumn : column));
    }

    const groupSyncedColumn = {
      title: <Tooltip title="Indica si el usuario fue subido a Moodle">M</Tooltip>,
      dataIndex: 'moodle_synced_at',
      key: 'moodle_synced',
      fixed: 'left' as const,
      width: 56,
      render: (_: unknown, user: User) => {
        const synced = user.moodle_synced_at;
        if (!synced) return <span style={{ color: '#ff4d4f', fontWeight: 700 }}>N</span>;
        const date = typeof synced === 'string' ? new Date(synced) : (synced as Date);
        return <span title={date ? date.toLocaleString() : String(synced)} style={{ color: '#52c41a', fontWeight: 700 }}>S</span>;
      }
    } as const;

    const baseColumns = gateStudentColumns(filterUsersTimeSpentColumn(USERS_TABLE_COLUMNS, itopTrainingEnabled));
    const cols = [groupSyncedColumn, ...baseColumns];
    // INAEM online/mixta: se conservan las columnas online (Moodle/progreso) y se
    // añade la finalización (el INAEM informa FINALIZADO sea cual sea la modalidad).
    if (profile.showFinalizedColumn) {
      cols.push(finalizedColumn);
    }
    return cols;
  }, [profile, itopTrainingEnabled]);

  const { totalStudents, studentsAtOrAbove75 } = useMemo(() => {
    let total = 0;
    let at75 = 0;
    if (!usersData || usersData.length === 0) return { totalStudents: 0, studentsAtOrAbove75: 0 };

    const getPercent = (v: unknown) => {
      const n = Number(v ?? 0) || 0;
      return n > 0 && n <= 1 ? n * 100 : n;
    };

    for (const u of usersData) {
      const isStudent = isStudentUser(u);
      if (isStudent) {
        total += 1;
        const pct = getPercent(u.completion_percentage);
        if (pct >= 75) at75 += 1;
      }
    }

    return { totalStudents: total, studentsAtOrAbove75: at75 };
  }, [usersData]);

  // ── Menús de los dropdowns ──────────────────────────────────────────────────

  const usuariosMenuItems: MenuProps['items'] = [
    {
      key: 'gestor',
      icon: <TeamOutlined />,
      label: 'Gestor de Usuarios',
    },
    {
      key: 'importar',
      icon: <FileExcelOutlined style={{ color: '#008000' }} />,
      label: 'Importar XLS',
    },
  ];

  const moodleMenuItems: MenuProps['items'] = [
    {
      key: 'traer',
      icon: <CloudDownloadOutlined style={{ color: '#f56b00' }} />,
      label: 'Traer desde Moodle',
      disabled: isGroupLoading || !groupData?.moodle_id,
    },
    {
      key: 'subir',
      icon: <SaveOutlined style={{ color: '#fa8c16' }} />,
      label: 'Subir a Moodle',
      disabled: isGroupLoading,
    },
  ];

  const exportarMenuItems: MenuProps['items'] = [
    {
      key: 'csv-mail',
      icon: <MergeCellsOutlined />,
      label: 'CSV Email',
      disabled: isGroupLoading,
    },
    {
      key: 'csv-sms',
      icon: <MobileOutlined />,
      label: 'CSV SMS',
      disabled: isGroupLoading,
    },
  ];

  const seleccionMenuItems: MenuProps['items'] = [
    {
      key: 'sel-zero',
      label: <span style={{ color: '#ff4d4f' }}>Seleccionar 0%</span>,
      disabled: !usersData || usersData.length === 0,
    },
    {
      key: 'sel-below75',
      label: <span style={{ color: '#ff4d4f' }}>Seleccionar 1–75%</span>,
      disabled: !usersData || usersData.length === 0,
    },
    {
      key: 'sel-above75',
      label: <span style={{ color: '#52c41a' }}>Seleccionar ≥75%</span>,
      disabled: !usersData || usersData.length === 0,
    },
  ];

  const handleUsuariosMenuClick: MenuProps['onClick'] = ({ key }) => {
    if (key === 'gestor' && groupId) setIsManageModalOpen(true);
    if (key === 'importar' && groupId) setIsImportModalOpen(true);
  };

  const handleMoodleMenuClick: MenuProps['onClick'] = ({ key }) => {
    if (key === 'traer') void handleTraerMoodle();
    if (key === 'subir') void handleSubirMoodle();
  };

  const handleExportarMenuClick: MenuProps['onClick'] = async ({ key }) => {
    if (key === 'csv-mail') {
      if (!usersData || usersData.length === 0) return messageApi.warning('No hay usuarios para exportar');
      if (!selectedUserIds || selectedUserIds.length === 0) return messageApi.warning('Selecciona al menos un usuario para exportar');
      try {
        const result = await exportUsersToMailCsv(selectedUserIds, usersData, groupData?.group_name);
        if (!result || result.rowsCount === 0) { messageApi.info('Exportación cancelada'); return; }
        messageApi.success(`CSV exportado correctamente (${result.rowsCount} filas)`);
      } catch (err) {
        console.error('Error exportando CSV', err);
        messageApi.error('Error al exportar CSV');
      }
    }
    if (key === 'csv-sms') {
      if (!usersData || usersData.length === 0) return messageApi.warning('No hay usuarios para exportar');
      if (!selectedUserIds || selectedUserIds.length === 0) return messageApi.warning('Selecciona al menos un usuario para exportar');
      try {
        const courseId = groupData?.id_course;
        const groupName = groupData?.group_name ?? '';
        const result = await exportUsersToSmsCsv(selectedUserIds, usersData, courseId, groupName);
        if (!result || result.rowsCount === 0) { messageApi.info('Exportación cancelada'); return; }
        messageApi.success(`CSV SMS exportado correctamente (${result.rowsCount} filas)`);
      } catch (err) {
        console.error('Error exportando SMS CSV', err);
        const errMsg = err instanceof Error ? err.message : String(err);
        messageApi.error(`Error al exportar SMS CSV: ${errMsg}`);
      }
    }
  };

  const handleSeleccionMenuClick: MenuProps['onClick'] = ({ key }) => {
    if (key === 'sel-zero') handleMarkZero();
    if (key === 'sel-below75') handleMarkBelow75();
    if (key === 'sel-above75') handleMark75();
  };

  return (
    <div>
      {contextHolder}
      {modalContextHolder}
      {notificationContextHolder}

      {/* ── Botonera ────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>

        {/* Izquierda: acciones de gestión */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <AuthzHide roles={[Role.ADMIN, Role.MANAGER]}>
            <Dropdown menu={{ items: usuariosMenuItems, onClick: handleUsuariosMenuClick }}>
              <Button icon={<TeamOutlined />}>
                Usuarios <DownOutlined />
              </Button>
            </Dropdown>

            {profile.showMoodleSync && (
              <Dropdown
                menu={{ items: moodleMenuItems, onClick: handleMoodleMenuClick }}
                disabled={syncMoodleGroupMembersPending}
              >
                <Button
                  icon={<CloudDownloadOutlined style={{ color: '#f56b00' }} />}
                  loading={syncMoodleGroupMembersPending}
                >
                  Moodle <DownOutlined />
                </Button>
              </Dropdown>
            )}

            <Dropdown menu={{ items: exportarMenuItems, onClick: handleExportarMenuClick }}>
              <Button icon={<MergeCellsOutlined />}>
                Exportar <DownOutlined />
              </Button>
            </Dropdown>
          </AuthzHide>

          <AuthzHide roles={[Role.ADMIN, Role.MANAGER, Role.VIEWER]}>
            <Button
              type="default"
              icon={<MailOutlined />}
              onClick={() => {
                if (!selectedUserIds || selectedUserIds.length === 0) {
                  messageApi.warning('Selecciona al menos un usuario');
                  return;
                }
                setIsSendMailOpen(true);
              }}
            >
              Correo
            </Button>
          </AuthzHide>
        </div>

        {/* Derecha: selección rápida + bonificación */}
        <AuthzHide roles={[Role.ADMIN, Role.MANAGER]}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Dropdown menu={{ items: seleccionMenuItems, onClick: handleSeleccionMenuClick }}>
              <Button disabled={!usersData || usersData.length === 0}>
                Selección <DownOutlined />
              </Button>
            </Dropdown>
            {profile.showBonificationButton && (
              <Button onClick={openBonification} type="primary" icon={<SaveOutlined />}>
                Bonificar
              </Button>
            )}
          </div>
        </AuthzHide>
      </div>

      <Table<User>
        rowKey="id_user"
        dataSource={sortedUsers}
        columns={columns}
        loading={isLoading}
        pagination={false}
        scroll={{ x: 'max-content', y: 500 }}
        footer={() => {
          const syncedAt = groupData?.moodle_synced_at;
          const formattedDate = syncedAt
            ? new Date(syncedAt).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })
            : 'Sin sincronizar';
          return (
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, paddingRight: 8 }}>
              <div style={{ fontSize: '0.9em', color: '#666' }}>
                <strong>Última sincronización:</strong>&nbsp;{formattedDate}
              </div>
              <div style={{ display: 'flex', gap: 16 }}>
                <strong>Estudiantes:</strong>&nbsp;{totalStudents}
                <span>•</span>
                <strong>≥75%:</strong>&nbsp;{studentsAtOrAbove75}
              </div>
            </div>
          );
        }}
        onRow={(record) => ({
          onDoubleClick: () => {
            const uid = Number(record.id_user);
            if (!Number.isFinite(uid)) return;
            try {
              const url = `${window.location.origin}/users/${uid}`;
              window.open(url, '_blank', 'noopener,noreferrer');
            } catch {
              window.open(`/users/${uid}`, '_blank');
            }
          },
          style: { cursor: 'pointer' }
        })}
        rowSelection={{
          type: 'checkbox',
          selectedRowKeys: selectedUserIds,
          onChange: (_keys: React.Key[], selectedRows: User[]) => {
            const onlyStudents = selectedRows
              .filter((u) => isStudentUser(u))
              .map((u) => u.id_user);
            setSelectedUserIds(onlyStudents);
          },
          getCheckboxProps: (record: User) => ({
            id: `user-checkbox-${record.id_user}`,
            disabled: !isStudentUser(record),
          }),
        }}
        size="small"
      />

      <CreateUserGroupModal open={isManageModalOpen} groupId={groupId ? String(groupId) : undefined} onClose={() => setIsManageModalOpen(false)} />
      <ImportUsersToGroupModal open={isImportModalOpen} groupId={groupId ? String(groupId) : undefined} onClose={() => setIsImportModalOpen(false)} onSuccess={() => setIsImportModalOpen(false)} />

      <SendMailToGroupModal
        open={isSendMailOpen}
        users={(usersData || []).filter(u => selectedUserIds.includes(u.id_user))}
        tutors={(usersData || [])
          .filter((u) => !!u.is_tutor && String(u.role_shortname ?? '').toLowerCase() !== 'student' && !!u.email)
          .map((u) => ({
            id_user: u.id_user,
            email: String(u.email),
            name: `${u.name ?? ''} ${u.first_surname ?? ''}${u.second_surname ? ` ${u.second_surname}` : ''}`.trim() || `ID ${u.id_user}`,
          }))}
        courseName={courseName}
        groupStart={groupStart}
        groupEnd={groupEnd}
        onOk={() => setIsSendMailOpen(false)}
        onCancel={() => setIsSendMailOpen(false)}
      />

      <BonificationModal
        open={isBonificationModalOpen}
        onCancel={() => setIsBonificationModalOpen(false)}
        onOk={handleConfirmBonification}
        users={usersData || []}
        itopTrainingEnabled={itopTrainingEnabled}
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
