import React from 'react';
import { Table, Tag, Spin, Empty, Button, message } from 'antd';
import type { ColumnType } from 'antd/es/table';
import { useUserCoursesQuery } from '../../hooks/api/users/use-user-courses.query';
import { useUserQuery } from '../../hooks/api/users/use-user.query';
import { UserCourseWithCourse } from '../../shared/types/user-course/user-course.types';
import { useOrganizationSettingsQuery } from '../../hooks/api/organization/use-organization-settings.query';
import type { SettingsMap } from '../../shared/types/organization/organization';
import { useMoodleUsersByUserIdQuery } from '../../hooks/api/moodle-users/use-moodle-users-by-user-id.query';
import * as XLSX from 'xlsx';
import { useAuthenticatedAxios } from '../../utils/api/use-authenticated-axios.util';
import { getApiHost } from '../../utils/api/get-api-host.util';

interface UserCoursesSectionProps {
  userId: number;
}

export const UserCoursesSection: React.FC<UserCoursesSectionProps> = ({ userId }) => {
  const { data: userCourses, isLoading } = useUserCoursesQuery(userId);
  const { data: userData } = useUserQuery(userId);
  const { data: orgSettings } = useOrganizationSettingsQuery();
  const { data: moodleUsers } = useMoodleUsersByUserIdQuery(userId);
  const request = useAuthenticatedAxios<Blob>();
  const [messageApi, messageContextHolder] = message.useMessage();
  const [isCertificateLoading, setIsCertificateLoading] = React.useState(false);
  const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);
  const getBoolean = (value: unknown): value is boolean => typeof value === 'boolean';
  const getString = (value: unknown): value is string => typeof value === 'string';
  const moodleUserId = React.useMemo(() => {
    if (!moodleUsers || !moodleUsers.length) return undefined;
    const main = moodleUsers.find((mu) => mu.is_main_user) || moodleUsers[0];
    return main?.moodle_id ?? undefined;
  }, [moodleUsers]);

  const settings: SettingsMap | undefined = orgSettings?.settings ?? undefined;
  const plugins = isRecord(settings?.plugins) ? settings?.plugins : undefined;
  const certificatesEnabled = getBoolean(plugins?.certificates) ? plugins?.certificates : false;
  const moodleConfig = isRecord(settings?.moodle) ? settings?.moodle : undefined;
  const moodleUrl = getString(moodleConfig?.url) ? moodleConfig?.url : '';

  const showCertificatesButton = Boolean(
    certificatesEnabled &&
      moodleUrl &&
      moodleUserId !== undefined,
  );

  const moodleBaseUrl = React.useMemo(() => {
    try {
      const raw = moodleUrl ?? '';
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

  const handleExportExcel = () => {
    if (!userCourses || userCourses.length === 0) {
      messageApi.info('No hay cursos para exportar');
      return;
    }

    const rows = userCourses.map((record) => {
      const groups = (record.groups ?? []).map((g) => g.group_name).join(', ');
      const completionRaw = record.completion_percentage;
      const completion = completionRaw ? `${Number.parseFloat(completionRaw).toFixed(1)}%` : '-';

      return {
        'Nombre': userData?.name ?? '-',
        'Apellido 1': userData?.first_surname ?? '-',
        'Apellido 2': userData?.second_surname ?? '-',
        'DNI': userData?.dni ?? '-',
        'Correo electrónico': userData?.email ?? '-',
        'Nombre del Curso': record.course?.course_name ?? '-',
        'Grupos': groups || '-',
        'Modalidad': record.course?.modality ?? '-',
        'Progreso': completion,
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Cursos');

    const fullName = [userData?.name, userData?.first_surname, userData?.second_surname]
      .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
      .join(' ')
      .trim();
    const safeBaseName = (fullName || `Usuario ${userId}`).replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim();
    XLSX.writeFile(workbook, `${safeBaseName} - Cursos.xlsx`);
  };

  const handleExportCertificate = async () => {
    try {
      setIsCertificateLoading(true);
      const response = await request({
        method: 'GET',
        url: `${getApiHost()}/user/${userId}/courses-certificate`,
        responseType: 'blob',
      });

      const blob = response.data;
      const contentDisposition = String(response.headers?.['content-disposition'] ?? '');
      const filenameMatch = contentDisposition.match(/filename="?([^\"]+)"?/i);
      const filename = filenameMatch?.[1] ?? 'Certificado Cursos.pdf';

      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      messageApi.error('No se pudo generar el certificado de cursos');
    } finally {
      setIsCertificateLoading(false);
    }
  };

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
      {messageContextHolder}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 12 }}>
        <Button type="default" onClick={handleExportExcel}>Exportar a Excel</Button>
        <Button type="default" onClick={handleExportCertificate} loading={isCertificateLoading}>Certificado Cursos</Button>
        {showCertificatesButton && moodleBaseUrl && (
          <Button
            type="default"
            onClick={() => {
              const url = `${moodleBaseUrl}mod/customcert/my_certificates.php?userid=${moodleUserId}`;
              window.open(url, '_blank', 'noopener,noreferrer');
            }}
          >Abrir certificados Moodle</Button>
        )}
      </div>

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