import { useCreateCourseMutation } from "../../hooks/api/courses/use-create-course.mutation";
import { App, Button, DatePicker, Form, Input, Select, Row, Col } from "antd";
import { useForm, Controller, SubmitHandler } from "react-hook-form";
import { CourseModality } from "../../shared/types/course/course-modality.enum";
import { CourseOrigin } from "../../shared/types/course/course-origin.enum";
import { CourseFunding } from "../../shared/types/course/course-funding.enum";
import { useNavigate } from "react-router-dom";
import { SaveOutlined, ReloadOutlined } from "@ant-design/icons";
import { useEffect } from "react";
import dayjs from "dayjs";
import z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { AuthzHide } from "../../components/permissions/authz-hide";
import { Role } from "../../hooks/api/auth/use-login.mutation";

const CREATE_COURSE_FORM = z.object({
  course_name: z.string({ required_error: "El nombre del curso es obligatorio" }).min(2, "El nombre es demasiado corto"),
  short_name: z.string({ required_error: "El nombre corto es obligatorio" }).min(2, "El nombre corto es demasiado corto"),
  start_date: z.date().nullable().optional(),
  end_date: z.date().nullable().optional(),
  modality: z.nativeEnum(CourseModality, { required_error: "La modalidad es obligatoria" }),
  hours: z.coerce.number().optional(),
  price_per_hour: z.coerce.number().optional(),
  fundae_id: z.string().optional(),
  file_number: z.string().optional(),
  origin: z.nativeEnum(CourseOrigin).optional(),
  funding: z.nativeEnum(CourseFunding).optional(),
  moodle_id: z.coerce.number().optional(),
  category: z.string().optional(),
});

