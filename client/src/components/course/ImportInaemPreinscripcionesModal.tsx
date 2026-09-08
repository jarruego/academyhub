import { useEffect, useState } from "react";
import { Alert, App, Button, Checkbox, Col, Modal, Progress, Row, Space, Spin, Statistic, Tag, Typography, Upload, theme } from "antd";
import { CheckCircleOutlined, CloseCircleOutlined, ExclamationCircleOutlined, UploadOutlined } from "@ant-design/icons";
import type { RcFile } from "antd/es/upload";
import { STATUS_COLORS } from "../../theme/semantic-colors";
import { ConfirmPasswordModal } from "../common/ConfirmPasswordModal";
import { useVerifyPasswordMutation } from "../../hooks/api/auth/use-verify-password.mutation";
import { useInaemImportUpload, useInaemJobStatus } from "../../hooks/api/import-inaem/useInaemImport";

type Step = "pick" | "confirm" | "progress";

/**
 * Reconversión del antiguo "Importar Excel" de Candidatos: sube el fichero
 * oficial de Preinscripciones INAEM (mismo backend que /tools/import-inaem),
 * tras un aviso explícito y una reautenticación por contraseña. Quien no sea
 * ADMIN/MANAGER (solo tiene el permiso puntual `can_manage_candidates`) queda
 * acotado por el servidor al expediente de `courseId` — ver
 * `InaemImportController.upload` y docs/import-inaem.md.
 */
