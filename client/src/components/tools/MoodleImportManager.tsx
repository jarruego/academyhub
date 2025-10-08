import React, { useState } from 'react';
import { Table, Button, Tag, Typography, Space, Card, Modal, message, Spin } from 'antd';
import { ExpandAltOutlined, ReloadOutlined, ImportOutlined, CloudDownloadOutlined } from '@ant-design/icons';
import { useMoodleCoursesQuery } from '../../hooks/api/moodle/use-moodle-courses.query';
import { useMoodleGroupsByCourseQuery } from '../../hooks/api/moodle/use-moodle-groups-by-course.query';
import { useImportMoodleCourseMutation } from '../../hooks/api/moodle/use-import-moodle-course.mutation';
import { useImportMoodleGroupMutation } from '../../hooks/api/moodle/use-import-moodle-group.mutation';
import { useReimportMoodleMutation } from '../../hooks/api/moodle/use-reimport-moodle.mutation';
import { MoodleCourseWithImportStatus, MoodleGroupWithImportStatus } from '../../shared/types/moodle-import';

const { Title, Text } = Typography;

const GroupsTable: React.FC<{ 
  courseId: number; 
  onImportGroup: (group: MoodleGroupWithImportStatus) => void;
  importingGroupIds: Set<number>;
}> = ({ courseId, onImportGroup, importingGroupIds }) => {
  const { data: groupsData, isLoading } = useMoodleGroupsByCourseQuery(courseId, true);

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Nunca';
    return new Date(dateString).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const groupColumns = [
    {
      title: 'Nombre del Grupo',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: MoodleGroupWithImportStatus) => (
        <div>
          <div style={{ fontWeight: 500 }}>{text}</div>
          {record.description && (
            <Text type="secondary" style={{ fontSize: '12px' }}>
              {record.description}
            </Text>
          )}
        </div>
      ),
    },
    {
      title: 'Estado',
      dataIndex: 'isImported',
      key: 'status',
      render: (isImported: boolean) => (
        <Tag color={isImported ? 'green' : 'orange'}>
          {isImported ? '✓ Importado' : '⏳ Pendiente'}
        </Tag>
      ),
    },
    {
      title: 'Última Importación',
      dataIndex: 'lastImportDate',
      key: 'lastImportDate',
      render: (date: string) => <Text>{formatDate(date)}</Text>,
    },
    {
      title: 'Acciones',
      key: 'actions',
      render: (_: any, record: MoodleGroupWithImportStatus) => (
        <Button
          type="primary"
          size="small"
          icon={<ImportOutlined />}
          onClick={() => onImportGroup(record)}
          loading={importingGroupIds.has(record.id)}
        >
          {record.isImported ? 'Reimportar' : 'Importar'}
        </Button>
      ),
    },
  ];

  if (isLoading) {
    return <Spin size="small" />;
  }

  const groups = groupsData?.data?.groups || [];

  if (groups.length === 0) {
    return <Text type="secondary">No hay grupos en este curso</Text>;
  }

  return (
    <Table
      columns={groupColumns}
      dataSource={groups}
      rowKey="id"
      size="small"
      pagination={false}
      style={{ marginTop: 16 }}
    />
  );
};

