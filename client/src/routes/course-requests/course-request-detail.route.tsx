import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { App, Alert, Button, Card, Col, Form, Input, Row, Select, Tag } from "antd";
import { DeleteOutlined, LockOutlined, SaveOutlined, UnlockOutlined } from "@ant-design/icons";
import { useCourseRequestQuery } from "../../hooks/api/course-requests/use-course-request.query";
import { useUpdateCourseRequestMutation } from "../../hooks/api/course-requests/use-update-course-request.mutation";
import { useSaveCourseRequestStudentsMutation } from "../../hooks/api/course-requests/use-save-course-request-students.mutation";
import { useUploadCourseRequestExcelMutation } from "../../hooks/api/course-requests/use-upload-course-request-excel.mutation";
import { useCloseCourseRequestMutation } from "../../hooks/api/course-requests/use-close-course-request.mutation";
import { useReopenCourseRequestMutation } from "../../hooks/api/course-requests/use-reopen-course-request.mutation";
import { useDeleteCourseRequestMutation } from "../../hooks/api/course-requests/use-delete-course-request.mutation";
import { useCompaniesQuery } from "../../hooks/api/companies/use-companies.query";
import { useCentersQuery } from "../../hooks/api/centers/use-centers.query";
import { useCoursesQuery } from "../../hooks/api/courses/use-courses.query";
import { CourseRequestStudentsGrid } from "../../components/course-requests/course-request-students-grid";
import { CourseRequestStatus } from "../../shared/types/course-request/course-request-status.enum";
import { RouteTabs } from "../../components/common/RouteTabs";
import { PageHeader } from "../../components/common/PageHeader";
import { AuthzHide } from "../../components/permissions/authz-hide";
import { Role } from "../../hooks/api/auth/use-login.mutation";
import { useRole } from "../../utils/permissions/use-role";

function getServerMessage(err: unknown): string {
  if (typeof err === "object" && err !== null) {
    const e = err as { response?: { data?: { message?: unknown } }; message?: unknown };
    const msg = e.response?.data?.message ?? e.message;
    if (typeof msg === "string") return msg;
    if (Array.isArray(msg)) return msg.join("; ");
    return String(msg ?? "Error en la petición");
  }
  return String(err ?? "Error en la petición");
}