export function ImportInaemPreinscripcionesModal({ open, onClose, courseId, hasFullAccess }: {
  open: boolean;
  onClose: () => void;
  courseId: number;
  hasFullAccess: boolean;
}) {
  const { message } = App.useApp();
  const { token } = theme.useToken();
  const [step, setStep] = useState<Step>("pick");
  const [file, setFile] = useState<RcFile | null>(null);
  const [createMissingCourses, setCreateMissingCourses] = useState(true);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  const verifyPassword = useVerifyPasswordMutation();
  const uploadMutation = useInaemImportUpload();
  const { data: jobStatus, refetch } = useInaemJobStatus(jobId, {
    enabled: !!jobId && isPolling,
    refetchInterval: isPolling ? 2000 : false,
  });

  useEffect(() => {
    if (!jobStatus) return;
    if (jobStatus.status === "completed") {
      setIsPolling(false);
      message.success("Importación de Preinscripciones completada");
    } else if (jobStatus.status === "failed") {
      setIsPolling(false);
      message.error(`Error en la importación: ${jobStatus.errorMessage || "desconocido"}`);
    }
  }, [jobStatus, message]);

  const reset = () => {
    setStep("pick");
    setFile(null);
    setPasswordError(null);
    setJobId(null);
    setIsPolling(false);
  };
  const handleClose = () => { reset(); onClose(); };

  const handleConfirmPassword = async (password: string) => {
    setPasswordError(null);
    try {
      await verifyPassword.mutateAsync(password);
    } catch {
      setPasswordError("Contraseña incorrecta.");
      return;
    }
    if (!file) { setStep("pick"); return; }
    const formData = new FormData();
    formData.append("preinscripciones", file);
    formData.append("id_course", String(courseId));
    if (hasFullAccess) formData.append("createMissingCourses", String(createMissingCourses));
    try {
      const result = await uploadMutation.mutateAsync(formData);
      setJobId(result.jobId);
      setIsPolling(true);
      setStep("progress");
    } catch (error: unknown) {
      message.error(`No se pudo iniciar la importación: ${error instanceof Error ? error.message : "error desconocido"}`);
      setStep("pick");
    }
  };

  const statusColor = (s: string) =>
    s === "completed" ? STATUS_COLORS.active : s === "failed" ? STATUS_COLORS.inactive : s === "processing" ? STATUS_COLORS.processing : STATUS_COLORS.neutral;
  const statusIcon = (s: string) =>
    s === "completed" ? <CheckCircleOutlined style={{ color: token.colorSuccess }} />
      : s === "failed" ? <CloseCircleOutlined style={{ color: token.colorError }} />
        : s === "processing" ? <Spin size="small" />
          : <ExclamationCircleOutlined style={{ color: token.colorWarning }} />;

  const summary = jobStatus?.resultSummary;

  return <>
    <Modal
      title="Importar Preinscritos INAEM"
      open={open && step !== "confirm"}
      onCancel={handleClose}
      width={600}
      footer={step === "pick" ? [
        <Button key="cancel" onClick={handleClose}>Cancelar</Button>,
        <Button key="continue" type="primary" disabled={!file} onClick={() => setStep("confirm")}>Continuar</Button>,
      ] : [
        <Button key="close" type="primary" onClick={handleClose} disabled={isPolling}>Cerrar</Button>,
      ]}
      destroyOnClose
    >
      {step === "pick" && (
        <Space direction="vertical" size="middle" style={{ width: "100%" }}>
          <Alert
            type="warning"
            showIcon
            message="Esto va a marcar personas como preinscritas oficialmente en INAEM"
            description={
              <>
                Sube el fichero oficial de Preinscripciones del INAEM (.xls). Va a crear o actualizar la
                preinscripción oficial de cada persona que aparezca{hasFullAccess ? "" : " con el mismo Nº de Expediente que esta edición"},
                puede crear candidaturas nuevas{hasFullAccess ? ", e incluso ediciones provisionales si el expediente no existe todavía" : " en esta misma edición"},
                {" "}y {hasFullAccess
                  ? "puede afectar a cualquier edición cuyo expediente aparezca en el fichero, no solo esta"
                  : "queda acotado a esta edición: las filas de otro expediente se rechazan sin tocar ningún otro curso"}.
                No tiene un deshacer sencillo una vez importado.
              </>
            }
          />
          <Upload
            accept=".xls,.xlsx"
            maxCount={1}
            beforeUpload={(f) => {
              if (f.size / 1024 / 1024 >= 50) { message.error("El archivo debe ser menor a 50MB"); return Upload.LIST_IGNORE; }
              setFile(f);
              return false;
            }}
            onRemove={() => setFile(null)}
            fileList={file ? [file] : []}
          >
            <Button icon={<UploadOutlined />}>Seleccionar fichero de Preinscripciones</Button>
          </Upload>
          {hasFullAccess && (
            <Checkbox checked={createMissingCourses} onChange={(e) => setCreateMissingCourses(e.target.checked)}>
              Crear acciones formativas inexistentes (curso provisional) cuando llegue un expediente sin curso
            </Checkbox>
          )}
        </Space>
      )}
      {step === "progress" && (
        <Space direction="vertical" size="large" style={{ width: "100%" }}>
          <div style={{ textAlign: "center" }}>
            <Typography.Title level={5}>{statusIcon(jobStatus?.status || "")} Progreso de la importación</Typography.Title>
            <Tag color={statusColor(jobStatus?.status || "")} style={{ fontSize: 14, padding: "4px 12px" }}>
              {(jobStatus?.status || "").toUpperCase()}
            </Tag>
          </div>
          <Progress
            percent={jobStatus?.progress ?? 0}
            status={jobStatus?.status === "failed" ? "exception" : jobStatus?.status === "completed" ? "success" : "active"}
          />
          <Statistic title="Filas procesadas" value={jobStatus?.processedRows ?? 0} suffix={`/ ${jobStatus?.totalRows ?? 0}`} />

          {jobStatus?.errorMessage && (
            <Alert type="error" showIcon message="Error" description={jobStatus.errorMessage} />
          )}

          {summary && (
            <Row gutter={[16, 16]}>
              {([
                ["Preinscripciones", summary.preinscriptions, token.colorSuccess],
                ["Cursos nuevos", summary.coursesCreated, token.colorPrimary],
                ["Conflictos", summary.conflicts, summary.conflicts > 0 ? token.colorWarning : token.colorSuccess],
                ["Filas fallidas", summary.failed, summary.failed > 0 ? token.colorError : token.colorSuccess],
              ] as [string, number, string][]).map(([title, value, color]) => (
                <Col xs={12} key={title}>
                  <Statistic title={title} value={value} valueStyle={{ color }} />
                </Col>
              ))}
            </Row>
          )}

          <Button onClick={() => refetch()}>Actualizar estado</Button>
        </Space>
      )}
    </Modal>
    <ConfirmPasswordModal
      open={open && step === "confirm"}
      title="Confirma tu contraseña"
      description="Vas a importar Preinscripciones INAEM. Introduce tu contraseña para confirmarlo."
      confirmLoading={verifyPassword.isPending || uploadMutation.isPending}
      error={passwordError}
      onConfirm={handleConfirmPassword}
      onCancel={() => setStep("pick")}
    />
  </>;
}
