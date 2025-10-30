import React, { useState } from 'react';
import {
    Card,
    Table,
    Tag,
    Button,
    Space,
    Typography,
    Alert,
    Modal,
    Descriptions,
    Progress,
    Select,
    Input,
    DatePicker,
    Tooltip
} from 'antd';
import {
    HistoryOutlined,
    EyeOutlined,
    ReloadOutlined,
    FilterOutlined,
    CheckCircleOutlined,
    CloseCircleOutlined,
    ClockCircleOutlined,
    ExclamationCircleOutlined,
    LoadingOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import { useRecentJobs } from '../../hooks/api/import-sage/useImportJobs';
import { JobInfo } from '../../types/import.types';

dayjs.extend(isBetween);

const { Title, Text } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;

interface JobDetailsModalProps {
    job: JobInfo | null;
    open: boolean;
    onClose: () => void;
}

const JobDetailsModal: React.FC<JobDetailsModalProps> = ({ job, open, onClose }) => {
    if (!job) return null;

    const formatDuration = (start: string, end?: string): string => {
        if (!end) return 'En progreso';
        const duration = dayjs(end).diff(dayjs(start), 'second');
        if (duration < 60) return `${duration}s`;
        if (duration < 3600) return `${Math.round(duration / 60)}m`;
        return `${Math.round(duration / 3600)}h`;
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'completed': return 'success';
            case 'failed': return 'error';
            case 'processing': return 'processing';
            case 'pending': return 'warning';
            case 'cancelled': return 'default';
            default: return 'default';
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'completed': return <CheckCircleOutlined />;
            case 'failed': return <CloseCircleOutlined />;
            case 'processing': return <LoadingOutlined />;
            case 'pending': return <ClockCircleOutlined />;
            case 'cancelled': return <ExclamationCircleOutlined />;
            default: return null;
        }
    };

    return (
        <Modal
            title={`Detalles del Trabajo - ${job.jobId}`}
            open={open}
            onCancel={onClose}
            width={800}
            footer={[
                <Button key="close" onClick={onClose}>
                    Cerrar
                </Button>
            ]}
        >
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
                <Card size="small">
                    <Descriptions title="Información General" column={2}>
                        <Descriptions.Item label="ID del Trabajo">{job.jobId}</Descriptions.Item>
                        <Descriptions.Item label="Tipo">{job.type.toUpperCase()}</Descriptions.Item>
                        <Descriptions.Item label="Estado">
                            <Tag color={getStatusColor(job.status)} icon={getStatusIcon(job.status)}>
                                {job.status.toUpperCase()}
                            </Tag>
                        </Descriptions.Item>
                        <Descriptions.Item label="Progreso">
                            <div style={{ width: 200 }}>
                                <Progress
                                    percent={job.progress}
                                    size="small"
                                    status={job.status === 'failed' ? 'exception' : job.status === 'completed' ? 'success' : 'active'}
                                />
                            </div>
                        </Descriptions.Item>
                        <Descriptions.Item label="Inicio">
                            {dayjs(job.createdAt).format('DD/MM/YYYY HH:mm:ss')}
                        </Descriptions.Item>
                        <Descriptions.Item label="Finalización">
                            {job.completedAt ? dayjs(job.completedAt).format('DD/MM/YYYY HH:mm:ss') : 'En progreso'}
                        </Descriptions.Item>
                        <Descriptions.Item label="Duración">
                            {formatDuration(job.createdAt, job.completedAt)}
                        </Descriptions.Item>
                        <Descriptions.Item label="Filas Procesadas">
                            {job.processedRows} / {job.totalRows}
                        </Descriptions.Item>
                    </Descriptions>
                </Card>

                {job.errorMessage && (
                    <Alert
                        message="Error en el Trabajo"
                        description={job.errorMessage}
                        type="error"
                        showIcon
                    />
                )}

                {/* Aquí se podría agregar el resumen si está disponible */}
                {/* Si tienes acceso al resumen del trabajo, lo puedes mostrar aquí */}
            </Space>
        </Modal>
    );
};

