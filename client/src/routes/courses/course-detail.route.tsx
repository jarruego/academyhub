import { useParams, useSearchParams } from "react-router-dom";
import { useCourseQuery } from "../../hooks/api/courses/use-course.query";
import { useGroupsQuery } from "../../hooks/api/groups/use-groups.query";
import { useUpdateCourseMutation } from "../../hooks/api/courses/use-update-course.mutation";
import { Button, DatePicker, Form, Input, Table, Select, Tag, Modal, App, Tabs, Row, Col, Space } from "antd";
import HtmlEditor from '../../components/courses/HtmlEditor';
import { DeleteOutlined, SaveOutlined, TeamOutlined, CommentOutlined } from "@ant-design/icons";
import { useForm, Controller, SubmitHandler } from "react-hook-form";
import { useState, useEffect, useMemo, useRef } from "react";
import { useUsersByGroupQuery } from "../../hooks/api/users/use-users-by-group.query";
import { CourseModality } from "../../shared/types/course/course-modality.enum";
import { CourseOrigin } from "../../shared/types/course/course-origin.enum";
import { CourseFunding } from "../../shared/types/course/course-funding.enum";
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
import { Group } from "../../shared/types/group/group";
import { isGroupActive } from "../../utils/group-active.util";

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
  file_number: z.string().optional().nullish(),
  origin: z.nativeEnum(CourseOrigin).optional().nullish(),
  funding: z.nativeEnum(CourseFunding).optional().nullish(),
  moodle_id: z.number().optional().nullish(),
  category: z.string().optional().nullish(),
  contents: z.string().optional().nullish(),
});

