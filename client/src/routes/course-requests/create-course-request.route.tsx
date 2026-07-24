import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { App, Alert, Button, Card, Col, DatePicker, Form, Input, Row, Select } from "antd";
import { SaveOutlined } from "@ant-design/icons";
import dayjs, { Dayjs } from "dayjs";
import { useCompaniesQuery } from "../../hooks/api/companies/use-companies.query";
import { useCentersQuery } from "../../hooks/api/centers/use-centers.query";
import { useCoursesQuery } from "../../hooks/api/courses/use-courses.query";
import { useCreateCourseRequestMutation } from "../../hooks/api/course-requests/use-create-course-request.mutation";
import { PageHeader } from "../../components/common/PageHeader";

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

export default function CreateCourseRequestRoute() {
  const navigate = useNavigate();
  const { message: messageApi } = App.useApp();
  const { data: companies } = useCompaniesQuery();
  const { data: centers } = useCentersQuery();
  const { data: courses } = useCoursesQuery();
  const { mutateAsync: createRequest, isPending } = useCreateCourseRequestMutation();

  const [idCenter, setIdCenter] = useState<number | undefined>();
  const [idCourse, setIdCourse] = useState<number | undefined>();
  const [requestDate, setRequestDate] = useState<Dayjs>(dayjs());
  const [contactEmail, setContactEmail] = useState("");
  const [notes, setNotes] = useState("");

  const selectedCenter = useMemo(() => centers?.find((c) => c.id_center === idCenter), [centers, idCenter]);
  const companyName = useMemo(
    () => companies?.find((c) => c.id_company === selectedCenter?.id_company)?.company_name,
    [companies, selectedCenter],
  );

  // Al elegir centro, prellena el correo de contacto con el del centro (si aún no se ha escrito nada).
  useEffect(() => {
    if (selectedCenter?.contact_email && !contactEmail) setContactEmail(selectedCenter.contact_email);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idCenter]);

  const handleSubmit = async () => {
    if (!idCourse) {
      messageApi.error("Selecciona un curso");
      return;
    }
    try {
      const created = await createRequest({
        id_center: idCenter,
        id_course: idCourse,
        request_date: requestDate.format("YYYY-MM-DD"),
        contact_email: contactEmail || undefined,
        notes: notes || undefined,
      });
      messageApi.success("Petición creada");
      navigate(`/course-requests/${created.id_request}`);
    } catch (err) {
      messageApi.error(getServerMessage(err));
    }
  };

  return (
    <>
      <PageHeader title="Nueva petición de centro" />
      <Card style={{ maxWidth: 720 }}>
        {!idCenter && (
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
            message="Lo normal es indicar un centro. Puedes continuar sin él, pero revísalo antes de cerrar la petición."
          />
        )}
        <Form layout="vertical">
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item label="Centro">
                <Select
                  allowClear
                  showSearch
                  placeholder="Busca un centro"
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
          <Row gutter={16}>
            <Col xs={24} sm={16}>
              <Form.Item label="Curso solicitado" required>
                <Select
                  showSearch
                  placeholder="Selecciona un curso"
                  value={idCourse}
                  onChange={setIdCourse}
                  optionFilterProp="label"
                  options={courses?.map((c) => ({ value: c.id_course, label: c.course_name }))}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item label="Fecha de la petición">
                <DatePicker
                  style={{ width: "100%" }}
                  format="DD/MM/YYYY"
                  value={requestDate}
                  onChange={(value) => setRequestDate(value ?? dayjs())}
                  allowClear={false}
                />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="Correo de contacto del centro">
            <Input
              type="email"
              placeholder="contacto@centro.com"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
            />
          </Form.Item>
          <Form.Item label="Notas">
            <Input.TextArea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Form.Item>
          <div className="form-actions">
            <Button onClick={() => navigate(-1)}>Cancelar</Button>
            <Button type="primary" icon={<SaveOutlined />} loading={isPending} onClick={handleSubmit}>
              Crear petición
            </Button>
          </div>
        </Form>
      </Card>
    </>
  );
}
