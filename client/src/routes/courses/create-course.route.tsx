import { useCreateCourseMutation } from "../../hooks/api/courses/use-create-course.mutation";
import { Button, DatePicker, Form, Input, Select, message, Checkbox } from "antd";
import { useForm, Controller, SubmitHandler } from "react-hook-form";
import { Course } from "../../shared/types/course/course";
import { CourseModality } from "../../shared/types/course/course-modality.enum";
import { useNavigate } from "react-router-dom";
import { SaveOutlined, ReloadOutlined } from "@ant-design/icons";
import { useEffect } from "react";
import dayjs from "dayjs";

export default function CreateCourseRoute() {
  const { mutateAsync: createCourse } = useCreateCourseMutation();
  const { handleSubmit, control } = useForm<Course>({
    defaultValues: {
      active: false,
    },
  });
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "Crear Curso";
  }, []);

  const submit: SubmitHandler<Course> = async (info) => {
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
    } catch {
      message.error('No se pudo guardar el formulario. Inténtalo de nuevo.');
      message.warning('Revisa los campos del formulario. Puede que falte algún dato obligatorio o el formato no sea correcto.');
    }
  }

  return (
    <div>
      <Form layout="vertical" onFinish={handleSubmit(submit)}>
        <div style={{ display: 'flex', gap: '16px', justifyContent: 'flex-start' }}>
          <Form.Item label="ID Moodle" name="moodle_id">
            <Controller name="moodle_id" control={control} render={({ field }) => <Input {...field} id="moodle_id" disabled />} />
          </Form.Item>
        </div>
        <div style={{ display: 'flex', gap: '16px' }}>
          <Form.Item label="Nombre del curso" name="course_name" style={{ flex: 2 }} required={true}>
            <Controller name="course_name" control={control} render={({ field }) => <Input {...field} id="course_name" />} />
          </Form.Item>
          <Form.Item label="Nombre corto" name="short_name" style={{ flex: 1 }} required={true}>
            <Controller name="short_name" control={control} render={({ field }) => <Input {...field} id="short_name" />} />
          </Form.Item>
        </div>
        <div style={{ display: 'flex', gap: '16px', justifyContent: 'flex-start' }}>
          <Form.Item label="Fecha Inicio" name="start_date">
            <Controller name="start_date" control={control} render={({ field }) => <DatePicker {...field} id="start_date" />} />
          </Form.Item>
          <Form.Item label="Fecha Fin" name="end_date">
            <Controller name="end_date" control={control} render={({ field }) => <DatePicker {...field} id="end_date" />} />
          </Form.Item>
          <Form.Item label="Modalidad" name="modality" required={true}>
            <Controller
              name="modality"
              control={control}
              render={({ field }) => (
                <Select {...field} id="modality">
                  {Object.values(CourseModality).map((modality) => (
                    <Select.Option key={modality} value={modality}>
                      {modality}
                    </Select.Option>
                  ))}
                </Select>
              )}
            />
          </Form.Item>
          <Form.Item label="Horas" name="hours">
            <Controller
              name="hours"
              control={control}
              render={({ field }) => <Input type="number" min={0} {...field} id="hours" style={{ width: 80 }} />}
            />
          </Form.Item>
          <Form.Item label="Precio/hora" name="price_per_hour">
            <Controller
              name="price_per_hour"
              control={control}
              render={({ field }) => <Input type="number" min={0} step="0.01" {...field} id="price_per_hour" style={{ width: 100 }} />}
            />
          </Form.Item>
          <Form.Item label="FUNDAE ID" name="fundae_id">
            <Controller
              name="fundae_id"
              control={control}
              render={({ field }) => <Input {...field} id="fundae_id" style={{ width: 120 }} />}
            />
          </Form.Item>
          <Form.Item label="Activo" name="active" valuePropName="checked">
            <Controller
              name="active"
              control={control}
              render={({ field }) => (
                <Checkbox
                  {...field}
                  checked={!!field.value}
                >
                  {""}
                </Checkbox>
              )}
            />
          </Form.Item>
        </div>
        <Form.Item>
          <Button type="primary" htmlType="submit" icon={<SaveOutlined />}>Guardar</Button>
          <Button icon={<ReloadOutlined />} onClick={() => window.location.reload()} style={{ marginLeft: '16px' }}>
            Refrescar
          </Button>
        </Form.Item>
      </Form>
    </div>
  );
}