export default function CourseDetailRoute() {
  const { message } = App.useApp();
  const role = useRole();
  const canEdit = [Role.ADMIN, Role.MANAGER].includes(role);
  const navigate = useNavigate();
  const { id_course } = useParams();
  const [searchParams] = useSearchParams();
  // Llegada desde la ficha de usuario: preseleccionar el grupo/usuario indicados en la URL,
  // pero solo en la carga inicial (no debe pisar selecciones manuales posteriores).
  const initialGroupIdRef = useRef<number | null>(
    searchParams.get('groupId') ? Number(searchParams.get('groupId')) : null
  );
  const appliedInitialGroupRef = useRef(false);
  const highlightUserId = searchParams.get('userId') ? Number(searchParams.get('userId')) : null;
  const { data: courseData, isLoading: isCourseLoading } = useCourseQuery(id_course || "");
  const { data: groupsData, isLoading: isGroupsLoading } = useGroupsQuery(id_course || "");
  const sortedGroups = useMemo(() => {
    const list = groupsData ?? [];
    return [...list].sort((a, b) => {
      const toMillis = (d: string | Date | null | undefined) => {
        if (!d) return Number.NEGATIVE_INFINITY;
        const t = (d instanceof Date) ? d.getTime() : Date.parse(String(d));
        return Number.isFinite(t) ? t : Number.NEGATIVE_INFINITY;
      };
      const aEnd = toMillis(a.end_date);
      const bEnd = toMillis(b.end_date);
      if (aEnd !== bEnd) return bEnd - aEnd;
      return (b.group_name ?? '').localeCompare(a.group_name ?? '');
    });
  }, [groupsData]);
  // A course is active if it has at least one active group (derived state).
  const courseActive = useMemo(() => (groupsData ?? []).some((g) => isGroupActive(g)), [groupsData]);
  const { mutateAsync: updateCourse } = useUpdateCourseMutation(id_course || "");
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const { refetch: refetchUsersByGroup } = useUsersByGroupQuery(selectedGroupId);
  const { mutateAsync: deleteCourse } = useDeleteCourseMutation(id_course || "");
  const [selectedRowKeys, setSelectedRowKeys] = useState<number[]>([]);
  const [modal, contextHolder] = Modal.useModal();
  const [userToLookup, setUserToLookup] = useState<number | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const defaultModality = Object.values(CourseModality)[0] as CourseModality;
  const { handleSubmit, control, reset, formState: { errors }, watch } = useForm<z.infer<typeof COURSE_DETAIL_FORM_SCHEMA>>({
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
      file_number: '',
      origin: null,
      funding: null,
      moodle_id: null,
      category: '',
      contents: '',
    },
  });

  useEffect(() => {
    if (courseData) {
      // `active` is derived and `is_provisional` is managed by the importer;
      // exclude both from the editable form values.
      const { active: _active, is_provisional: _isProvisional, ...courseRest } = courseData;
      reset({
        ...courseRest,
        start_date: courseData.start_date ? (dayjs.isDayjs(courseData.start_date) ? courseData.start_date.toDate() : courseData.start_date) : null,
        end_date: courseData.end_date ? (dayjs.isDayjs(courseData.end_date) ? courseData.end_date.toDate() : courseData.end_date) : null,
        contents: courseData.contents ?? '',
      });
    }
  }, [courseData, reset]);

  useEffect(() => {
    if (!sortedGroups || sortedGroups.length === 0) return;
    // Consumir el groupId de la URL fuera del updater de setState: mutar un ref dentro
    // de un updater funcional es inseguro (StrictMode invoca esos updaters dos veces
    // para detectar impurezas, y la segunda invocación vería el ref ya a null).
    if (!appliedInitialGroupRef.current && initialGroupIdRef.current != null) {
      appliedInitialGroupRef.current = true;
      const requestedId = initialGroupIdRef.current;
      if (sortedGroups.some((g) => g.id_group === requestedId)) {
        setSelectedGroupId(requestedId);
        return;
      }
    }
    setSelectedGroupId((prev) => {
      const stillExists = prev != null && sortedGroups.some((g) => g.id_group === prev);
      return stillExists ? prev : sortedGroups[0].id_group;
    });
  }, [sortedGroups]);

  useEffect(() => {
    if (selectedGroupId != null) {
      setSelectedRowKeys([selectedGroupId]);
    }
  }, [selectedGroupId]);

  useEffect(() => {
    if (selectedGroupId == null) return;
    const timeoutId = window.setTimeout(() => {
      const row = document.querySelector(`#groups-table tr[data-row-key="${selectedGroupId}"]`);
      row?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 300);
    return () => window.clearTimeout(timeoutId);
  }, [selectedGroupId]);

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
      contents: info.contents ?? '',
    };
    try {
      await updateCourse({
        ...data,
        start_date: data.start_date ? dayjs(data.start_date).utc().toDate() : null,
        end_date: data.end_date ? dayjs(data.end_date).utc().toDate() : null,
      });
      setShowSuccessModal(true);
    } catch (error) {
      const apiMessage = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
      message.error(apiMessage || 'No se pudo guardar el curso. Inténtalo de nuevo.');
    }
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

  const contentsValue = watch('contents');
  const hasMoodleId = Boolean(courseData?.moodle_id);
  // Visibilidad condicional de los campos de clasificación. Se muestran cuando el
  // eje correspondiente lo justifica O cuando ya hay dato (para no ocultar valores
  // existentes de cursos aún sin clasificar del todo).
  const originValue = watch('origin');
  const fundingValue = watch('funding');
  const showFundaeId = fundingValue === CourseFunding.FUNDAE || Boolean(courseData?.fundae_id);
  const showFileNumber = originValue === CourseOrigin.INAEM || Boolean(courseData?.file_number);

  return (
    <div>
      {contextHolder}
      <Tabs defaultActiveKey="ficha" items={[{
        key: 'ficha',
        label: 'Ficha',
        children: (
          <Form layout="vertical" onFinish={handleSubmit(submit)}>
            <Controller name="id_course" control={control} render={({ field }) => <input type="hidden" {...field} id="id_course" value={field.value ?? ''} />} />

            {/* Nombre del curso */}
            <Row gutter={[16, 0]}>
              {hasMoodleId && (
                <Col xs={24} sm={6} md={4}>
                  <Form.Item label="ID Moodle" name="moodle_id">
                    <Controller name="moodle_id" control={control} render={({ field }) => <Input {...field} id="moodle_id" autoComplete="off" readOnly value={field.value ?? ''} />} />
                  </Form.Item>
                </Col>
              )}
              <Col xs={24} sm={hasMoodleId ? 18 : 24} md={hasMoodleId ? 13 : 17}>
                <Form.Item
                  label="Nombre del curso"
                  name="course_name"
                  required
                  help={errors.course_name?.message}
                  validateStatus={errors.course_name ? "error" : undefined}
                >
                  <Controller name="course_name" control={control} render={({ field }) => <Input {...field} id="course_name" autoComplete="off" data-testid="course-name" value={field.value ?? ''} readOnly={!canEdit} />} />
                </Form.Item>
              </Col>
              <Col xs={24} sm={24} md={7}>
                <Form.Item
                  label="Nombre corto"
                  name="short_name"
                  required
                  help={errors.short_name?.message}
                  validateStatus={errors.short_name ? "error" : undefined}
                >
                  <Controller name="short_name" control={control} render={({ field }) => <Input {...field} id="short_name" autoComplete="off" data-testid="short-name" value={field.value ?? ''} readOnly={!canEdit} />} />
                </Form.Item>
              </Col>
            </Row>

            {/* Fechas, modalidad y datos numéricos */}
            <Row gutter={[16, 0]}>
              <Col xs={24} sm={12} md={4}>
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
                        style={{ width: '100%' }}
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
              </Col>
              <Col xs={24} sm={12} md={4}>
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
                        style={{ width: '100%' }}
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
              </Col>
              <Col xs={24} sm={12} md={5}>
                <Form.Item
                  label="Modalidad"
                  name="modality"
                  required
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
                    render={({ field }) => <Input type="number" min={0} {...field} id="hours" autoComplete="off" value={field.value ?? ''} readOnly={!canEdit} />}
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
                    render={({ field }) => <Input type="number" min={0} step="0.01" {...field} id="price_per_hour" autoComplete="off" value={field.value ?? ''} readOnly={!canEdit} />}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12} md={3}>
                <Form.Item label="Estado">
                  <Tag color={courseActive ? 'green' : 'red'} title="Derivado: el curso está activo si tiene algún grupo activo">
                    {courseActive ? 'Activo' : 'Inactivo'}
                  </Tag>
                </Form.Item>
              </Col>
            </Row>

            {/* Clasificación: origen (¿quién lo encarga?) + financiación (¿cómo se paga?).
                Nº Expediente solo aplica a INAEM; FUNDAE ID solo a financiación FUNDAE. */}
            <Row gutter={[16, 0]}>
              <Col xs={24} sm={12} md={5}>
                <Form.Item
                  label="Origen"
                  name="origin"
                  help={errors.origin?.message}
                  validateStatus={errors.origin ? "error" : undefined}
                >
                  <Controller
                    name="origin"
                    control={control}
                    render={({ field }) => (
                      <Select
                        {...field}
                        id="origin"
                        style={{ width: '100%' }}
                        placeholder="Sin clasificar"
                        value={field.value ?? undefined}
                        onChange={(value) => { if (!canEdit) return; field.onChange(value ?? null); }}
                        open={canEdit ? undefined : false}
                        allowClear={canEdit}
                      >
                        {Object.values(CourseOrigin).map((origin) => (
                          <Select.Option key={origin} value={origin}>{origin}</Select.Option>
                        ))}
                      </Select>
                    )}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12} md={5}>
                <Form.Item
                  label="Financiación"
                  name="funding"
                  help={errors.funding?.message}
                  validateStatus={errors.funding ? "error" : undefined}
                >
                  <Controller
                    name="funding"
                    control={control}
                    render={({ field }) => (
                      <Select
                        {...field}
                        id="funding"
                        style={{ width: '100%' }}
                        placeholder="Sin clasificar"
                        value={field.value ?? undefined}
                        onChange={(value) => { if (!canEdit) return; field.onChange(value ?? null); }}
                        open={canEdit ? undefined : false}
                        allowClear={canEdit}
                      >
                        {Object.values(CourseFunding).map((funding) => (
                          <Select.Option key={funding} value={funding}>{funding}</Select.Option>
                        ))}
                      </Select>
                    )}
                  />
                </Form.Item>
              </Col>
              {showFileNumber && (
                <Col xs={24} sm={12} md={5}>
                  <Form.Item
                    label="Nº Expediente (INAEM)"
                    name="file_number"
                    help={errors.file_number?.message}
                    validateStatus={errors.file_number ? "error" : undefined}
                  >
                    <Controller
                      name="file_number"
                      control={control}
                      render={({ field }) => <Input {...field} id="file_number" autoComplete="off" placeholder="p.ej. 25/0202.001" value={field.value ?? ''} readOnly={!canEdit} />}
                    />
                  </Form.Item>
                </Col>
              )}
              {showFundaeId && (
                <Col xs={24} sm={12} md={4}>
                  <Form.Item
                    label="FUNDAE ID"
                    name="fundae_id"
                    help={errors.fundae_id?.message}
                    validateStatus={errors.fundae_id ? "error" : undefined}
                  >
                    <Controller
                      name="fundae_id"
                      control={control}
                      render={({ field }) => <Input {...field} id="fundae_id" autoComplete="off" value={field.value ?? ''} readOnly={!canEdit} />}
                    />
                  </Form.Item>
                </Col>
              )}
              {courseData?.is_provisional && (
                <Col xs={24} sm={24} md={5}>
                  <Form.Item label="Aviso">
                    <Tag color="orange" title="Curso autocreado por la importación INAEM a partir del nº de expediente. Importa el fichero de Acciones para completar nombre, fechas y horas.">
                      Provisional — pendiente de completar (importa Acciones)
                    </Tag>
                  </Form.Item>
                </Col>
              )}
            </Row>

            {/* Grupos del curso y gestión de usuarios — stacked en mobile, side-by-side en lg+ */}
            <Row gutter={[16, 16]} style={{ marginTop: 8 }}>
              <Col xs={24} lg={8}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <h3 style={{ margin: 0 }}>Grupos del Curso</h3>
                  <Space size={8} wrap>
                    <AuthzHide roles={[Role.ADMIN]}>
                      <Button type="default" icon={<TeamOutlined />} onClick={handleAddGroup}>
                        Añadir Grupo al Curso
                      </Button>
                    </AuthzHide>
                    <AuthzHide roles={[Role.ADMIN, Role.MANAGER]}>
                      <Button
                        type="default"
                        icon={<CommentOutlined />}
                        onClick={() => window.open(`/tools/forum-duplicator?courseId=${id_course}`, '_blank', 'noopener')}
                      >
                        Foros
                      </Button>
                    </AuthzHide>
                  </Space>
                </div>
                <Table<Group>
                  rowKey="id_group"
                  columns={[
                    {
                      title: 'Nombre del grupo',
                      dataIndex: 'group_name',
                      sorter: (a: Group, b: Group) => (a.group_name ?? '').localeCompare(b.group_name ?? ''),
                      sortDirections: ['ascend', 'descend'],
                    },
                    {
                      title: 'Fecha Inicio',
                      dataIndex: 'start_date',
                      render: (d: string | Date | null) => d ? dayjs(d).format('DD/MM/YYYY') : '-',
                      sorter: (a: Group, b: Group) => {
                        const toMillis = (d: string | Date | null | undefined) => {
                          if (!d) return Number.NEGATIVE_INFINITY;
                          const t = (d instanceof Date) ? d.getTime() : Date.parse(String(d));
                          return Number.isFinite(t) ? t : Number.NEGATIVE_INFINITY;
                        };
                        return toMillis(b.start_date) - toMillis(a.start_date);
                      },
                      sortDirections: ['ascend', 'descend'],
                    },
                    {
                      title: 'Fecha Fin',
                      dataIndex: 'end_date',
                      render: (d: string | Date | null) => d ? dayjs(d).format('DD/MM/YYYY') : '-',
                      sorter: (a: Group, b: Group) => {
                        const toMillis = (d: string | Date | null | undefined) => {
                          if (!d) return Number.POSITIVE_INFINITY;
                          const t = (d instanceof Date) ? d.getTime() : Date.parse(String(d));
                          return Number.isFinite(t) ? t : Number.POSITIVE_INFINITY;
                        };
                        return toMillis(a.end_date) - toMillis(b.end_date);
                      },
                      sortDirections: ['ascend', 'descend'],
                    },
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
                      window.open(url, '_blank', 'noopener,noreferrer');
                    },
                    style: { cursor: 'pointer' }
                  })}
                />
              </Col>
              <Col xs={24} lg={16}>
                <GroupUsersManager
                  groupId={selectedGroupId}
                  courseName={courseData?.course_name}
                  courseModality={courseData?.modality}
                  courseOrigin={courseData?.origin}
                  courseFunding={courseData?.funding}
                  groupStart={sortedGroups.find(g => g.id_group === selectedGroupId)?.start_date}
                  groupEnd={sortedGroups.find(g => g.id_group === selectedGroupId)?.end_date}
                  highlightUserId={highlightUserId}
                />
              </Col>
            </Row>

            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginTop: 16 }}>
              <AuthzHide roles={[Role.ADMIN, Role.MANAGER]}>
                <Button type="primary" icon={<SaveOutlined />} htmlType="submit" data-testid="save-course">Guardar Curso</Button>
              </AuthzHide>
              <AuthzHide roles={[Role.ADMIN]}>
                <Button icon={<DeleteOutlined />} type="primary" danger onClick={handleDelete}>Eliminar Curso</Button>
              </AuthzHide>
            </div>
          </Form>
        ),
      }, {
        key: 'contenidos',
        label: 'Contenidos',
        children: canEdit ? (
          <Form layout="vertical" onFinish={handleSubmit(submit)}>
            <Form.Item label="Contenidos HTML" name="contents">
              <Controller
                name="contents"
                control={control}
                render={({ field }) => (
                  <HtmlEditor {...field} value={field.value ?? ''} readOnly={!canEdit} />
                )}
              />
            </Form.Item>
            <div style={{ display: 'flex', gap: '16px', marginTop: 8 }}>
              <AuthzHide roles={[Role.ADMIN, Role.MANAGER]}>
                <Button type="primary" icon={<SaveOutlined />} htmlType="submit" data-testid="save-contents">Guardar Contenidos</Button>
              </AuthzHide>
            </div>
          </Form>
        ) : (
          <div style={{ padding: 16, background: '#fff', minHeight: 200 }}>
            <div dangerouslySetInnerHTML={{ __html: contentsValue || '<em>No hay contenidos</em>' }} />
          </div>
        ),
      }]} />
      <Modal width={'80%'} destroyOnClose open={Boolean(userToLookup)} onCancel={() => {
        refetchUsersByGroup();
        setUserToLookup(null);
      }} footer={null}>
        {userToLookup && <UserDetail userId={userToLookup} />}
      </Modal>
      <Modal
        title="Éxito"
        open={showSuccessModal}
        onOk={() => setShowSuccessModal(false)}
        okText="Aceptar"
        cancelButtonProps={{ style: { display: 'none' } }}
      >
        <p>El curso se ha guardado correctamente.</p>
      </Modal>
    </div>
  );
}