export const MoodleImportManager: React.FC = () => {
  const { data: coursesData, isLoading, error, refetch } = useMoodleCoursesQuery();
  const importCourseMutation = useImportMoodleCourseMutation();
  const importGroupMutation = useImportMoodleGroupMutation();
  const importAllMutation = useReimportMoodleMutation();
  
  // Estado para rastrear qué elementos específicos están siendo importados
  const [importingCourseIds, setImportingCourseIds] = useState<Set<number>>(new Set());
  const [importingGroupIds, setImportingGroupIds] = useState<Set<number>>(new Set());
  
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean;
    type: 'course' | 'group';
    item: MoodleCourseWithImportStatus | MoodleGroupWithImportStatus | null;
  }>({
    open: false,
    type: 'course',
    item: null,
  });

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Nunca';
    return new Date(dateString).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatMoodleDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString('es-ES');
  };

  const handleImportCourse = (course: MoodleCourseWithImportStatus) => {
    setConfirmModal({
      open: true,
      type: 'course',
      item: course,
    });
  };

  const handleImportGroup = (group: MoodleGroupWithImportStatus) => {
    setConfirmModal({
      open: true,
      type: 'group',
      item: group,
    });
  };

  const handleConfirmImport = async () => {
    if (!confirmModal.item) return;

    try {
      if (confirmModal.type === 'course') {
        // Agregar el ID del curso al conjunto de cursos en importación
        setImportingCourseIds(prev => new Set(prev).add(confirmModal.item!.id));
        
        const response = await importCourseMutation.mutateAsync(confirmModal.item.id);
        const result = response.data;
        if (result.success) {
          message.success(result.message);
        } else {
          message.error(result.error || 'Error durante la importación');
        }
        
        // Remover el ID del conjunto de cursos en importación
        setImportingCourseIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(confirmModal.item!.id);
          return newSet;
        });
      } else {
        // Agregar el ID del grupo al conjunto de grupos en importación
        setImportingGroupIds(prev => new Set(prev).add(confirmModal.item!.id));
        
        const response = await importGroupMutation.mutateAsync(confirmModal.item.id);
        const result = response.data;
        if (result.success) {
          message.success(result.message);
        } else {
          message.error(result.error || 'Error durante la importación');
        }
        
        // Remover el ID del conjunto de grupos en importación
        setImportingGroupIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(confirmModal.item!.id);
          return newSet;
        });
      }
      
      refetch();
      setConfirmModal({ open: false, type: 'course', item: null });
    } catch (error) {
      // Limpiar estados de loading en caso de error
      if (confirmModal.type === 'course') {
        setImportingCourseIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(confirmModal.item!.id);
          return newSet;
        });
      } else {
        setImportingGroupIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(confirmModal.item!.id);
          return newSet;
        });
      }
      
      message.error('Error durante la importación');
      console.error('Error durante la importación:', error);
    }
  };

  const handleImportAll = async () => {
    try {
      await importAllMutation.mutateAsync();
      message.success('Importación completa realizada exitosamente');
      refetch();
    } catch (error) {
      message.error('Error durante la importación completa');
      console.error('Error durante la importación completa:', error);
    }
  };

  const courses = coursesData?.data?.courses || [];
  const importedCount = courses.filter((c: MoodleCourseWithImportStatus) => c.isImported).length;

  const columns = [
    {
      title: 'Curso',
      dataIndex: 'fullname',
      key: 'fullname',
      render: (text: string, record: MoodleCourseWithImportStatus) => (
        <div>
          <div style={{ fontWeight: 500, color: '#1890ff' }}>{text}</div>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            {record.shortname}
          </Text>
        </div>
      ),
    },
    {
      title: 'Fechas',
      key: 'dates',
      render: (_: any, record: MoodleCourseWithImportStatus) => (
        <div>
          <div>{formatMoodleDate(record.startdate)}</div>
          {record.enddate && record.enddate > 0 && (
            <Text type="secondary" style={{ fontSize: '12px' }}>
              - {formatMoodleDate(record.enddate)}
            </Text>
          )}
        </div>
      ),
    },
    {
      title: 'Estado',
      dataIndex: 'isImported',
      key: 'status',
      render: (isImported: boolean) => (
        <Tag color={isImported ? 'green' : 'orange'}>
          {isImported ? '✓ Importado' : '⏳ Pendiente'}
        </Tag>
      ),
    },
    {
      title: 'Última Importación',
      dataIndex: 'lastImportDate',
      key: 'lastImportDate',
      render: (date: string) => <Text>{formatDate(date)}</Text>,
    },
    {
      title: 'Acciones',
      key: 'actions',
      render: (_: any, record: MoodleCourseWithImportStatus) => (
        <Button
          type="primary"
          icon={<ImportOutlined />}
          onClick={() => handleImportCourse(record)}
          loading={importingCourseIds.has(record.id)}
        >
          {record.isImported ? 'Reimportar' : 'Importar'} Curso
        </Button>
      ),
    },
  ];

  const expandedRowRender = (record: MoodleCourseWithImportStatus) => {
    return (
      <div style={{ margin: '0 48px' }}>
        <Title level={5} style={{ marginBottom: 16 }}>Grupos del curso:</Title>
        <GroupsTable 
          courseId={record.id} 
          onImportGroup={handleImportGroup} 
          importingGroupIds={importingGroupIds}
        />
      </div>
    );
  };

  if (error) {
    return (
      <Card>
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Text type="danger">Error al cargar los cursos de Moodle</Text>
          <br />
          <Button 
            type="primary" 
            onClick={() => refetch()}
            style={{ marginTop: 16 }}
          >
            Reintentar
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div>
      <Card>
        <div style={{ marginBottom: 24 }}>
          <Title level={2} style={{ marginBottom: 8 }}>Importación desde Moodle</Title>
          <Text type="secondary">
            {courses.length} cursos encontrados ({importedCount} importados)
          </Text>
        </div>

        <Space style={{ marginBottom: 16 }}>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => refetch()}
            loading={isLoading}
          >
            Actualizar Lista
          </Button>
          <Button
            type="primary"
            danger
            icon={<CloudDownloadOutlined />}
            onClick={handleImportAll}
            loading={importAllMutation.isPending}
          >
            Importar Todo
          </Button>
        </Space>

        <Table
          columns={columns}
          dataSource={courses}
          rowKey="id"
          loading={isLoading}
          expandable={{
            expandedRowRender,
            expandIcon: ({ expanded, onExpand, record }) => (
              <Button
                type="text"
                size="small"
                icon={<ExpandAltOutlined style={{ transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)' }} />}
                onClick={(e) => onExpand(record, e)}
              />
            ),
          }}
          locale={{
            emptyText: 'No se encontraron cursos en Moodle',
          }}
        />
      </Card>

      <Modal
        title={`Confirmar importación de ${confirmModal.type === 'course' ? 'curso' : 'grupo'}`}
        open={confirmModal.open}
        onOk={handleConfirmImport}
        onCancel={() => setConfirmModal({ open: false, type: 'course', item: null })}
        confirmLoading={importCourseMutation.isPending || importGroupMutation.isPending}
        okText={`Importar ${confirmModal.type === 'course' ? 'curso' : 'grupo'}`}
        cancelText="Cancelar"
      >
        <p>
          ¿Estás seguro de que quieres importar el {confirmModal.type === 'course' ? 'curso' : 'grupo'}{' '}
          <strong>
            "{confirmModal.type === 'course' 
              ? (confirmModal.item as MoodleCourseWithImportStatus)?.fullname 
              : (confirmModal.item as MoodleGroupWithImportStatus)?.name}"
          </strong> desde Moodle?
        </p>
        <div style={{ 
          background: '#fff7e6', 
          border: '1px solid #ffd591', 
          borderRadius: '6px', 
          padding: '12px', 
          marginTop: '12px' 
        }}>
          <Text type="warning">
            ⚠️ Esta acción importará todos los usuarios y datos asociados. 
            Los datos existentes se actualizarán.
          </Text>
        </div>
      </Modal>
    </div>
  );
};