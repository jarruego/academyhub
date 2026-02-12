import React from 'react';
import { Table, Tag, Spin, Empty, Button } from 'antd';
import type { ColumnType } from 'antd/es/table';
import { useUserCoursesQuery } from '../../hooks/api/users/use-user-courses.query';
import { UserCourseWithCourse } from '../../shared/types/user-course/user-course.types';
import { useOrganizationSettingsQuery } from '../../hooks/api/organization/use-organization-settings.query';
import { useMoodleUsersByUserIdQuery } from '../../hooks/api/moodle-users/use-moodle-users-by-user-id.query';

interface UserCoursesSectionProps {
  userId: number;
}

export const UserCoursesSection: React.FC<UserCoursesSectionProps> = ({ userId }) => {
  const { data: userCourses, isLoading } = useUserCoursesQuery(userId);
  const { data: orgSettings } = useOrganizationSettingsQuery();
  const { data: moodleUsers } = useMoodleUsersByUserIdQuery(userId);
  const moodleUserId = React.useMemo(() => {
    if (!moodleUsers || !moodleUsers.length) return undefined;
    const main = (moodleUsers as any).find((mu: any) => mu.is_main_user) || moodleUsers[0];
    return main?.moodle_id ?? undefined;
  }, [moodleUsers]);

  const showCertificatesButton = Boolean(
    orgSettings?.settings &&
      (orgSettings.settings as any).plugins?.certificates === true &&
      ((orgSettings.settings as any).moodle?.url ?? '') &&
      moodleUserId !== undefined,
  );

  const moodleBaseUrl = React.useMemo(() => {
    try {
      const raw = (orgSettings?.settings as any)?.moodle?.url ?? '';
      if (!raw) return undefined;
      const u = new URL(raw);
      return `${u.origin}/`;
    } catch (e) {
      return undefined;
    }
  }, [orgSettings]);

  const columns: ColumnType<UserCourseWithCourse>[] = [
    {
      title: 'Nombre del Curso',
      dataIndex: ['course', 'course_name'],
      key: 'course_name',
      render: (text: string) => <strong>{text}</strong>,
    },
    {
      title: 'Grupos',
      key: 'groups',
      render: (_value, record: UserCourseWithCourse) => {
        const groups = record.groups ?? [];
        if (groups.length === 0) return '-';
        return (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {groups.map((g) => (
              <Tag key={g.id_group} color="blue">{g.group_name}</Tag>
            ))}
          </div>
        );
      },
    },
    {
      title: 'Nombre Corto',
      dataIndex: ['course', 'short_name'],
      key: 'short_name',
    },
    {
      title: 'Modalidad',
      dataIndex: ['course', 'modality'],
      key: 'modality',
      render: (modality: string) => {
        const color = modality === 'PRESENCIAL' ? 'blue' : 
                    modality === 'ONLINE' ? 'green' : 
                    modality === 'MIXTA' ? 'orange' : 'default';
        return <Tag color={color}>{modality}</Tag>;
      },
    },
    {
      title: 'Progreso',
      dataIndex: 'completion_percentage',
      key: 'completion_percentage',
      render: (percentage: string | null) => {
        if (!percentage) return '-';
        const value = parseFloat(percentage);
        return `${value.toFixed(1)}%`;
      },
    },
    {
      title: 'Estado',
      dataIndex: ['course', 'active'],
      key: 'active',
      render: (active: boolean) => (
        <Tag color={active ? 'green' : 'red'}>
          {active ? 'Activo' : 'Inactivo'}
        </Tag>
      ),
    },
  ];

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!userCourses || userCourses.length === 0) {
    return (
      <Empty
        description="No hay cursos matriculados"
        image={Empty.PRESENTED_IMAGE_SIMPLE}
      />
    );
  }

  return (
    <>
      {showCertificatesButton && moodleBaseUrl && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
          <Button
            type="default"
            onClick={() => {
              const url = `${moodleBaseUrl}mod/customcert/my_certificates.php?userid=${moodleUserId}`;
              window.open(url, '_blank', 'noopener,noreferrer');
            }}
          >Abrir certificados Moodle</Button>
        </div>
      )}

      <Table
      columns={columns}
      dataSource={userCourses}
      rowKey={(record) => `${record.id_user}-${record.id_course}`}
      pagination={{
        pageSize: 10,
        showSizeChanger: true,
        showQuickJumper: true,
        showTotal: (total, range) =>
          `${range[0]}-${range[1]} de ${total} cursos`,
      }}
      scroll={{ x: 1200 }}
      rowClassName={(record: UserCourseWithCourse) => {
        const pct = Number(record.completion_percentage ?? 0);
        if (isNaN(pct)) return 'user-course-row incomplete';
        return `user-course-row ${pct >= 75 ? 'completed' : 'incomplete'}`;
      }}
      onRow={(record: UserCourseWithCourse) => ({
        onDoubleClick: () => {
          const courseId = record.course?.id_course;
          if (courseId) {
            const url = `${window.location.origin}/courses/${courseId}`;
            window.open(url, '_blank', 'noopener,noreferrer');
          }
        },
      })}
    />
    </>
  );
};