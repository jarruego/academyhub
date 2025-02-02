import { useCreateCourseMutation } from "../hooks/api/courses/use-create-course.mutation";
import { Button, DatePicker, Form, Input, Select, message } from "antd";
import { useForm, Controller, SubmitHandler } from "react-hook-form";
import { Course } from "../shared/types/course/course";
import { CourseModality } from "../shared/types/course/course-modality.enum";
import { useNavigate } from "react-router-dom";

export default function CreateCourseRoute() {
  const { mutateAsync: createCourse } = useCreateCourseMutation();
  const { handleSubmit, control } = useForm<Course>();
  const navigate = useNavigate();

  const submit: SubmitHandler<Course> = async (info) => {
    try {
      await createCourse(info);
      navigate('/courses');
    } catch {
      message.error('No se pudo guardar el formulario. Inténtalo de nuevo.');
    }
  }

  return (
    <div>
      <Form layout="vertical" onFinish={handleSubmit(submit)}>
        <Form.Item label="Nombre del curso" name="course_name" required={true}>
          <Controller name="course_name" control={control} render={({ field }) => <Input {...field} />} />
        </Form.Item>
        <Form.Item label="Nombre corto" name="short_name" required={true}>
          <Controller name="short_name" control={control} render={({ field }) => <Input {...field} />} />
        </Form.Item>
        <div style={{ display: 'flex', gap: '16px' }}>
        <Form.Item label="Fecha Inicio" name="start_date">
          <Controller name="start_date" control={control} render={({ field }) => <DatePicker {...field} />} />
        </Form.Item>
        <Form.Item label="Fecha Fin" name="end_date">
          <Controller name="end_date" control={control} render={({ field }) => <DatePicker {...field} />} />
        </Form.Item>
        <Form.Item label="Modalidad" name="modality" required={true}>
          <Controller
            name="modality"
            control={control}
            render={({ field }) => (
              <Select {...field}>
                {Object.values(CourseModality).map((modality) => (
                  <Select.Option key={modality} value={modality}>
                    {modality}
                  </Select.Option>
                ))}
              </Select>
            )}
          />          
        </Form.Item>
        </div>
        <Form.Item>
          <Button type="primary" htmlType="submit">Guardar</Button>
        </Form.Item>
      </Form>
    </div>
  );
}
