import React, { useMemo, useState } from 'react';
import { Table, Button, Tag, Typography, Space, Card, Spin } from 'antd';
import { ReloadOutlined, SyncOutlined } from '@ant-design/icons';
import { useActiveCoursesProgressQuery } from '../../hooks/api/moodle/use-active-courses-progress.query';
import { useSyncMoodleGroupMembersMutation } from '../../hooks/api/moodle/use-sync-moodle-group-members.mutation';
import type { ActiveCourseProgress, ActiveGroupInfo } from '../../hooks/api/moodle/use-active-courses-progress.query';

const { Title, Text } = Typography;

type GroupSyncState = {
  status: 'pending' | 'success' | 'error';
  error?: string;
};

export const ActiveCoursesProgressTab: React.FC = () => {
  const { data: coursesData, isLoading, refetch } = useActiveCoursesProgressQuery();
  const { mutateAsync: syncGroup } = useSyncMoodleGroupMembersMutation();
  const [syncing, setSyncing] = useState(false);
  const [groupStatus, setGroupStatus] = useState<Record<number, GroupSyncState>>({});

  const courses = useMemo(() => {
    if (!coursesData) return [] as ActiveCourseProgress[];
    return Array.isArray(coursesData) ? coursesData : coursesData.data;
  }, [coursesData]);

  const allGroups: ActiveGroupInfo[] = useMemo(() => {
    const groups: ActiveGroupInfo[] = [];
    for (const course of courses) {
      for (const group of course.groups) groups.push(group);
    }
    return groups;
  }, [courses]);

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleSyncAll = async () => {
    if (allGroups.length === 0) return;

    setSyncing(true);
    const initial: Record<number, GroupSyncState> = {};
    allGroups.forEach(g => {
      initial[g.id_group] = { status: 'pending' };
    });
    setGroupStatus(initial);

    for (const group of allGroups) {
      if (!group.moodle_id) {
        setGroupStatus(prev => ({
          ...prev,
          [group.id_group]: { status: 'error', error: 'Grupo sin moodle_id' }
        }));
        continue;
      }

      try {
        const response = await syncGroup(group.moodle_id);
        const result = response.data;

        if (result.success) {
          setGroupStatus(prev => ({
            ...prev,
            [group.id_group]: { status: 'success' }
          }));
        } else {
          setGroupStatus(prev => ({
            ...prev,
            [group.id_group]: { status: 'error', error: result.message }
          }));
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setGroupStatus(prev => ({
          ...prev,
          [group.id_group]: { status: 'error', error: msg }
        }));
      }
    }

    setSyncing(false);
    refetch();
  };

  const groupColumns = [
    {
      title: 'Grupo',
      dataIndex: 'group_name',
      key: 'group_name',
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: 'Fecha fin',
      dataIndex: 'end_date',
      key: 'end_date',
      render: (date: string | null) => formatDate(date),
    },
    {
      title: 'Estado',
      key: 'status',
      render: (_: unknown, record: ActiveGroupInfo) => {
        const status = groupStatus[record.id_group]?.status;
        if (status === 'success') return <Tag color="green">✓</Tag>;
        if (status === 'error') return <Tag color="red">✗</Tag>;
        if (status === 'pending') return <Tag color="blue">…</Tag>;
        return <Tag>—</Tag>;
      },
    },
    {
      title: 'Errores',
      key: 'errors',
      render: (_: unknown, record: ActiveGroupInfo) => {
        const error = groupStatus[record.id_group]?.error;
        if (!error) return <Text type="secondary">—</Text>;
        return (
          <div style={{ background: '#fff1f0', border: '1px solid #ffccc7', padding: '6px 8px', borderRadius: 4 }}>
            <Text type="danger" style={{ fontSize: 12 }}>{error}</Text>
          </div>
        );
      },
    },
  ];

  const courseColumns = [
    {
      title: 'Curso',
      dataIndex: 'course_name',
      key: 'course_name',
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: 'Grupos activos',
      dataIndex: 'groups',
      key: 'groups_count',
      render: (groups: ActiveGroupInfo[]) => <Tag color="blue">{groups.length}</Tag>,
    },
  ];

  const expandedRowRender = (record: ActiveCourseProgress) => (
    <Table
      columns={groupColumns}
      dataSource={record.groups}
      rowKey="id_group"
      size="small"
      pagination={false}
    />
  );

  if (isLoading) {
    return (
      <Card>
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Spin size="large" />
          <div style={{ marginTop: 16 }}>Cargando cursos activos...</div>
        </div>
      </Card>
    );
  }

  return (
    <div>
      <Card>
        <div style={{ marginBottom: 16 }}>
          <Title level={3} style={{ marginBottom: 4 }}>Cursos Activos</Title>
          <Text type="secondary">Cursos con grupos cuyo fin es posterior a las últimas 24h.</Text>
        </div>

        <Space style={{ marginBottom: 16 }}>
          <Button icon={<ReloadOutlined />} onClick={() => refetch()} loading={isLoading}>
            Actualizar lista
          </Button>
          <Button
            type="primary"
            icon={<SyncOutlined />}
            onClick={handleSyncAll}
            loading={syncing}
            disabled={allGroups.length === 0}
          >
            Importar cursos activos
          </Button>
        </Space>

        {courses.length === 0 ? (
          <Card style={{ textAlign: 'center', background: '#fafafa' }}>
            <Text type="secondary">No hay cursos activos en este momento</Text>
          </Card>
        ) : (
          <Table
            columns={courseColumns}
            dataSource={courses}
            rowKey="id_course"
            expandable={{ expandedRowRender, defaultExpandAllRows: true }}
            pagination={false}
          />
        )}
      </Card>
    </div>
  );
};
