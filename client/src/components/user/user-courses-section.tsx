import React from 'react';
import { Table, Tag, Spin, Empty } from 'antd';
import type { ColumnType } from 'antd/es/table';
import { useUserCoursesQuery } from '../../hooks/api/users/use-user-courses.query';
import { UserCourseWithCourse } from '../../shared/types/user-course/user-course.types';

interface UserCoursesSectionProps {
  userId: number;
}

export const UserCoursesSection: React.FC<UserCoursesSectionProps> = ({ userId }) => {
  const { data: userCourses, isLoading } = useUserCoursesQuery(userId);

  const columns: ColumnType<UserCourseWithCourse>[] = [
    {
      title: 'Nombre del Curso',
      dataIndex: ['course', 'course_name'],
      key: 'course_name',
      render: (text: string) => <strong>{text}</strong>,
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
      title: 'Horas',
      dataIndex: ['course', 'hours'],
      key: 'hours',
      render: (hours: number | null) => hours ? `${hours}h` : '-',
    },
    {
      title: 'Fecha Inicio',
      dataIndex: ['course', 'start_date'],
      key: 'start_date',
      render: (date: string | null) => {
        if (!date) return '-';
        return new Date(date).toLocaleDateString('es-ES');
      },
    },
    {
      title: 'Fecha Fin',
      dataIndex: ['course', 'end_date'],
      key: 'end_date',
      render: (date: string | null) => {
        if (!date) return '-';
        return new Date(date).toLocaleDateString('es-ES');
      },
    },
    {
      title: 'Fecha Matriculación',
      dataIndex: 'enrollment_date',
      key: 'enrollment_date',
      render: (date: string | null) => {
        if (!date) return '-';
        return new Date(date).toLocaleDateString('es-ES');
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
    />
  );
};