import { useParams } from "react-router-dom";
import { useCourseQuery } from "../../hooks/api/courses/use-course.query";
import { useGroupsQuery } from "../../hooks/api/groups/use-groups.query";
import { useUpdateCourseMutation } from "../../hooks/api/courses/use-update-course.mutation";
import { Button, DatePicker, Form, Input, Table, Select, Checkbox, Modal, App } from "antd";
import { DeleteOutlined, SaveOutlined, TeamOutlined } from "@ant-design/icons";
import { useForm, Controller, SubmitHandler } from "react-hook-form";
import { useState, useEffect, useMemo } from "react";
import { useUsersByGroupQuery } from "../../hooks/api/users/use-users-by-group.query";
import { CourseModality } from "../../shared/types/course/course-modality.enum";
import { useDeleteCourseMutation } from "../../hooks/api/courses/use-delete-course.mutation";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import GroupUsersManager from '../../components/group/GroupUsersManager';
import UserDetail from "../../components/user/user-detail";
import { AuthzHide } from "../../components/permissions/authz-hide";
import { Role } from "../../hooks/api/auth/use-login.mutation";
import { useRole } from "../../utils/permissions/use-role";

const COURSE_DETAIL_FORM_SCHEMA = z.object({
  id_course: z.number(),
  course_name: z.string({ required_error: "El nombre del curso es obligatorio" }).min(2, "El nombre es demasiado corto"),
  short_name: z.string({ required_error: "El nombre corto es obligatorio" }).min(2, "El nombre corto es demasiado corto"),
  start_date: z.date().nullable().optional().nullish(),
  end_date: z.date().nullable().optional().nullish(),
  modality: z.nativeEnum(CourseModality, { required_error: "La modalidad es obligatoria" }),
  hours: z.coerce.number().min(0, "Las horas deben ser un número positivo").optional().nullish(),
  price_per_hour: z.coerce.number().min(0, "El precio/hora debe ser un número positivo").optional().nullish(),
  fundae_id: z.string().optional().nullish(),
  active: z.boolean().optional().nullish(),
  moodle_id: z.number().optional().nullish(),
  category: z.string().optional().nullish(),
});