export default function CourseRequestDetailRoute() {
  const navigate = useNavigate();
  const { id_request } = useParams();
  const role = useRole();
  const canEdit = [Role.ADMIN, Role.MANAGER].includes(role);
  const { message: messageApi, modal } = App.useApp();

  const { data, isLoading } = useCourseRequestQuery(id_request);
  const updateMutation = useUpdateCourseRequestMutation(Number(id_request));
  const saveStudentsMutation = useSaveCourseRequestStudentsMutation(Number(id_request));
  const uploadMutation = useUploadCourseRequestExcelMutation(Number(id_request));
  const closeMutation = useCloseCourseRequestMutation(Number(id_request));
  const reopenMutation = useReopenCourseRequestMutation(Number(id_request));
  const deleteMutation = useDeleteCourseRequestMutation(Number(id_request));

  const { data: companies } = useCompaniesQuery();
  const { data: centers } = useCentersQuery();
  const { data: courses } = useCoursesQuery();

  const [idCenter, setIdCenter] = useState<number | undefined>();
  const [idCourse, setIdCourse] = useState<number | undefined>();
  const [contactEmail, setContactEmail] = useState("");
  const [notes, setNotes] = useState("");

  const selectedCenter = useMemo(() => centers?.find((c) => c.id_center === idCenter), [centers, idCenter]);
  const companyName = useMemo(
    () => companies?.find((c) => c.id_company === selectedCenter?.id_company)?.company_name,
    [companies, selectedCenter],
  );

  useEffect(() => {
    if (!data) return;
    setIdCenter(data.id_center ?? undefined);
    setIdCourse(data.id_course);
    setContactEmail(data.contact_email ?? "");
    setNotes(data.notes ?? "");
  }, [data]);

  useEffect(() => {
    document.title = data ? `Petición #${data.id_request}` : "Petición";
  }, [data]);

  if (isLoading) return <div>Cargando...</div>;
  if (!data) return <div>Petición no encontrada</div>;

  const isClosed = data.status === CourseRequestStatus.CERRADA;
  const readOnly = !canEdit || isClosed;

  const handleSaveHeader = async () => {
    try {
      await updateMutation.mutateAsync({
        id_center: idCenter ?? null,
        id_course: idCourse,
        contact_email: contactEmail || null,
        notes: notes || null,
      });
      messageApi.success("Petición actualizada");
    } catch (err) {
      messageApi.error(getServerMessage(err));
    }
  };

  const handleClose = async () => {
    try {
      await closeMutation.mutateAsync();
      messageApi.success("Petición cerrada");
    } catch (err) {
      messageApi.error(getServerMessage(err));
    }
  };

  const handleReopen = async () => {
    try {
      await reopenMutation.mutateAsync();
      messageApi.success("Petición reabierta");
    } catch (err) {
      messageApi.error(getServerMessage(err));
    }
  };

  const handleDelete = () => {
    modal.confirm({
      title: "¿Eliminar esta petición?",
      content: "Se borrarán también todas sus filas de alumnos. Esta acción no se puede deshacer.",
      okText: "Eliminar",
      okType: "danger",
      cancelText: "Cancelar",
      onOk: async () => {
        try {
          await deleteMutation.mutateAsync();
          navigate("/course-requests");
        } catch (err) {
          messageApi.error(getServerMessage(err));
        }
      },
    });
  };

  const items = [
    {
      key: "datos",
      label: "Datos",
      children: (
        <Card>
          {!data.id_center && (
            <Alert type="warning" showIcon style={{ marginBottom: 16 }} message="Esta petición no tiene centro asignado." />
          )}
          {!data.contact_email && (
            <Alert type="warning" showIcon style={{ marginBottom: 16 }} message="Esta petición no tiene correo de contacto." />
          )}
          <Form layout="vertical">
            <Row gutter={16}>
              <Col xs={24} sm={12}>
                <Form.Item label="Centro">
                  <Select
                    allowClear
                    showSearch
                    disabled={readOnly}
                    value={idCenter}
                    onChange={setIdCenter}
                    optionFilterProp="label"
                    options={centers?.map((c) => ({
                      value: c.id_center,
                      label: `${c.center_name}${c.employer_number ? ` (${c.employer_number})` : ""}`,
                    }))}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item label="Empresa">
                  <Input readOnly disabled value={companyName ?? ""} placeholder="Se rellena al elegir el centro" />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item label="Curso solicitado">
              <Select
                showSearch
                disabled={readOnly}
                value={idCourse}
                onChange={setIdCourse}
                optionFilterProp="label"
                options={courses?.map((c) => ({ value: c.id_course, label: c.course_name }))}
              />
            </Form.Item>
            <Form.Item label="Correo de contacto del centro">
              <Input type="email" disabled={readOnly} value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
            </Form.Item>
            <Form.Item label="Notas">
              <Input.TextArea rows={3} disabled={readOnly} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Form.Item>
            <AuthzHide roles={[Role.ADMIN, Role.MANAGER]}>
              <div className="form-actions">
                {!isClosed && (
                  <Button type="primary" icon={<SaveOutlined />} loading={updateMutation.isPending} onClick={handleSaveHeader}>
                    Guardar
                  </Button>
                )}
                {isClosed ? (
                  <Button icon={<UnlockOutlined />} loading={reopenMutation.isPending} onClick={handleReopen}>
                    Reabrir petición
                  </Button>
                ) : (
                  <Button icon={<LockOutlined />} loading={closeMutation.isPending} onClick={handleClose}>
                    Cerrar petición
                  </Button>
                )}
                <Button danger icon={<DeleteOutlined />} onClick={handleDelete}>
                  Eliminar petición
                </Button>
              </div>
            </AuthzHide>
          </Form>
        </Card>
      ),
    },
    {
      key: "alumnos",
      label: `Alumnos (${data.students.length})`,
      children: (
        <Card>
          {isClosed && (
            <Alert type="info" showIcon style={{ marginBottom: 16 }} message="Petición cerrada: reábrela para editar los alumnos." />
          )}
          <CourseRequestStudentsGrid
            students={data.students}
            readOnly={readOnly}
            saving={saveStudentsMutation.isPending}
            uploading={uploadMutation.isPending}
            onSave={async (rows) => {
              try {
                await saveStudentsMutation.mutateAsync(rows);
                messageApi.success("Alumnos guardados");
              } catch (err) {
                messageApi.error(getServerMessage(err));
              }
            }}
            onUploadExcel={(file) => uploadMutation.mutateAsync(file)}
          />
        </Card>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title={<>Petición #{data.id_request} <Tag color={isClosed ? "default" : "processing"}>{data.status}</Tag></>}
        subtitle={data.course_name}
      />
      <RouteTabs items={items} />
    </>
  );
}
