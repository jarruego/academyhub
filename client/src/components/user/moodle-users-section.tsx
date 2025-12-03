import { Table, Tag, Spin, Alert, Button, Popconfirm, message, Tooltip } from "antd";
import { FileProtectOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useMoodleUsersByUserIdQuery } from "../../hooks/api/moodle-users/use-moodle-users-by-user-id.query";
import { useOrganizationSettingsQuery } from '../../hooks/api/organization/use-organization-settings.query';
import type { MoodleUserSelectModel } from '../../shared/types/moodle/moodle-user.types';

import { useQueries, UseQueryResult } from '@tanstack/react-query';
import type { AxiosError } from 'axios';
import { useAuthenticatedAxios } from '../../utils/api/use-authenticated-axios.util';
import { getApiHost } from '../../utils/api/get-api-host.util';
import type { UserCourseWithCourse } from '../../shared/types/user-course/user-course.types';
import { useSetMainMoodleUserMutation } from '../../hooks/api/moodle-users/use-set-main-moodle-user.mutation';

interface MoodleUsersSectionProps {
  userId: number;
}

export function MoodleUsersSection({ userId }: MoodleUsersSectionProps) {
  const { data: moodleUsers, isLoading, error } = useMoodleUsersByUserIdQuery(userId);
  const request = useAuthenticatedAxios();
  const setMainMutation = useSetMainMoodleUserMutation(userId);
  const { data: orgSettings } = useOrganizationSettingsQuery();
  const [messageApi, messageContextHolder] = message.useMessage();
  const certificatesPluginEnabled = Boolean(
    orgSettings?.settings && (orgSettings.settings as any).plugins?.certificates === true,
  );
  // Prepare queries to fetch courses for each moodle user in parallel
  const courseQueries = useQueries({
    queries: (moodleUsers || []).map(mu => ({
      queryKey: ['moodle-user-courses', mu.id_moodle_user],
      queryFn: async () => {
        const resp = await request({ method: 'GET', url: `${getApiHost()}/moodle-user/${mu.id_moodle_user}/courses` });
        return resp.data;
      },
      enabled: !!mu.id_moodle_user,
      staleTime: 1000 * 60, // 1 minute
    }))
  });
  const typedCourseQueries = courseQueries as UseQueryResult<UserCourseWithCourse[], AxiosError>[];
  const courseQueriesMap = new Map<number, UseQueryResult<UserCourseWithCourse[], AxiosError>>();
  (moodleUsers || []).forEach((mu, idx) => courseQueriesMap.set(mu.id_moodle_user, typedCourseQueries[idx]));

  if (isLoading) {
    return <Spin size="large" style={{ display: 'block', textAlign: 'center', padding: '50px' }} />;
  }

  if (error) {
    return (
      <Alert
        message="Error al cargar usuarios de Moodle"
        description="No se pudieron obtener los datos de Moodle para este usuario."
        type="error"
        showIcon
      />
    );
  }

  if (!moodleUsers || moodleUsers.length === 0) {
    return (
      <Alert
        message="No hay usuarios de Moodle asociados"
        description="Este usuario no tiene cuentas de Moodle asociadas."
        type="info"
        showIcon
      />
    );
  }
  const columns: ColumnsType<MoodleUserSelectModel> = [
    {
      title: 'ID Moodle User',
      dataIndex: 'id_moodle_user',
      key: 'id_moodle_user',
    },
    {
      title: 'Cursos',
      key: 'courses',
      render: (_value, record) => {
        // We'll map moodle user id to the courses query result using the pre-fetched queries
        const mq = courseQueriesMap.get(record.id_moodle_user);
        if (!mq) return '-';
        if (mq.isLoading) return <Spin size="small" />;
        const courses = mq.data || [];
        if (courses.length === 0) return '-';
        return (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {courses.map((uc: UserCourseWithCourse) => {
              const pct = Number(uc.completion_percentage ?? 0);
              const color = pct >= 75 ? 'green' : 'default';
              const label = uc.course.course_name ?? uc.course.short_name;
              return (
                <Tag key={`${record.id_moodle_user}-${uc.course.id_course}`} color={color}>{label}</Tag>
              );
            })}
          </div>
        );
      }
  },
    {
      title: 'Moodle ID',
      dataIndex: 'moodle_id',
      key: 'moodle_id',
    },
    {
      title: 'Username Moodle',
      dataIndex: 'moodle_username',
      key: 'moodle_username',
      render: (username: string, record: MoodleUserSelectModel) => {
        const handleSetMain = async () => {
          try {
            await setMainMutation.mutateAsync(record.id_moodle_user);
            messageApi.success('Cuenta de Moodle marcada como principal');
          } catch (err) {
            messageApi.error('Error marcando como principal');
          }
        };

        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Tag color={record.is_main_user ? 'green' : 'blue'}>{username}</Tag>
            {!record.is_main_user && (
              <Popconfirm
                title={
                  <div>
                    <div>Marcar esta cuenta como principal?</div>
                    <div style={{ fontSize: 12, marginTop: 6 }}>
                      La cuenta principal será la que se utilice para dar de alta cursos y grupos en Moodle.
                    </div>
                    <div style={{ fontSize: 12, marginTop: 6 }}>
                      Consulte antes con el administrador de Moodle si no está seguro.
                    </div>
                  </div>
                }
                onConfirm={handleSetMain}
                okText="Sí"
                cancelText="No"
              >
                <Button size="small">Hacer principal</Button>
              </Popconfirm>
            )}
          </div>
        );
      },
    },
    // action column: open Moodle certificates for this moodle_id
    {
      title: 'Cert.',
      key: 'actions',
      render: (_v, record: MoodleUserSelectModel) => {
        // build moodle base origin from org settings if available
        let moodleBase: string | undefined;
        try {
          const raw = (orgSettings?.settings as any)?.moodle?.url ?? '';
          if (raw) moodleBase = new URL(raw).origin + '/';
        } catch (e) {
          moodleBase = undefined;
        }

        const target = moodleBase ? `${moodleBase}mod/customcert/my_certificates.php?userid=${record.moodle_id}` : undefined;
        const disabled = !certificatesPluginEnabled || !target;
        const tip = !certificatesPluginEnabled ? 'Plugin de certificados no habilitado' : (!target ? 'URL de Moodle no configurada' : 'Ver certificados');
        return (
          <div style={{ display: 'flex', gap: 8 }}>
            <Tooltip title={tip}>
              <Button
                size="small"
                disabled={disabled}
                icon={<FileProtectOutlined />}
                aria-label="Ver certificados"
                onClick={() => !disabled && target && window.open(target, '_blank', 'noopener,noreferrer')}
              />
            </Tooltip>
          </div>
        );
      }
    },
  ];

  return (
    <div>
      {messageContextHolder}
      <h3>Usuarios de Moodle Asociados</h3>
      <Table
        columns={columns}
        dataSource={moodleUsers}
        rowKey="id_moodle_user"
        pagination={false}
        size="small"
      />
    </div>
  );
}