export default function CourseDetailRoute() {
  const { message } = App.useApp();
  const role = useRole();
  const canEdit = [Role.ADMIN, Role.MANAGER].includes(role);
  const preventReadOnlyClick = (e: React.MouseEvent<HTMLElement>) => {
    if (!canEdit) {
      e.preventDefault();
      e.stopPropagation();
    }
  };
  const navigate = useNavigate();
  const { id_course } = useParams();
  const { data: courseData, isLoading: isCourseLoading } = useCourseQuery(id_course || "");
  const { data: groupsData, isLoading: isGroupsLoading } = useGroupsQuery(id_course || "");
  // Keep groups sorted by group_name for consistent display
  const sortedGroups = useMemo(() => {
    const list = groupsData ?? [];
    // Sort by end_date descending (latest end_date first).
    // If end_date is missing/null, place those groups at the end.
    return [...list].sort((a, b) => {
      const toMillis = (d: string | Date | null | undefined) => {
        if (!d) return Number.NEGATIVE_INFINITY; // treat missing dates as smallest so they appear last when sorting desc
        const t = (d instanceof Date) ? d.getTime() : Date.parse(String(d));
        return Number.isFinite(t) ? t : Number.NEGATIVE_INFINITY;
      };
      const aTime = toMillis(a?.end_date);
      const bTime = toMillis(b?.end_date);
      // Descending: later dates first
      return bTime - aTime;
    });
  }, [groupsData]);
  const { mutateAsync: updateCourse } = useUpdateCourseMutation(id_course || "");
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const { refetch: refetchUsersByGroup } = useUsersByGroupQuery(selectedGroupId);
  const { mutateAsync: deleteCourse } = useDeleteCourseMutation(id_course || "");
  const [selectedRowKeys, setSelectedRowKeys] = useState<number[]>([]);
  const [modal, contextHolder] = Modal.useModal();
  const [userToLookup, setUserToLookup] = useState<number | null>(null);

  // Provide explicit defaultValues so controlled inputs are never undefined on first render
  const defaultModality = Object.values(CourseModality)[0] as CourseModality;
  const { handleSubmit, control, reset, formState: { errors } } = useForm<z.infer<typeof COURSE_DETAIL_FORM_SCHEMA>>({
    resolver: zodResolver(COURSE_DETAIL_FORM_SCHEMA),
    defaultValues: {
      id_course: id_course ? Number(id_course) : 0,
      course_name: '',
      short_name: '',
      start_date: null,
      end_date: null,
      modality: defaultModality,
      hours: null,
      price_per_hour: null,
      fundae_id: '',
      active: false,
      moodle_id: null,
      category: '',
    },
  });

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
    if (sortedGroups && sortedGroups.length > 0) {
      setSelectedGroupId(sortedGroups[0].id_group);
      setSelectedRowKeys([sortedGroups[0].id_group]);
    }
  }, [sortedGroups]);

  useEffect(() => {
    const previousTitle = document.title;
    if (courseData && courseData.short_name) {
      document.title = String(courseData.short_name);
    } else {
      document.title = `Curso ${id_course}`;
    }
    return () => {
      document.title = previousTitle;
    };
  }, [courseData, id_course]);

  if (!courseData) return <div>Curso no encontrado</div>;
  if (isCourseLoading || isGroupsLoading) return <div>Cargando...</div>;

  const submit: SubmitHandler<z.infer<typeof COURSE_DETAIL_FORM_SCHEMA>> = async (info) => {
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
  };

  const handleDelete = async () => {
    modal.confirm({
      title: "¿Seguro que desea eliminar este curso?",
      content: "Esta acción no se puede deshacer.",
      okText: "Eliminar",
      okType: "danger",
      cancelText: "Cancelar",
      onOk: async () => {
        try {
          await deleteCourse();
          navigate('/courses');
          message.success('Curso borrado exitosamente');
        } catch {
          modal.error({
            title: "Error al eliminar el curso",
            content: "No se pudo eliminar el curso. Recuerde que debe de estar vacío.",
          });
        }
      },
    });
  };

  const handleAddGroup = () => {
    navigate(`/courses/${id_course}/add-group`);
  };

  const handleRowClick = (record: { id_group: number }) => {
    setSelectedGroupId(record.id_group);
    setSelectedRowKeys([record.id_group]);
  };

  // Confirms bonification and generates the XML
  

  return (
    <div>
      {contextHolder}
      <Form layout="vertical" onFinish={handleSubmit(submit)}>
        <div>
          {/* Keep id_course in the form but hidden from the UI */}
          <Controller name="id_course" control={control} render={({ field }) => <input type="hidden" {...field} id="id_course" value={field.value ?? ''} />} />
        </div>
        <div style={{ display: 'flex', gap: '16px' }}>
          {courseData?.moodle_id ? (
            <Form.Item label="ID Moodle" name="moodle_id" style={{ width: 140 }}>
              <Controller name="moodle_id" control={control} render={({ field }) => <Input {...field} id="moodle_id" autoComplete="off" readOnly value={field.value ?? ''} />} />
            </Form.Item>
          ) : null}
          <Form.Item
            label="Nombre del curso"
            name="course_name"
            style={{ flex: 2 }}
            required={true}
            help={errors.course_name?.message}
            validateStatus={errors.course_name ? "error" : undefined}
          >
            <Controller name="course_name" control={control} render={({ field }) => <Input {...field} id="course_name" autoComplete="off" data-testid="course-name" value={field.value ?? ''} readOnly={!canEdit} />} />
          </Form.Item>
          <Form.Item
            label="Nombre corto"
            name="short_name"
            style={{ flex: 1 }}
            required={true}
            help={errors.short_name?.message}
            validateStatus={errors.short_name ? "error" : undefined}
          >
            <Controller name="short_name" control={control} render={({ field }) => <Input {...field} id="short_name" autoComplete="off" data-testid="short-name" value={field.value ?? ''} readOnly={!canEdit} />} />
          </Form.Item>
        </div>
        <div style={{ display: 'flex', gap: '16px', justifyContent: 'flex-start' }}>
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
                  onChange={date => {
                    if (!canEdit) return;
                    field.onChange(date ? date.toDate() : null);
                  }}
                  id="start_date"
                  inputReadOnly={!canEdit}
                  open={canEdit ? undefined : false}
                  allowClear={canEdit}
                />
              )}
            />
          </Form.Item>
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
                  onChange={date => {
                    if (!canEdit) return;
                    field.onChange(date ? date.toDate() : null);
                  }}
                  id="end_date"
                  inputReadOnly={!canEdit}
                  open={canEdit ? undefined : false}
                  allowClear={canEdit}
                />
              )}
            />
          </Form.Item>
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
                <Select
                  {...field}
                  id="modality"
                  data-testid="modality"
                  onChange={(value) => {
                    if (!canEdit) return;
                    field.onChange(value);
                  }}
                  open={canEdit ? undefined : false}
                  showSearch={canEdit}
                  allowClear={canEdit}
                >
                  {Object.values(CourseModality).map((modality) => (
                    <Select.Option key={modality} value={modality} data-testid={`modality-option-${modality}`}>
                      {modality}
                    </Select.Option>
                  ))}
                </Select>
              )}
            />
          </Form.Item>
          <Form.Item
            label="Horas"
            name="hours"
            help={errors.hours?.message}
            validateStatus={errors.hours ? "error" : undefined}
          >
            <Controller
              name="hours"
              control={control}
              render={({ field }) => <Input type="number" min={0} {...field} id="hours" autoComplete="off" style={{ width: 80 }} value={field.value ?? ''} readOnly={!canEdit} />}
            />
          </Form.Item>
          <Form.Item
            label="Precio/hora"
            name="price_per_hour"
            help={errors.price_per_hour?.message}
            validateStatus={errors.price_per_hour ? "error" : undefined}
          >
            <Controller
              name="price_per_hour"
              control={control}
              render={({ field }) => <Input type="number" min={0} step="0.01" {...field} id="price_per_hour" autoComplete="off" style={{ width: 100 }} value={field.value ?? ''} readOnly={!canEdit} />}
            />
          </Form.Item>
          <Form.Item
            label="FUNDAE ID"
            name="fundae_id"
            help={errors.fundae_id?.message}
            validateStatus={errors.fundae_id ? "error" : undefined}
          >
            <Controller
              name="fundae_id"
              control={control}
              render={({ field }) => <Input {...field} id="fundae_id" autoComplete="off" style={{ width: 120 }} value={field.value ?? ''} readOnly={!canEdit} />}
            />
          </Form.Item>
          <Form.Item
            label="Activo"
            name="active"
            valuePropName="checked"
            help={errors.active?.message}
            validateStatus={errors.active ? "error" : undefined}
          >
            <Controller
              name="active"
              control={control}
              render={({ field }) => (
                <Checkbox
                  {...field}
                  id="active"
                  checked={!!field.value}
                  onChange={canEdit ? field.onChange : undefined}
                  onClick={preventReadOnlyClick}
                >
                  {""}
                </Checkbox>
              )}
            />
          </Form.Item>
        </div>
        <div style={{ display: 'flex', gap: '16px' }}>
          <div style={{ marginTop: 8, display: 'flex', width: '30%', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>Grupos del Curso</h3>
              <AuthzHide roles={[Role.ADMIN]}>
                <Button type="default" icon={<TeamOutlined />} onClick={handleAddGroup}>
                  Añadir Grupo al Curso
                </Button>
              </AuthzHide>
            </div>
            <Table
              rowKey="id_group"
              columns={[
                { title: 'Nombre del grupo', dataIndex: 'group_name' },
                { title: 'Fecha Inicio', dataIndex: 'start_date', render: (d: string | Date | null) => d ? dayjs(d).format('DD/MM/YYYY') : '-' },
                { title: 'Fecha Fin', dataIndex: 'end_date', render: (d: string | Date | null) => d ? dayjs(d).format('DD/MM/YYYY') : '-' },
              ]}
              dataSource={sortedGroups}
              loading={isGroupsLoading}
              pagination={false}
              scroll={{ y: 500 }}
              rowSelection={{
                type: 'radio',
                selectedRowKeys,
                onChange: (selectedRowKeys) => setSelectedRowKeys(selectedRowKeys as number[]),
                renderCell: () => null,
              }}
              id="groups-table"
              onRow={(record) => ({
                onClick: () => handleRowClick(record),
                onDoubleClick: () => {
                  const url = `/groups/${record.id_group}/edit`;
                  const newWindow = window.open(url, '_blank');
                  if (newWindow) {
                    // prevent the opened page from accessing window.opener for security
                    try {
                      newWindow.opener = null;
                    } catch (e) {
                      // ignore if setting opener is not allowed
                    }
                  }
                },
                style: { cursor: 'pointer' }
              })}
            />
          </div>
          <div style={{ marginTop: 8, width: '70%' }}>
            <GroupUsersManager groupId={selectedGroupId} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: '16px' }}>
          <AuthzHide roles={[Role.ADMIN, Role.MANAGER]}>
            <Button type="primary" icon={<SaveOutlined />} htmlType="submit" data-testid="save-course">Guardar Curso</Button>
          </AuthzHide>
          <AuthzHide roles={[Role.ADMIN]}>
            <Button icon={<DeleteOutlined />} type="primary" danger onClick={handleDelete}>Eliminar Curso</Button>
          </AuthzHide>
        </div>
      </Form>

      <Modal width={'80%'} destroyOnClose open={Boolean(userToLookup)} onCancel={() => {
        refetchUsersByGroup();
        setUserToLookup(null);
      }} footer={null}>
        {userToLookup && <UserDetail userId={userToLookup} />}
      </Modal>
    </div>
  );
}
