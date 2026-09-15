import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { App, Button, Descriptions, Divider, Form, Input, Select } from "antd";
import { useForm, Controller, SubmitHandler } from "react-hook-form";
import { PlusOutlined, SaveOutlined } from "@ant-design/icons";
import z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { AuthzHide } from "../../components/permissions/authz-hide";
import { Role } from "../../hooks/api/auth/use-login.mutation";
import { useCourseCatalogQuery } from "../../hooks/api/course-catalog/use-course-catalog.query";
import { useConsultingActionsQuery } from "../../hooks/api/consulting-action/use-consulting-actions.query";
import { useConsultingActionQuery } from "../../hooks/api/consulting-action/use-consulting-action.query";
import { useUpsertConsultingActionMutation } from "../../hooks/api/consulting-action/use-upsert-consulting-action.mutation";
import { useCourseCategoriesQuery } from "../../hooks/api/course-category/use-course-categories.query";
import { useCreateCourseCategoryMutation } from "../../hooks/api/course-category/use-create-course-category.mutation";
import { useConsultingPlanningDatesQuery } from "../../hooks/api/consulting-planning-date/use-consulting-planning-dates.query";
import { useCreateConsultingPlanningDateMutation } from "../../hooks/api/consulting-planning-date/use-create-consulting-planning-date.mutation";

const CONSULTING_ACTION_FORM = z.object({
  origin: z.enum(['OWN', 'EXTERNAL'], { required_error: "El origen es obligatorio" }),
  id_category: z.number().optional(),
  id_planning_date: z.number().optional(),
});

