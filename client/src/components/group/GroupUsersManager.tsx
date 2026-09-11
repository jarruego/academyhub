import React, { useEffect, useMemo, useRef, useState } from 'react';
import { App, Table, Button, Modal, Dropdown, Spin, Typography, theme } from 'antd';
import { BRAND_COLORS } from '../../theme/semantic-colors';
import type { MenuProps } from 'antd';
import { Tooltip } from 'antd';
import { SaveOutlined, TeamOutlined, CloudDownloadOutlined, FileExcelOutlined, FileTextOutlined, MailOutlined, SendOutlined, MergeCellsOutlined, MobileOutlined, DownOutlined } from '@ant-design/icons';
import { AuthzHide } from '../permissions/authz-hide';
import CreateUserGroupModal from './CreateUserGroupModal';
import ImportUsersToGroupModal from './ImportUsersToGroupModal';
import ImportFromCourseRequestsModal from './ImportFromCourseRequestsModal';
import { Role } from '../../hooks/api/auth/use-login.mutation';
import { useUsersByGroupsQuery, UserWithGroup } from '../../hooks/api/users/use-users-by-groups.query';
import { useGroupQuery } from '../../hooks/api/groups/use-group.query';
import { useCreateBonificationFileMutation } from '../../hooks/api/groups/use-create-bonification-file.mutation';
import { useUpdateUserEnrollmentCenterMutation } from '../../hooks/api/groups/use-update-user-enrollment-center.mutation';
import { BonificationModal } from '../courses/BonificationModal';
import { FinalizedTag } from '../common/tags';
import { formatDateTime } from '../../utils/format';
import { User } from '../../shared/types/user/user';
import { USERS_TABLE_COLUMNS, filterUsersTimeSpentColumn } from '../../constants/tables/users-table-columns.constant';
import { useOrganizationSettingsQuery } from '../../hooks/api/organization/use-organization-settings.query';
import { useSyncMoodleGroupMembersMutation } from '../../hooks/api/moodle/use-sync-moodle-group-members.mutation';
import useMoodleGroupMembersApi from '../../hooks/api/moodle/use-moodle-group-members.api';
import useExportUsersToMailCsv from '../../hooks/api/groups/use-export-users-mail-csv';
import useExportUsersToSmsCsv from '../../hooks/api/groups/use-export-users-sms-csv';
import SendMailToGroupModal from '../mail/SendMailToGroupModal';
import SendReportMailModal from '../mail/SendReportMailModal';
import SendSmsToGroupModal from '../sms/SendSmsToGroupModal';
import { getCourseProfile } from '../../utils/course-profile';

