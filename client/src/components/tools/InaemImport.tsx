import React, { useEffect, useState } from "react";
import {
  Card,
  Upload,
  Button,
  Checkbox,
  Progress,
  Typography,
  Alert,
  Space,
  Statistic,
  Row,
  Col,
  Tag,
  Spin,
  Tabs,
} from "antd";
import InaemConflicts from "./InaemConflicts";
import {
  UploadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import type { RcFile } from "antd/es/upload";
import { App } from "antd";
import { AuthzHide } from "../permissions/authz-hide";
import { Role } from "../../hooks/api/auth/use-login.mutation";
import { useInaemImportUpload, useInaemJobStatus } from "../../hooks/api/import-inaem/useInaemImport";

const { Title } = Typography;

type FileKey = "acciones" | "alumnos" | "preinscripciones";

const FILE_LABELS: Record<FileKey, string> = {
  acciones: "Acciones (.xlsx)",
  alumnos: "Alumnos (.xls)",
  preinscripciones: "Preinscripciones (.xls)",
};

const InaemImport: React.FC = () => {
  const { message } = App.useApp();
  const [files, setFiles] = useState<Partial<Record<FileKey, RcFile>>>({});
  const [createMissingCourses, setCreateMissingCourses] = useState(true);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  const uploadMutation = useInaemImportUpload();
  const { data: jobStatus, refetch } = useInaemJobStatus(currentJobId, {
    enabled: !!currentJobId && isPolling,
    refetchInterval: isPolling ? 2000 : false,
  });

  useEffect(() => {
    if (!jobStatus) return;
    if (jobStatus.status === "completed") {
      setIsPolling(false);
      message.success("Importación INAEM completada");
    } else if (jobStatus.status === "failed") {
      setIsPolling(false);
      message.error(`Error en la importación: ${jobStatus.errorMessage || "desconocido"}`);
    }
  }, [jobStatus, message]);

  const makeUploadProps = (key: FileKey) => ({
    maxCount: 1,
    beforeUpload: (file: RcFile) => {
      if (file.size / 1024 / 1024 >= 50) {
        message.error("El archivo debe ser menor a 50MB");
        return Upload.LIST_IGNORE;
      }
      setFiles((prev) => ({ ...prev, [key]: file }));
      return false; // no auto-subida; se envía al pulsar Importar
    },
    onRemove: () => setFiles((prev) => ({ ...prev, [key]: undefined })),
    fileList: files[key] ? [files[key] as unknown as RcFile] : [],
  });

  const hasFiles = Boolean(files.acciones || files.alumnos || files.preinscripciones);

  const handleImport = async () => {
    const formData = new FormData();
    (Object.keys(FILE_LABELS) as FileKey[]).forEach((k) => {
      if (files[k]) formData.append(k, files[k] as File);
    });
    formData.append("createMissingCourses", String(createMissingCourses));
    try {
      const result = await uploadMutation.mutateAsync(formData);
      setCurrentJobId(result.jobId);
      setIsPolling(true);
      message.success("Importación iniciada...");
    } catch (error: unknown) {
      message.error(`Error subiendo ficheros: ${error instanceof Error ? error.message : "desconocido"}`);
    }
  };

  const handleReset = () => {
    setCurrentJobId(null);
    setIsPolling(false);
    setFiles({});
  };

  const statusColor = (s: string) =>
    s === "completed" ? "success" : s === "failed" ? "error" : s === "processing" ? "processing" : "default";
  const statusIcon = (s: string) =>
    s === "completed" ? <CheckCircleOutlined style={{ color: "#52c41a" }} />
      : s === "failed" ? <CloseCircleOutlined style={{ color: "#ff4d4f" }} />
        : s === "processing" ? <Spin size="small" />
          : <ExclamationCircleOutlined style={{ color: "#faad14" }} />;

  const summary = jobStatus?.resultSummary;

  return (
    <AuthzHide roles={[Role.ADMIN, Role.MANAGER]}>
      <div style={{ padding: 24 }}>
        <Space direction="vertical" size="large" style={{ width: "100%" }}>
          <Card>
            <Title level={2}>Importación INAEM</Title>
            <p style={{ color: "#666", marginBottom: 0 }}>
              Sube los ficheros del INAEM. Son todos opcionales; si subes varios, se procesan en orden:
              <b> Acciones → Preinscripciones → Alumnos</b>. Los cursos se casan por nº de expediente
              (etiqueta antes tus cursos existentes para no duplicarlos).
            </p>
          </Card>

          <Tabs
            defaultActiveKey="import"
            items={[
              {
                key: "import",
                label: "Importar",
                children: !currentJobId ? (
            <Card>
              <Space direction="vertical" size="large" style={{ width: "100%" }}>
                <Row gutter={[16, 16]}>
                  {(Object.keys(FILE_LABELS) as FileKey[]).map((key) => (
                    <Col xs={24} md={8} key={key}>
                      <Card size="small" title={FILE_LABELS[key]}>
                        <Upload {...makeUploadProps(key)}>
                          <Button icon={<UploadOutlined />}>Seleccionar fichero</Button>
                        </Upload>
                      </Card>
                    </Col>
                  ))}
                </Row>

                <Checkbox checked={createMissingCourses} onChange={(e) => setCreateMissingCourses(e.target.checked)}>
                  Crear acciones formativas inexistentes (curso provisional) cuando llegue un expediente sin curso
                </Checkbox>

                <Alert
                  type="info"
                  showIcon
                  message="Formato"
                  description="Acciones es un Excel (.xlsx); Alumnos y Preinscripciones son las exportaciones .xls del INAEM (tablas HTML). Tamaño máximo 50MB por fichero."
                />

                <Button
                  type="primary"
                  icon={<UploadOutlined />}
                  disabled={!hasFiles}
                  loading={uploadMutation.isPending}
                  onClick={handleImport}
                >
                  Importar
                </Button>
              </Space>
            </Card>
          ) : (
            <Card>
              <Space direction="vertical" size="large" style={{ width: "100%" }}>
                <div style={{ textAlign: "center" }}>
                  <Title level={4}>{statusIcon(jobStatus?.status || "")} Progreso de la importación</Title>
                  <Tag color={statusColor(jobStatus?.status || "")} style={{ fontSize: 14, padding: "4px 12px" }}>
                    {(jobStatus?.status || "").toUpperCase()}
                  </Tag>
                </div>
                <Progress
                  percent={jobStatus?.progress ?? 0}
                  status={jobStatus?.status === "failed" ? "exception" : jobStatus?.status === "completed" ? "success" : "active"}
                />
                <Row gutter={16}>
                  <Col span={12}>
                    <Statistic title="Filas procesadas" value={jobStatus?.processedRows ?? 0} suffix={`/ ${jobStatus?.totalRows ?? 0}`} />
                  </Col>
                  <Col span={12}>
                    <Statistic title="ID de trabajo" value={jobStatus?.jobId ?? ""} valueStyle={{ fontSize: 12 }} />
                  </Col>
                </Row>

                {jobStatus?.errorMessage && (
                  <Alert type="error" showIcon message="Error" description={jobStatus.errorMessage} />
                )}

                {summary && (
                  <Row gutter={[16, 16]}>
                    {([
                      ["Cursos nuevos", summary.coursesCreated, "#3f8600"],
                      ["Cursos actualizados", summary.coursesUpdated, "#1890ff"],
                      ["Usuarios nuevos", summary.usersCreated, "#3f8600"],
                      ["Usuarios actualizados", summary.usersUpdated, "#1890ff"],
                      ["Matrículas", summary.enrollments, "#13c2c2"],
                      ["Preinscripciones", summary.preinscriptions, "#722ed1"],
                      ["Conflictos", summary.conflicts, summary.conflicts > 0 ? "#fa541c" : "#3f8600"],
                      ["Filas fallidas", summary.failed, summary.failed > 0 ? "#cf1322" : "#3f8600"],
                    ] as [string, number, string][]).map(([title, value, color]) => (
                      <Col xs={12} md={6} key={title}>
                        <Card size="small">
                          <Statistic title={title} value={value} valueStyle={{ color }} />
                        </Card>
                      </Col>
                    ))}
                  </Row>
                )}

                {summary && summary.conflicts > 0 && (
                  <Alert
                    type="warning"
                    showIcon
                    message="Conflictos de sobrescritura"
                    description={`${summary.conflicts} usuario(s) ya existían con datos distintos. Revísalos en la API /api/import-inaem/conflicts para decidir si sobrescribir.`}
                  />
                )}

                <Space>
                  <Button icon={<ReloadOutlined />} onClick={() => refetch()}>Actualizar</Button>
                  {(jobStatus?.status === "completed" || jobStatus?.status === "failed") && (
                    <Button type="primary" onClick={handleReset}>Nueva importación</Button>
                  )}
                </Space>
              </Space>
            </Card>
                ),
              },
              {
                key: "conflicts",
                label: "Conflictos",
                children: <InaemConflicts />,
              },
            ]}
          />
        </Space>
      </div>
    </AuthzHide>
  );
};

export default InaemImport;