export default function ConsultingActionFormRoute() {
  const { id_course: idCourseParam } = useParams();
  const isEdit = !!idCourseParam;
  const navigate = useNavigate();
  const { message } = App.useApp();

  const [pickedCourseId, setPickedCourseId] = useState<number | undefined>(idCourseParam ? Number(idCourseParam) : undefined);
  const id_catalog_course = pickedCourseId ? String(pickedCourseId) : "";

  const { data: catalogData } = useCourseCatalogQuery();
  const { data: taggedActionsData } = useConsultingActionsQuery();
  const { data: existingAction, isLoading: isActionLoading } = useConsultingActionQuery(id_catalog_course, { enabled: isEdit });
  const { mutateAsync: upsertAction } = useUpsertConsultingActionMutation(id_catalog_course);

  const { data: categoriesData } = useCourseCategoriesQuery();
  const { mutateAsync: createCategory, isPending: isCreatingCategory } = useCreateCourseCategoryMutation();
  const [newCategoryName, setNewCategoryName] = useState("");

  const { data: planningDatesData } = useConsultingPlanningDatesQuery();
  const { mutateAsync: createPlanningDate, isPending: isCreatingPlanningDate } = useCreateConsultingPlanningDateMutation();
  const [newPlanningDateName, setNewPlanningDateName] = useState("");

  const { handleSubmit, control, reset, formState: { errors } } = useForm<z.infer<typeof CONSULTING_ACTION_FORM>>({
    resolver: zodResolver(CONSULTING_ACTION_FORM),
    defaultValues: { origin: 'OWN' },
  });

  const taggedCatalogCourseIds = useMemo(
    () => new Set((taggedActionsData ?? []).map((a) => a.id_catalog_course)),
    [taggedActionsData]
  );
  const pickableCourses = (catalogData ?? []).filter((c) => !taggedCatalogCourseIds.has(c.id_catalog_course));
  const pickedCourse = (catalogData ?? []).find((c) => c.id_catalog_course === pickedCourseId);

  useEffect(() => {
    if (existingAction) {
      reset({
        origin: existingAction.origin,
        id_category: existingAction.id_category ?? undefined,
        id_planning_date: existingAction.id_planning_date ?? undefined,
      });
    }
  }, [existingAction, reset]);

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return;
    await createCategory(newCategoryName.trim());
    setNewCategoryName("");
  };

  const handleCreatePlanningDate = async () => {
    if (!newPlanningDateName.trim()) return;
    await createPlanningDate(newPlanningDateName.trim());
    setNewPlanningDateName("");
  };

  const submit: SubmitHandler<z.infer<typeof CONSULTING_ACTION_FORM>> = async (info) => {
    if (!pickedCourseId) return;
    try {
      await upsertAction(info);
      navigate('/consultoria/actions');
    } catch {
      message.error('No se pudo guardar la acción formativa. Inténtalo de nuevo.');
    }
  };

  if (isEdit && isActionLoading) return <div>Cargando...</div>;

  return (
    <div>
      {!isEdit && (
        <Form.Item label="Curso de catálogo" required style={{ maxWidth: 480 }}>
          <Select
            showSearch
            placeholder="Buscar un curso de catálogo ya existente..."
            value={pickedCourseId}
            onChange={setPickedCourseId}
            filterOption={(input, option) => (option?.label as string ?? '').toLowerCase().includes(input.toLowerCase())}
            options={pickableCourses.map((c) => ({ value: c.id_catalog_course, label: c.name }))}
          />
        </Form.Item>
      )}

      {pickedCourse && (
        <Descriptions column={1} bordered size="small" style={{ maxWidth: 480, marginBottom: 20 }}>
          <Descriptions.Item label="Nombre">{pickedCourse.name}</Descriptions.Item>
          <Descriptions.Item label="Horas">{pickedCourse.default_hours ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="Modalidad">{pickedCourse.default_modality ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="Objetivos">{pickedCourse.objectives || '—'}</Descriptions.Item>
          <Descriptions.Item label="Dirigido a">{pickedCourse.target_audience || '—'}</Descriptions.Item>
        </Descriptions>
      )}
      {pickedCourse && (
        <p style={{ marginTop: -12, marginBottom: 20 }}>
          <Link to={`/course-catalog/${pickedCourse.id_catalog_course}`} target="_blank" rel="noopener noreferrer">
            Editar estos datos en la ficha del curso de catálogo ↗
          </Link>
        </p>
      )}

      {pickedCourseId && (
        <Form layout="vertical" onFinish={handleSubmit(submit)} style={{ maxWidth: 480 }}>
          <Form.Item
            label="Origen"
            required
            help={errors.origin?.message}
            validateStatus={errors.origin ? "error" : undefined}
          >
            <Controller
              name="origin"
              control={control}
              render={({ field }) => (
                <Select
                  {...field}
                  options={[
                    { value: 'OWN', label: 'Propia (Mecohisa)' },
                    { value: 'EXTERNAL', label: 'Externa (del centro)' },
                  ]}
                />
              )}
            />
          </Form.Item>

          <Form.Item label="Categoría">
            <Controller
              name="id_category"
              control={control}
              render={({ field }) => (
                <Select
                  {...field}
                  allowClear
                  placeholder="Sin categoría"
                  options={(categoriesData ?? []).filter((c) => c.active).map((c) => ({ value: c.id_category, label: c.name }))}
                  dropdownRender={(menu) => (
                    <>
                      {menu}
                      <AuthzHide roles={[Role.ADMIN]}>
                        <Divider style={{ margin: '8px 0' }} />
                        <div style={{ display: 'flex', gap: 8, padding: '0 8px 8px' }}>
                          <Input
                            placeholder="Nueva categoría..."
                            value={newCategoryName}
                            onChange={(e) => setNewCategoryName(e.target.value)}
                            onKeyDown={(e) => e.stopPropagation()}
                          />
                          <Button type="text" icon={<PlusOutlined />} loading={isCreatingCategory} onClick={handleCreateCategory}>Añadir</Button>
                        </div>
                      </AuthzHide>
                    </>
                  )}
                />
              )}
            />
          </Form.Item>

          <Form.Item label="Fecha">
            <Controller
              name="id_planning_date"
              control={control}
              render={({ field }) => (
                <Select
                  {...field}
                  allowClear
                  placeholder="Sin fecha"
                  options={(planningDatesData ?? []).filter((d) => d.active).map((d) => ({ value: d.id_planning_date, label: d.name }))}
                  dropdownRender={(menu) => (
                    <>
                      {menu}
                      <AuthzHide roles={[Role.ADMIN]}>
                        <Divider style={{ margin: '8px 0' }} />
                        <div style={{ display: 'flex', gap: 8, padding: '0 8px 8px' }}>
                          <Input
                            placeholder="Nuevo valor de fecha..."
                            value={newPlanningDateName}
                            onChange={(e) => setNewPlanningDateName(e.target.value)}
                            onKeyDown={(e) => e.stopPropagation()}
                          />
                          <Button type="text" icon={<PlusOutlined />} loading={isCreatingPlanningDate} onClick={handleCreatePlanningDate}>Añadir</Button>
                        </div>
                      </AuthzHide>
                    </>
                  )}
                />
              )}
            />
          </Form.Item>

          <div className="form-actions">
            <Button onClick={() => navigate('/consultoria/actions')}>Cancelar</Button>
            <AuthzHide roles={[Role.ADMIN, Role.CONSULTOR]}>
              <Button type="primary" htmlType="submit" icon={<SaveOutlined />}>Guardar</Button>
            </AuthzHide>
          </div>
        </Form>
      )}
    </div>
  );
}