export const ImportJobsHistoryComponent: React.FC = () => {
    const [selectedJob, setSelectedJob] = useState<JobInfo | null>(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [filters, setFilters] = useState({
        status: '',
        type: '',
        dateRange: null as [dayjs.Dayjs, dayjs.Dayjs] | null,
        search: ''
    });
    const [limit, setLimit] = useState(50);

    const { data: jobs, isLoading, error, refetch } = useRecentJobs(limit);

    const handleViewJob = (job: JobInfo) => {
        setSelectedJob(job);
        setModalOpen(true);
    };

    const handleFilterChange = (key: string, value: any) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'completed': return 'success';
            case 'failed': return 'error';
            case 'processing': return 'processing';
            case 'pending': return 'warning';
            case 'cancelled': return 'default';
            default: return 'default';
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'completed': return <CheckCircleOutlined />;
            case 'failed': return <CloseCircleOutlined />;
            case 'processing': return <LoadingOutlined />;
            case 'pending': return <ClockCircleOutlined />;
            case 'cancelled': return <ExclamationCircleOutlined />;
            default: return null;
        }
    };

    const formatDuration = (start: string, end?: string): string => {
        if (!end) return '-';
        const duration = dayjs(end).diff(dayjs(start), 'second');
        if (duration < 60) return `${duration}s`;
        if (duration < 3600) return `${Math.round(duration / 60)}m`;
        return `${Math.round(duration / 3600)}h`;
    };

    // Filtrar trabajos
    const filteredJobs = jobs?.filter(job => {
        if (filters.status && job.status !== filters.status) return false;
        if (filters.type && job.type !== filters.type) return false;
        if (filters.search && !job.jobId.toLowerCase().includes(filters.search.toLowerCase())) return false;
        if (filters.dateRange) {
            const jobDate = dayjs(job.createdAt);
            if (!jobDate.isBetween(filters.dateRange[0], filters.dateRange[1], 'day', '[]')) return false;
        }
        return true;
    }) || [];

    const columns = [
        {
            title: 'ID del Trabajo',
            dataIndex: 'jobId',
            key: 'jobId',
            width: 200,
            render: (jobId: string) => (
                <Text code style={{ fontSize: '12px' }}>
                    {jobId}
                </Text>
            ),
        },
        {
            title: 'Tipo',
            dataIndex: 'type',
            key: 'type',
            width: 80,
            render: (type: string) => (
                <Tag color="blue">{type.toUpperCase()}</Tag>
            ),
        },
        {
            title: 'Estado',
            dataIndex: 'status',
            key: 'status',
            width: 120,
            render: (status: string) => (
                <Tag color={getStatusColor(status)} icon={getStatusIcon(status)}>
                    {status.toUpperCase()}
                </Tag>
            ),
            filters: [
                { text: 'Completado', value: 'completed' },
                { text: 'Fallido', value: 'failed' },
                { text: 'En Progreso', value: 'processing' },
                { text: 'Pendiente', value: 'pending' },
                { text: 'Cancelado', value: 'cancelled' },
            ],
            onFilter: (value: any, record: JobInfo) => record.status === value,
        },
        {
            title: 'Progreso',
            key: 'progress',
            width: 150,
            render: (_: any, record: JobInfo) => (
                <div>
                    <Progress
                        percent={record.progress}
                        size="small"
                        status={record.status === 'failed' ? 'exception' : record.status === 'completed' ? 'success' : 'active'}
                        showInfo={false}
                    />
                    <Text style={{ fontSize: '12px' }}>
                        {record.processedRows} / {record.totalRows}
                    </Text>
                </div>
            ),
        },
        {
            title: 'Inicio',
            dataIndex: 'createdAt',
            key: 'createdAt',
            width: 140,
            render: (date: string) => (
                <Tooltip title={dayjs(date).format('DD/MM/YYYY HH:mm:ss')}>
                    <div>
                        <div>{dayjs(date).format('DD/MM/YYYY')}</div>
                        <Text type="secondary" style={{ fontSize: '12px' }}>
                            {dayjs(date).format('HH:mm:ss')}
                        </Text>
                    </div>
                </Tooltip>
            ),
            sorter: (a: JobInfo, b: JobInfo) => dayjs(a.createdAt).unix() - dayjs(b.createdAt).unix(),
            defaultSortOrder: 'descend' as const,
        },
        {
            title: 'Duración',
            key: 'duration',
            width: 100,
            render: (_: any, record: JobInfo) => (
                <Text>{formatDuration(record.createdAt, record.completedAt)}</Text>
            ),
        },
        {
            title: 'Acciones',
            key: 'actions',
            width: 100,
            render: (_: any, record: JobInfo) => (
                <Button
                    type="link"
                    size="small"
                    onClick={() => handleViewJob(record)}
                    icon={<EyeOutlined />}
                >
                    Ver
                </Button>
            ),
        },
    ];

    if (error) {
        return (
            <Alert
                message="Error cargando historial"
                description="No se pudo cargar el historial de trabajos. Intenta refrescar la página."
                type="error"
                showIcon
                action={<Button onClick={() => refetch()}>Reintentar</Button>}
            />
        );
    }

    return (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Card>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Title level={4} style={{ margin: 0 }}>
                        <HistoryOutlined style={{ marginRight: 8 }} />
                        Historial de Importaciones
                    </Title>
                    <Space>
                        <Select
                            value={limit}
                            onChange={setLimit}
                            style={{ width: 120 }}
                        >
                            <Option value={25}>25 trabajos</Option>
                            <Option value={50}>50 trabajos</Option>
                            <Option value={100}>100 trabajos</Option>
                            <Option value={200}>200 trabajos</Option>
                        </Select>
                        <Button onClick={() => refetch()} loading={isLoading} icon={<ReloadOutlined />}>
                            Actualizar
                        </Button>
                    </Space>
                </div>
            </Card>

            {/* Filtros */}
            <Card size="small" title={<><FilterOutlined /> Filtros</>}>
                <Space wrap>
                    <Input.Search
                        placeholder="Buscar por ID de trabajo"
                        style={{ width: 200 }}
                        value={filters.search}
                        onChange={(e) => handleFilterChange('search', e.target.value)}
                        allowClear
                    />
                    <Select
                        placeholder="Estado"
                        style={{ width: 120 }}
                        value={filters.status || undefined}
                        onChange={(value) => handleFilterChange('status', value)}
                        allowClear
                    >
                        <Option value="completed">Completado</Option>
                        <Option value="failed">Fallido</Option>
                        <Option value="processing">En Progreso</Option>
                        <Option value="pending">Pendiente</Option>
                        <Option value="cancelled">Cancelado</Option>
                    </Select>
                    <Select
                        placeholder="Tipo"
                        style={{ width: 100 }}
                        value={filters.type || undefined}
                        onChange={(value) => handleFilterChange('type', value)}
                        allowClear
                    >
                        <Option value="csv">CSV</Option>
                        <Option value="sage">SAGE</Option>
                        <Option value="excel">Excel</Option>
                    </Select>
                    <RangePicker
                        value={filters.dateRange}
                        onChange={(dates) => handleFilterChange('dateRange', dates)}
                        format="DD/MM/YYYY"
                        placeholder={['Fecha inicio', 'Fecha fin']}
                    />
                </Space>
            </Card>

            {/* Tabla */}
            <Card>
                <Table
                    columns={columns}
                    dataSource={filteredJobs}
                    rowKey="jobId"
                    loading={isLoading}
                    pagination={{
                        pageSize: 20,
                        showSizeChanger: true,
                        showQuickJumper: true,
                        showTotal: (total, range) => 
                            `${range[0]}-${range[1]} de ${total} trabajos`,
                    }}
                    scroll={{ x: 1000 }}
                    size="small"
                />
            </Card>

            <JobDetailsModal
                job={selectedJob}
                open={modalOpen}
                onClose={() => {
                    setModalOpen(false);
                    setSelectedJob(null);
                }}
            />
        </Space>
    );
};