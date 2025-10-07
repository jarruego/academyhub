import { Table, Tag, Spin, Alert } from "antd";
import { useMoodleUsersByUserIdQuery } from "../../hooks/api/moodle-users/use-moodle-users-by-user-id.query";

interface MoodleUsersSectionProps {
  userId: number;
}

export function MoodleUsersSection({ userId }: MoodleUsersSectionProps) {
  const { data: moodleUsers, isLoading, error } = useMoodleUsersByUserIdQuery(userId);

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

  const columns = [
    {
      title: 'ID Moodle User',
      dataIndex: 'id_moodle_user',
      key: 'id_moodle_user',
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
      render: (username: string) => <Tag color="blue">{username}</Tag>,
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