export default function CreateCourseRoute() {
  const { message } = App.useApp();
  const { mutateAsync: createCourse } = useCreateCourseMutation();
  const { handleSubmit, control, watch, formState: { errors } } = useForm<z.infer<typeof CREATE_COURSE_FORM>>({
    resolver: zodResolver(CREATE_COURSE_FORM),
  });
  const navigate = useNavigate();
  // Visibilidad condicional: Nº Expediente solo para INAEM; FUNDAE ID solo para
  // financiación FUNDAE.
  const originValue = watch('origin');
  const fundingValue = watch('funding');
  const showFileNumber = originValue === CourseOrigin.INAEM;
  const showFundaeId = fundingValue === CourseFunding.FUNDAE;

  useEffect(() => {
    document.title = "Crear Curso";
  }, []);

  const submit: SubmitHandler<z.infer<typeof CREATE_COURSE_FORM>> = async (info) => {
    const data = {
      ...info,
      hours: info.hours !== undefined && info.hours !== null ? Number(info.hours) : 0,
      price_per_hour: info.price_per_hour !== undefined && info.price_per_hour !== null ? Number(info.price_per_hour) : 0,
    };
    try {      
      await createCourse({
        ...data,
        start_date: data.start_date ? dayjs(data.start_date).utc().toDate() : null,
        end_date: data.end_date ? dayjs(data.end_date).utc().toDate() : null,
      });
      navigate('/courses');
    } catch (error) {
      const apiMessage = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
      if (apiMessage) {
        message.error(apiMessage);
      } else {
        message.error('No se pudo guardar el formulario. Inténtalo de nuevo.');
        message.warning('Revisa los campos del formulario. Puede que falte algún dato obligatorio o el formato no sea correcto.');
      }
    }
  }

  return (
    <div>
      <Form layout="vertical" onFinish={handleSubmit(submit)}>
        <Row gutter={[16, 0]}>
          <Col xs={24} sm={8} md={6}>
            <Form.Item label="ID Moodle" name="moodle_id">
              <Controller name="moodle_id" control={control} render={({ field }) => <Input {...field} id="moodle_id" autoComplete="off" disabled data-testid="moodle-id" />} />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={[16, 0]}>
          <Col xs={24} md={16}>
            <Form.Item
              label="Nombre del curso"
              name="course_name"
              required={true}
              help={errors.course_name?.message}
              validateStatus={errors.course_name ? "error" : undefined}
            >
              <Controller name="course_name" control={control} render={({ field }) => <Input {...field} id="course_name" autoComplete="off" data-testid="course-name" />} />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item
              label="Nombre corto"
              name="short_name"
              required={true}
              help={errors.short_name?.message}
              validateStatus={errors.short_name ? "error" : undefined}
            >
              <Controller name="short_name" control={control} render={({ field }) => <Input {...field} id="short_name" autoComplete="off" data-testid="short-name" />} />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={[16, 0]}>
          <Col xs={24} sm={12} md={6}>
            <Form.Item
              label="Fecha Inicio"
              name="start_date"
              help={errors.start_date?.message}
              validateStatus={errors.start_date ? "error" : undefined}
            >
              <Controller
                name="start_date"
                control={control}
                render={({ field }) => (
                  <DatePicker
                    {...field}
                    value={field.value ? dayjs(field.value) : null}
                    onChange={(date) => field.onChange(date ? date.toDate() : null)}
                    id="start_date"
                    data-testid="start-date"
                    style={{ width: '100%' }}
                  />
                )}
              />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Form.Item
              label="Fecha Fin"
              name="end_date"
              help={errors.end_date?.message}
              validateStatus={errors.end_date ? "error" : undefined}
            >
              <Controller
                name="end_date"
                control={control}
                render={({ field }) => (
                  <DatePicker
                    {...field}
                    value={field.value ? dayjs(field.value) : null}
                    onChange={(date) => field.onChange(date ? date.toDate() : null)}
                    id="end_date"
                    data-testid="end-date"
                    style={{ width: '100%' }}
                  />
                )}
              />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Form.Item
              label="Modalidad"
              name="modality"
              required={true}
              help={errors.modality?.message}
              validateStatus={errors.modality ? "error" : undefined}
            >
              <Controller
                name="modality"
                control={control}
                render={({ field }) => (
                  <Select {...field} id="modality" data-testid="modality" style={{ width: '100%' }}>
                    {Object.values(CourseModality).map((modality) => (
                      <Select.Option key={modality} value={modality} data-testid={`modality-option-${modality}`}>
                        {modality}
                      </Select.Option>
                    ))}
                  </Select>
                )}
              />
            </Form.Item>
          </Col>
          <Col xs={12} sm={6} md={3}>
            <Form.Item
              label="Horas"
              name="hours"
              help={errors.hours?.message}
              validateStatus={errors.hours ? "error" : undefined}
            >
              <Controller
                name="hours"
                control={control}
                render={({ field }) => <Input type="number" min={0} {...field} id="hours" autoComplete="off" style={{ width: '100%' }} />}
              />
            </Form.Item>
          </Col>
          <Col xs={12} sm={6} md={3}>
            <Form.Item
              label="Precio/hora"
              name="price_per_hour"
              help={errors.price_per_hour?.message}
              validateStatus={errors.price_per_hour ? "error" : undefined}
            >
              <Controller
                name="price_per_hour"
                control={control}
                render={({ field }) => <Input type="number" min={0} step="0.01" {...field} id="price_per_hour" autoComplete="off" style={{ width: '100%' }} />}
              />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={[16, 0]}>
          <Col xs={24} sm={12} md={6}>
            <Form.Item label="Origen" name="origin">
              <Controller
                name="origin"
                control={control}
                render={({ field }) => (
                  <Select {...field} id="origin" allowClear placeholder="Sin clasificar" style={{ width: '100%' }}>
                    {Object.values(CourseOrigin).map((origin) => (
                      <Select.Option key={origin} value={origin}>{origin}</Select.Option>
                    ))}
                  </Select>
                )}
              />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Form.Item label="Financiación" name="funding">
              <Controller
                name="funding"
                control={control}
                render={({ field }) => (
                  <Select {...field} id="funding" allowClear placeholder="Sin clasificar" style={{ width: '100%' }}>
                    {Object.values(CourseFunding).map((funding) => (
                      <Select.Option key={funding} value={funding}>{funding}</Select.Option>
                    ))}
                  </Select>
                )}
              />
            </Form.Item>
          </Col>
          {showFileNumber && (
            <Col xs={24} sm={12} md={6}>
              <Form.Item label="Nº Expediente (INAEM)" name="file_number">
                <Controller
                  name="file_number"
                  control={control}
                  render={({ field }) => <Input {...field} id="file_number" autoComplete="off" placeholder="25/0202.001" />}
                />
              </Form.Item>
            </Col>
          )}
          {showFundaeId && (
            <Col xs={24} sm={12} md={6}>
              <Form.Item
                label="FUNDAE ID"
                name="fundae_id"
                help={errors.fundae_id?.message}
                validateStatus={errors.fundae_id ? "error" : undefined}
              >
                <Controller
                  name="fundae_id"
                  control={control}
                  render={({ field }) => <Input {...field} id="fundae_id" autoComplete="off" />}
                />
              </Form.Item>
            </Col>
          )}
        </Row>
        <div className="form-actions">
          <AuthzHide roles={[Role.ADMIN]}>
          <Button type="primary" htmlType="submit" icon={<SaveOutlined />}>Guardar</Button>
          </AuthzHide>
          <Button icon={<ReloadOutlined />} onClick={() => window.location.reload()}>
            Refrescar
          </Button>
        </div>
      </Form>
    </div>
  );
}
