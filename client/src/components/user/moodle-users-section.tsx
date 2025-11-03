import { Table, Tag, Spin, Alert } from "antd";
import type { ColumnsType } from 'antd/es/table';
import { useMoodleUsersByUserIdQuery } from "../../hooks/api/moodle-users/use-moodle-users-by-user-id.query";
import type { MoodleUserSelectModel } from '../../shared/types/moodle/moodle-user.types';

import { useQueries, UseQueryResult } from '@tanstack/react-query';
import type { AxiosError } from 'axios';
import { useAuthenticatedAxios } from '../../utils/api/use-authenticated-axios.util';
import { getApiHost } from '../../utils/api/get-api-host.util';
import type { UserCourseWithCourse } from '../../shared/types/user-course/user-course.types';

interface MoodleUsersSectionProps {
  userId: number;
}

export function MoodleUsersSection({ userId }: MoodleUsersSectionProps) {
  const { data: moodleUsers, isLoading, error } = useMoodleUsersByUserIdQuery(userId);
  const request = useAuthenticatedAxios();
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
      render: (username: string, record: MoodleUserSelectModel) => (
        <Tag color={(record as any).is_main_user ? 'green' : 'blue'}>{username}</Tag>
      ),
    },
    {
      title: 'Fecha Creación',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => new Date(date).toLocaleDateString('es-ES'),
    },
    {
      title: 'Última Actualización',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      render: (date: string) => new Date(date).toLocaleDateString('es-ES'),
    },
  ];

  return (
    <div>
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