interface Props {
  // Uno o varios grupos seleccionados en la ficha del curso. Con 2+, los alumnos de todos
  // se fusionan en una sola tabla (útil para Correo/Informe/seguimiento); Matricular, Moodle
  // y Bonificar quedan deshabilitados porque mutan un grupo concreto — ver docs/client.md.
  groupIds: number[];
  // Nombre de cada grupo por id, para la columna "Grupo" que aparece cuando hay 2+ seleccionados.
  groupNamesById?: Record<number, string>;
  courseName?: string;
  courseModality?: string | null;
  courseClient?: string | null;
  courseFunding?: string | null;
  // Curso de catálogo padre de esta edición — para listar las peticiones de
  // centros disponibles al matricular desde "Desde Peticiones" (ver
  // ImportFromCourseRequestsModal / docs/course-requests.md).
  catalogCourseId?: number | null;
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

// Con varios grupos fusionados, un mismo alumno matriculado en 2+ de los grupos
// seleccionados aparece como una fila por grupo (correcto para "Enviar informe",
// donde cada matrícula es una fila distinta) — pero "Correo" no debe mandarle
// una copia por cada fila, así que se deduplica por id_user justo antes de abrir esa modal.
function dedupeByUserId<T extends { id_user: number }>(rows: T[]): T[] {
  const seen = new Set<number>();
  const result: T[] = [];
  for (const r of rows) {
    if (seen.has(r.id_user)) continue;
    seen.add(r.id_user);
    result.push(r);
  }
  return result;
}

const GroupUsersManager: React.FC<Props> = ({ groupIds, groupNamesById = {}, courseName, courseModality, courseClient, courseFunding, catalogCourseId, groupStart, groupEnd, highlightUserId }) => {
  const { message: messageApi, modal, notification: notificationApi } = App.useApp();
  const { token } = theme.useToken();

  // 2+ grupos seleccionados: vista fusionada de solo lectura para Correo/Informe/
  // seguimiento. Matricular, Moodle y Bonificar necesitan un único grupo (mutan
  // user_group de ese grupo concreto) y quedan deshabilitados — ver docs/client.md.
  const isMulti = groupIds.length > 1;
  const singleGroupId = groupIds.length === 1 ? groupIds[0] : null;

  const extractSummary = (text?: string) => {
    if (!text) return '';
    const marker = '\nErrores:\n';
    const idx = text.indexOf(marker);
    return idx !== -1 ? text.slice(0, idx) : text;
  };
  const { data: usersData, isLoading, refetch } = useUsersByGroupsQuery(groupIds);
  const sortedUsers = useMemo(() => {
    const list = usersData ?? [];
    return [...list].sort((a, b) => {
      const byName = (a.name ?? '').localeCompare(b.name ?? '');
      if (byName !== 0) return byName;
      return (a.first_surname ?? '').localeCompare(b.first_surname ?? '');
    });
  }, [usersData]);

  const { data: orgSettings } = useOrganizationSettingsQuery();
  const itopTrainingEnabled = orgSettings?.settings.plugins.itop_training ?? false;

  // Filas seleccionadas (no solo ids): con varios grupos fusionados, la misma persona
  // puede aparecer como una fila por cada grupo en el que está matriculada, y cada fila
  // lleva su propio id_group (necesario para "Enviar informe" — ver dedupeByUserId arriba
  // para por qué "Correo" sí deduplica por id_user).
  const [selectedRows, setSelectedRows] = useState<UserWithGroup[]>([]);
  const selectedUserIds = useMemo(() => Array.from(new Set(selectedRows.map((r) => r.id_user))), [selectedRows]);

  const appliedHighlightUserRef = useRef(false);
  useEffect(() => {
    if (appliedHighlightUserRef.current) return;
    if (highlightUserId == null || sortedUsers.length === 0) return;
    appliedHighlightUserRef.current = true;
    const row = sortedUsers.find((u) => u.id_user === highlightUserId);
    if (row) {
      setSelectedRows((prev) => (prev.some((r) => r.id_group === row.id_group && r.id_user === row.id_user) ? prev : [...prev, row]));
    }
    const timeoutId = window.setTimeout(() => {
      const key = row ? `${row.id_group}-${row.id_user}` : String(highlightUserId);
      const rowEl = document.querySelector(`tr[data-row-key="${key}"]`);
      rowEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 300);
    return () => window.clearTimeout(timeoutId);
  }, [highlightUserId, sortedUsers]);

  const [selectedCenters, setSelectedCenters] = useState<Record<number, number>>({});
  const [isBonificationModalOpen, setIsBonificationModalOpen] = useState(false);
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isImportFromRequestsModalOpen, setIsImportFromRequestsModalOpen] = useState(false);
  const [isSendMailOpen, setIsSendMailOpen] = useState(false);
  const [isSendSmsOpen, setIsSendSmsOpen] = useState(false);
  const [isSendReportOpen, setIsSendReportOpen] = useState(false);

  const createBonificationFile = useCreateBonificationFileMutation();
  const updateUserEnrollmentCenterMutation = useUpdateUserEnrollmentCenterMutation();
  const { mutateAsync: syncMoodleGroupMembers, isPending: syncMoodleGroupMembersPending } = useSyncMoodleGroupMembersMutation();

  const { data: groupData, isLoading: isGroupLoading } = useGroupQuery(singleGroupId ? String(singleGroupId) : undefined);
  const { previewUsersToCreate, addUsers } = useMoodleGroupMembersApi();
  const exportUsersToMailCsv = useExportUsersToMailCsv();
  const exportUsersToSmsCsv = useExportUsersToSmsCsv();
  // Capacidades de UI derivadas de la tipología del curso (fuente única de verdad).
  const profile = useMemo(
    () => getCourseProfile({ modality: courseModality, client: courseClient, funding: courseFunding }),
    [courseModality, courseClient, courseFunding],
  );

  const handleMarkBelow75 = () => {
    if (!usersData) return;
    const getPercent = (v: unknown) => {
      const n = Number(v ?? 0) || 0;
      return n > 0 && n <= 1 ? n * 100 : n;
    };
    const rows = usersData.filter((u) => {
      const percent = getPercent(u.completion_percentage);
      return isStudentUser(u) && percent > 0 && percent < 75;
    });
    setSelectedRows(rows);
  };

  const handleMarkZero = () => {
    if (!usersData) return;
    const rows = usersData.filter((u) => isStudentUser(u) && Number(u.completion_percentage ?? 0) === 0);
    setSelectedRows(rows);
  };

  const handleMark75 = () => {
    if (!usersData) return;
    const getPercent = (v: unknown) => {
      const n = Number(v ?? 0) || 0;
      return n > 0 && n <= 1 ? n * 100 : n;
    };
    const rows = usersData.filter((u) => isStudentUser(u) && getPercent(u.completion_percentage) >= 75);
    setSelectedRows(rows);
  };

  const openBonification = () => {
    if (isMulti) return;
    if (!selectedRows || selectedRows.length === 0) {
      messageApi.warning('Selecciona al menos un usuario para bonificar');
      return;
    }
    setIsBonificationModalOpen(true);
  };

  const handleConfirmBonification = async () => {
    if (!singleGroupId) return;
    try {
      const response = await createBonificationFile.mutateAsync({ groupId: Number(singleGroupId), userIds: selectedUserIds });
      const blob = response.data as Blob;

      let filename = `grupo_${singleGroupId}.xml`;
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
      void refetch();
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
    if (!singleGroupId) return;
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
    if (!singleGroupId) return;
    if (!selectedUserIds || selectedUserIds.length === 0) {
      messageApi.warning('Selecciona al menos un usuario para subir a Moodle');
      return;
    }
    try {
      const toCreate = await previewUsersToCreate(Number(singleGroupId), selectedUserIds);
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
              const resp = await addUsers(Number(singleGroupId), selectedUserIds);
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
              const resp = await addUsers(Number(singleGroupId), selectedUserIds);
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
        <FinalizedTag finalized={!!user.finalized} />
      ),
    });

    const bonifiedColumn = studentOnly({
      title: 'Bonif.',
      dataIndex: 'bonified',
      key: 'bonified',
      width: 100,
      sorter: { compare: (a: User, b: User) => Number(a.bonified ?? false) - Number(b.bonified ?? false) },
      render: (_: unknown, user: User) =>
        user.bonified
          ? <span style={{ color: token.colorSuccess, fontWeight: 700 }}>Sí</span>
          : <span style={{ color: token.colorTextQuaternary }}>—</span>,
    });

    const gateStudentColumns = (cols: (typeof USERS_TABLE_COLUMNS)[number][]) =>
      cols.map((column) =>
        column.title === 'Progreso' || column.title === 'Tiempo' ? studentOnly(column) : column,
      );

    const filterCompanyColumns = (cols: (typeof USERS_TABLE_COLUMNS)[number][]) =>
      profile.showCompanyColumns ? cols : cols.filter((c) => c.title !== 'Centro' && c.title !== 'Empresa');

    // Solo con 2+ grupos fusionados: de qué grupo viene cada fila (el mismo alumno puede
    // aparecer una vez por cada grupo en el que está matriculado — ver dedupeByUserId).
    const groupIdOf = (u: User) => (u as UserWithGroup).id_group;
    const groupNameColumn = {
      title: 'Grupo',
      dataIndex: 'id_group',
      key: 'id_group',
      width: 160,
      sorter: {
        compare: (a: User, b: User) =>
          (groupNamesById[groupIdOf(a)] ?? '').localeCompare(groupNamesById[groupIdOf(b)] ?? ''),
      },
      render: (_: unknown, user: User) => groupNamesById[groupIdOf(user)] ?? `#${groupIdOf(user)}`,
    };
    const withGroupColumn = (cols: (typeof USERS_TABLE_COLUMNS)[number][]) =>
      isMulti ? [groupNameColumn, ...cols] : cols;

    if (profile.isPresential) {
      // En presencial el porcentaje/tiempo no aplican (no hay Moodle): se sustituye
      // la columna Progreso por el estado de finalización.
      const cols = filterCompanyColumns(USERS_TABLE_COLUMNS)
        .filter((column) => column.title !== 'Tiempo')
        .map((column) => (column.title === 'Progreso' ? finalizedColumn : column));
      if (profile.showBonificationButton) cols.push(bonifiedColumn);
      return withGroupColumn(cols);
    }

    const groupSyncedColumn = {
      title: <Tooltip title="Indica si el usuario fue subido a Moodle">M</Tooltip>,
      dataIndex: 'moodle_synced_at',
      key: 'moodle_synced',
      fixed: 'left' as const,
      width: 56,
      render: (_: unknown, user: User) => {
        const synced = user.moodle_synced_at;
        if (!synced) return <span style={{ color: token.colorError, fontWeight: 700 }}>N</span>;
        const date = typeof synced === 'string' ? new Date(synced) : (synced as Date);
        return <span title={date ? date.toLocaleString() : String(synced)} style={{ color: token.colorSuccess, fontWeight: 700 }}>S</span>;
      }
    } as const;

    const baseColumns = gateStudentColumns(filterUsersTimeSpentColumn(filterCompanyColumns(USERS_TABLE_COLUMNS), itopTrainingEnabled));
    const cols = [groupSyncedColumn, ...baseColumns];
    // INAEM online/mixta: se conservan las columnas online (Moodle/progreso) y se
    // añade la finalización (el INAEM informa FINALIZADO sea cual sea la modalidad).
    if (profile.showFinalizedColumn) {
      cols.push(finalizedColumn);
    }
    if (profile.showBonificationButton) {
      cols.push(bonifiedColumn);
    }
    return withGroupColumn(cols);
  }, [profile, itopTrainingEnabled, isMulti, groupNamesById]);

  const { totalStudents, studentsAtOrAbove75, bonifiedStudents } = useMemo(() => {
    let total = 0;
    let at75 = 0;
    let bonified = 0;
    if (!usersData || usersData.length === 0) return { totalStudents: 0, studentsAtOrAbove75: 0, bonifiedStudents: 0 };

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
        if (u.bonified) bonified += 1;
      }
    }

    return { totalStudents: total, studentsAtOrAbove75: at75, bonifiedStudents: bonified };
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
      icon: <FileExcelOutlined style={{ color: BRAND_COLORS.excel }} />,
      label: 'Importar XLS',
    },
    {
      key: 'peticiones',
      icon: <FileTextOutlined />,
      label: 'Desde Peticiones',
    },
  ];

  const moodleMenuItems: MenuProps['items'] = [
    {
      key: 'traer',
      icon: <CloudDownloadOutlined style={{ color: BRAND_COLORS.moodle }} />,
      label: 'Traer desde Moodle',
      disabled: isGroupLoading || !groupData?.moodle_id,
    },
    {
      key: 'subir',
      icon: <SaveOutlined style={{ color: token.colorWarning }} />,
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
      label: <span style={{ color: token.colorError }}>Seleccionar 0%</span>,
      disabled: !usersData || usersData.length === 0,
    },
    {
      key: 'sel-below75',
      label: <span style={{ color: token.colorError }}>Seleccionar 1–75%</span>,
      disabled: !usersData || usersData.length === 0,
    },
    {
      key: 'sel-above75',
      label: <span style={{ color: token.colorSuccess }}>Seleccionar ≥75%</span>,
      disabled: !usersData || usersData.length === 0,
    },
  ];

  const handleUsuariosMenuClick: MenuProps['onClick'] = ({ key }) => {
    if (key === 'gestor' && singleGroupId) setIsManageModalOpen(true);
    if (key === 'importar' && singleGroupId) setIsImportModalOpen(true);
    if (key === 'peticiones' && singleGroupId) setIsImportFromRequestsModalOpen(true);
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
        const result = await exportUsersToMailCsv(selectedUserIds, usersData, groupData?.group_name, groupNamesById);
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
      {/* ── Botonera ────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>

        {/* Izquierda: acciones de gestión */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <AuthzHide roles={[Role.ADMIN, Role.MANAGER]}>
            {/* El span intermedio es necesario: un Button/Dropdown disabled tiene
                pointer-events:none y nunca dispara el hover del Tooltip envolvente. */}
            <Tooltip title={isMulti ? 'Selecciona un único grupo para matricular' : undefined}>
              <span>
                <Dropdown menu={{ items: usuariosMenuItems, onClick: handleUsuariosMenuClick }} disabled={isMulti}>
                  <Button icon={<TeamOutlined />} disabled={isMulti}>
                    Matricular <DownOutlined />
                  </Button>
                </Dropdown>
              </span>
            </Tooltip>

            {profile.showMoodleSync && (
              <Tooltip title={isMulti ? 'Selecciona un único grupo para sincronizar con Moodle' : undefined}>
                <span>
                  <Dropdown
                    menu={{ items: moodleMenuItems, onClick: handleMoodleMenuClick }}
                    disabled={isMulti || syncMoodleGroupMembersPending}
                  >
                    <Button
                      icon={<CloudDownloadOutlined style={{ color: BRAND_COLORS.moodle }} />}
                      loading={syncMoodleGroupMembersPending}
                      disabled={isMulti}
                    >
                      Moodle <DownOutlined />
                    </Button>
                  </Dropdown>
                </span>
              </Tooltip>
            )}

            <Dropdown menu={{ items: exportarMenuItems, onClick: handleExportarMenuClick }}>
              <Button icon={<MergeCellsOutlined />}>
                Exportar <DownOutlined />
              </Button>
            </Dropdown>
          </AuthzHide>

          <AuthzHide roles={[Role.ADMIN, Role.MANAGER, Role.TUTOR]}>
            <Button
              id="group-mail-button"
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

          {/* SMS: solo ADMIN/MANAGER (decisión 2026-09-11) — a diferencia del correo, TUTOR no lo tiene. */}
          <AuthzHide roles={[Role.ADMIN, Role.MANAGER]}>
            <Button
              id="group-sms-button"
              type="default"
              icon={<MobileOutlined />}
              onClick={() => {
                if (!selectedUserIds || selectedUserIds.length === 0) {
                  messageApi.warning('Selecciona al menos un usuario');
                  return;
                }
                setIsSendSmsOpen(true);
              }}
            >
              SMS
            </Button>
          </AuthzHide>

          {/* Envío de informes a centros: solo ADMIN/MANAGER/TUTOR, sin acceso para VIEWER. */}
          <AuthzHide roles={[Role.ADMIN, Role.MANAGER, Role.TUTOR]}>
            <Button
              id="group-send-report-button"
              type="default"
              icon={<SendOutlined />}
              onClick={() => {
                if (!selectedUserIds || selectedUserIds.length === 0) {
                  messageApi.warning('Selecciona al menos un usuario');
                  return;
                }
                setIsSendReportOpen(true);
              }}
            >
              Enviar informe
            </Button>
          </AuthzHide>
        </div>

        {/* Derecha: selección rápida + bonificación */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <AuthzHide roles={[Role.ADMIN, Role.MANAGER, Role.TUTOR]}>
            <Dropdown menu={{ items: seleccionMenuItems, onClick: handleSeleccionMenuClick }}>
              <Button disabled={!usersData || usersData.length === 0}>
                Selección <DownOutlined />
              </Button>
            </Dropdown>
          </AuthzHide>
          <AuthzHide roles={[Role.ADMIN, Role.MANAGER]}>
            {profile.showBonificationButton && (
              <Tooltip title={isMulti ? 'Selecciona un único grupo para bonificar' : undefined}>
                <span>
                  <Button onClick={openBonification} type="primary" icon={<SaveOutlined />} disabled={isMulti}>
                    Bonificar
                  </Button>
                </span>
              </Tooltip>
            )}
          </AuthzHide>
        </div>
      </div>

      {/* Table<User>: USERS_TABLE_COLUMNS está tipado para User; mezclarlo con
          Table<UserWithGroup> crea un ciclo genérico irresoluble en los tipos de antd
          (ColumnTitleProps es autorreferencial). Los datos reales sí llevan id_group —
          se castea puntualmente donde hace falta leerlo (rowKey, columna "Grupo", selección). */}
      <Table<User>
        id="group-users-table"
        rowKey={(u) => `${(u as UserWithGroup).id_group}-${u.id_user}`}
        dataSource={sortedUsers}
        columns={columns}
        loading={isLoading}
        pagination={false}
        scroll={{ x: 'max-content', y: 500 }}
        footer={() => {
          const syncedAt = groupData?.moodle_synced_at;
          const formattedDate = formatDateTime(syncedAt, 'Sin sincronizar');
          return (
            <div style={{ display: 'flex', justifyContent: isMulti ? 'flex-end' : 'space-between', gap: 16, paddingRight: 8 }}>
              {!isMulti && (
                <div style={{ fontSize: '0.9em', color: token.colorTextSecondary }}>
                  <strong>Última sincronización:</strong>&nbsp;{formattedDate}
                </div>
              )}
              <div style={{ display: 'flex', gap: 16 }}>
                <strong>Estudiantes:</strong>&nbsp;{totalStudents}
                <span>•</span>
                <strong>≥75%:</strong>&nbsp;{studentsAtOrAbove75}
                {profile.showBonificationButton && (
                  <>
                    <span>•</span>
                    <strong>Bonificados:</strong>&nbsp;{bonifiedStudents}
                  </>
                )}
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
          selectedRowKeys: selectedRows.map((r) => `${r.id_group}-${r.id_user}`),
          onChange: (_keys: React.Key[], selectedRowsArg: User[]) => {
            const onlyStudents = (selectedRowsArg as UserWithGroup[]).filter((u) => isStudentUser(u));
            setSelectedRows(onlyStudents);
          },
          getCheckboxProps: (record: User) => ({
            id: `user-checkbox-${(record as UserWithGroup).id_group}-${record.id_user}`,
            disabled: !isStudentUser(record),
          }),
        }}
        size="small"
      />

      <CreateUserGroupModal open={isManageModalOpen} groupId={singleGroupId ? String(singleGroupId) : undefined} onClose={() => setIsManageModalOpen(false)} />
      <ImportUsersToGroupModal open={isImportModalOpen} groupId={singleGroupId ? String(singleGroupId) : undefined} onClose={() => setIsImportModalOpen(false)} onSuccess={() => setIsImportModalOpen(false)} />
      <ImportFromCourseRequestsModal
        open={isImportFromRequestsModalOpen}
        groupId={singleGroupId}
        catalogCourseId={catalogCourseId}
        onClose={() => setIsImportFromRequestsModalOpen(false)}
        onSuccess={() => { setIsImportFromRequestsModalOpen(false); void refetch(); }}
      />

      <SendMailToGroupModal
        open={isSendMailOpen}
        users={dedupeByUserId(selectedRows)}
        tutors={dedupeByUserId(usersData || [])
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

      <SendSmsToGroupModal
        open={isSendSmsOpen}
        users={dedupeByUserId(selectedRows).map((u) => ({ id_user: u.id_user, phone: u.phone }))}
        courseName={courseName}
        groupStart={groupStart}
        groupEnd={groupEnd}
        onOk={() => setIsSendSmsOpen(false)}
        onCancel={() => setIsSendSmsOpen(false)}
      />

      <SendReportMailModal
        open={isSendReportOpen}
        selection={{ selected_keys: selectedRows.map((r) => `${r.id_user}-${r.id_group}`) }}
        onOk={() => setIsSendReportOpen(false)}
        onCancel={() => setIsSendReportOpen(false)}
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
        groupId={singleGroupId}
        updateUserEnrollmentCenterMutation={updateUserEnrollmentCenterMutation}
        refetchUsersByGroup={() => refetch?.()}
        message={messageApi}
        onRemoveUser={(id) => setSelectedRows(prev => prev.filter(r => r.id_user !== id))}
      />

      <Modal
        title="Sincronizando con Moodle..."
        open={syncMoodleGroupMembersPending}
        closable={false}
        footer={null}
        width={400}
        maskClosable={false}
      >
        <div style={{ textAlign: 'center', padding: '16px 0' }}>
          <Spin size="large" />
          <div style={{ marginTop: 16 }}>
            <Typography.Text>Trayendo usuarios desde Moodle, espera un momento...</Typography.Text>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default GroupUsersManager;
