import { useParams } from "react-router-dom";
import { useCourseQuery } from "../../hooks/api/courses/use-course.query";
import { useGroupsQuery } from "../../hooks/api/groups/use-groups.query";
import { useUpdateCourseMutation } from "../../hooks/api/courses/use-update-course.mutation";
import { Button, DatePicker, Form, Input, Table, Select, message, Checkbox } from "antd";
import { DeleteOutlined, SaveOutlined, TeamOutlined } from "@ant-design/icons";
import { useForm, Controller, SubmitHandler } from "react-hook-form";
import { useState, useEffect } from "react";
import { useUsersByGroupQuery } from "../../hooks/api/users/use-users-by-group.query";
import { Course } from "../../shared/types/course/course";
import { CourseModality } from "../../shared/types/course/course-modality.enum";
import { useDeleteCourseMutation } from "../../hooks/api/courses/use-delete-course.mutation";
import { useNavigate } from "react-router-dom";
import { USERS_TABLE_COLUMNS } from "../../constants/tables/users-table-columns.constant";
import dayjs from "dayjs";

export default function CourseDetailRoute() {
  const navigate = useNavigate();
  const { id_course } = useParams();
  const { data: courseData, isLoading: isCourseLoading } = useCourseQuery(id_course || "");
  const { data: groupsData, isLoading: isGroupsLoading } = useGroupsQuery(id_course || "");
  const { mutateAsync: updateCourse } = useUpdateCourseMutation(id_course || "");
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const { data: usersData, isLoading: isUsersLoading } = useUsersByGroupQuery(selectedGroupId);
  const { mutateAsync: deleteCourse } = useDeleteCourseMutation(id_course || "");
  const [selectedRowKeys, setSelectedRowKeys] = useState<number[]>([]);

  const { handleSubmit, control, reset } = useForm<Course>();

  useEffect(() => {
    if (courseData) {
      reset({
        ...courseData,
        start_date: courseData.start_date ? (dayjs.isDayjs(courseData.start_date) ? courseData.start_date.toDate() : courseData.start_date) : null,
        end_date: courseData.end_date ? (dayjs.isDayjs(courseData.end_date) ? courseData.end_date.toDate() : courseData.end_date) : null,
      });
    }
  }, [courseData, reset]);

  useEffect(() => {
    if (groupsData && groupsData.length > 0) {
      setSelectedGroupId(groupsData[0].id_group);
    }
  }, [groupsData]);

  useEffect(() => {
    document.title = `Detalle del Curso ${id_course}`;
  }, [id_course]);

  if (!courseData) return <div>Curso no encontrado</div>;
  if (isCourseLoading || isGroupsLoading) return <div>Cargando...</div>;

  const submit: SubmitHandler<Course> = async (info) => {
    const data = {
      ...info,
      hours: info.hours !== undefined && info.hours !== null ? Number(info.hours) : 0,
      price_per_hour: info.price_per_hour !== undefined && info.price_per_hour !== null ? Number(info.price_per_hour) : 0,
    };
    await updateCourse({
      ...data,
      start_date: data.start_date ? dayjs(data.start_date).utc().toDate() : null,
      end_date: data.end_date ? dayjs(data.end_date).utc().toDate() : null,
    });
    navigate(-1);
  }

  const handleDelete = async () => {
    try {
      await deleteCourse();
      navigate('/courses');
    } catch {
      message.error('No se pudo eliminar el curso. Recuerde que debe de estar vacío');
    }
  };

  const handleAddGroup = () => {
    navigate(`/courses/${id_course}/add-group`);
  };

  const handleRowClick = (record: { id_group: number }) => {
    setSelectedGroupId(record.id_group);
    setSelectedRowKeys([record.id_group]);
  };

  return (
    <div>
      <Form layout="vertical" onFinish={handleSubmit(submit)}>
        <div style={{ display: 'flex', gap: '16px', justifyContent: 'flex-start' }}>
          <Form.Item label="ID" name="id_course">
            <Controller name="id_course" control={control} render={({ field }) => <Input {...field} id="id_course" disabled />} />
          </Form.Item>
          <Form.Item label="ID Moodle" name="moodle_id">
            <Controller name="moodle_id" control={control} render={({ field }) => <Input {...field} id="moodle_id" disabled />} />
          </Form.Item>
        </div>
        <div style={{ display: 'flex', gap: '16px' }}>
          <Form.Item label="Nombre del curso" name="course_name" style={{ flex: 2 }}>
            <Controller name="course_name" control={control} render={({ field }) => <Input {...field} id="course_name" />} />
          </Form.Item>
          <Form.Item label="Nombre corto" name="short_name" style={{ flex: 1 }}>
            <Controller name="short_name" control={control} render={({ field }) => <Input {...field} id="short_name" />} />
          </Form.Item>
        </div>
        <div style={{ display: 'flex', gap: '16px', justifyContent: 'flex-start' }}>
          <Form.Item label="Fecha Inicio" name="start_date">
            <Controller
              name="start_date"
              control={control}
              render={({ field }) => (
                <DatePicker
                  {...field}
                  value={field.value ? dayjs(field.value) : null}
                  onChange={date => field.onChange(date.startOf("day"))}
                  id="start_date"
                />
              )}
            />
          </Form.Item>
          <Form.Item label="Fecha Fin" name="end_date">
            <Controller
              name="end_date"
              control={control}
              render={({ field }) => (
                <DatePicker
                  {...field}
                  value={field.value ? dayjs(field.value) : null}
                  onChange={date => field.onChange(date.startOf("day"))}
                  id="end_date"
                />
              )}
            />
          </Form.Item>
          <Form.Item label="Modalidad" name="modality">
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
        <div style={{ display: 'flex', gap: '16px' }}>
          <Table
            title={() => <h3>Grupos del Curso</h3>}
            rowKey="id_group"
            columns={[
              { title: 'ID', dataIndex: 'id_group' },
              { title: 'MOODLE ID', dataIndex: 'moodle_id' },
              { title: 'Nombre del grupo', dataIndex: 'group_name' },
              { title: 'Descripción', dataIndex: 'description' },
            ]}
            footer={() => <Button type="default" icon={<TeamOutlined />} onClick={handleAddGroup}>Añadir Grupo al Curso</Button>}
            dataSource={groupsData}
            loading={isGroupsLoading}
            rowSelection={{
              type: 'radio',
              selectedRowKeys,
              onChange: (selectedRowKeys) => setSelectedRowKeys(selectedRowKeys as number[]),
              renderCell: () => null, // Ocultar el radiobutton
            }}
            onRow={(record) => ({
              onClick: () => handleRowClick(record),
              onDoubleClick: () => navigate(`/groups/${record.id_group}/edit`),
              style: { cursor: 'pointer' }
            })}
          />
          <Table
            title={() => <h3>Usuarios del Grupo</h3>}
            rowKey="id_user"
            columns={[
              ...USERS_TABLE_COLUMNS,
              {
                title: 'Extra'
              },
            ]}
            dataSource={usersData}
            loading={isUsersLoading}
            onRow={(record) => ({
              onDoubleClick: () => navigate(`/users/${record.id_user}`, { state: { from: location.pathname } }),
              style: { cursor: 'pointer' }
            })}
          />
        </div>
        <div style={{ display: 'flex', gap: '16px' }}>
          <Button type="default" onClick={() => navigate(-1)}>Cancelar</Button>
          <Button type="primary" icon={<SaveOutlined />} htmlType="submit">Guardar</Button>
          <Button icon={<DeleteOutlined />} type="primary" danger onClick={handleDelete}>Eliminar Curso</Button>
        </div>
      </Form>
    </div>
  );
}
