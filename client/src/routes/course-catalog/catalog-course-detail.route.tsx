import { App, Button, Modal, Select, Space } from "antd";
import { MergeCellsOutlined } from "@ant-design/icons";
import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CatalogCourseForm } from "../../components/course-catalog/catalog-course-form";
import { CatalogCourseContentsTab } from "../../components/course-catalog/catalog-course-contents-tab";
import { CourseInterestsSection } from "../../components/course-catalog/course-interests-section";
import { DataTable } from "../../components/common/DataTable";
import { PageHeader } from "../../components/common/PageHeader";
import { RouteTabs } from "../../components/common/RouteTabs";
import { YearTag } from "../../components/common/tags";
import { AuthzHide } from "../../components/permissions/authz-hide";
import { Role } from "../../hooks/api/auth/use-login.mutation";
import { useCourseCatalogQuery, useCatalogCourseQuery } from "../../hooks/api/course-catalog/use-course-catalog.query";
import { useMergeCatalogCourseMutation, useUpdateCatalogCourseMutation } from "../../hooks/api/course-catalog/use-course-catalog.mutations";
import { useCourseInterestsByCatalogQuery } from "../../hooks/api/course-interests/use-course-interests";
import { useAllGroupsQuery } from "../../hooks/api/groups/use-all-groups.query";
import { useRole } from "../../utils/permissions/use-role";
import { formatDate } from "../../utils/format";

export default function CatalogCourseDetailRoute() {
  const { id_catalog_course = "" } = useParams();
  const id = Number(id_catalog_course);
  const { message } = App.useApp();
  const navigate = useNavigate();
  const role = useRole();
  const canEdit = role === Role.ADMIN;
  // Contenidos, a diferencia del resto de la ficha (solo ADMIN), lo pueden editar
  // también MANAGER — igual que podían antes en la ficha de la edición.
  const canEditContents = role === Role.ADMIN || role === Role.MANAGER;
  const canEditInterests = role === Role.ADMIN || role === Role.MANAGER;
  const canAddInterests = canEditInterests || role === Role.TUTOR;
  const { data, isLoading } = useCatalogCourseQuery(id);
  const { data: all = [] } = useCourseCatalogQuery();
  const { data: interests = [] } = useCourseInterestsByCatalogQuery(id, Boolean(id));
  const { data: allGroups } = useAllGroupsQuery();
  const update = useUpdateCatalogCourseMutation(id);
  const merge = useMergeCatalogCourseMutation(id);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [target, setTarget] = useState<number>();

  // Para cada edición, el grupo con la fecha de inicio más reciente (se asume
  // que sus fechas inicio/fin se corresponden con las de la propia edición).
  const latestGroupByCourse = useMemo(() => {
    const map = new Map<number, { start_date: Date | string | null; end_date: Date | string | null }>();
    for (const g of allGroups ?? []) {
      if (!g.start_date) continue;
      const current = map.get(g.id_course);
      if (!current || (current.start_date && new Date(g.start_date).getTime() > new Date(current.start_date).getTime())) {
        map.set(g.id_course, { start_date: g.start_date, end_date: g.end_date ?? null });
      }
    }
    return map;
  }, [allGroups]);

  // Fecha de inicio (del grupo más reciente) descendente y, a igualdad,
  // id_course descendente: las ediciones más recientes primero.
  const editions = useMemo(() => [...(data?.editions ?? [])].sort((a, b) => {
    const aStart = latestGroupByCourse.get(a.id_course)?.start_date;
    const bStart = latestGroupByCourse.get(b.id_course)?.start_date;
    const aTime = aStart ? new Date(aStart).getTime() : 0;
    const bTime = bStart ? new Date(bStart).getTime() : 0;
    return bTime - aTime || b.id_course - a.id_course;
  }), [data?.editions, latestGroupByCourse]);
  if (isLoading) return <div>Cargando...</div>;
  if (!data) return <div>Curso de catálogo no encontrado</div>;
  return <>
    <PageHeader title={data.name} subtitle="Curso de catálogo" extra={<AuthzHide roles={[Role.ADMIN]}><Button icon={<MergeCellsOutlined />} onClick={() => setMergeOpen(true)}>Fusionar</Button></AuthzHide>} />
    <RouteTabs defaultTabKey="ediciones" items={[
      { key:"datos", label:"Datos generales", children:<CatalogCourseForm initial={data} readOnly={!canEdit} saving={update.isPending} onSubmit={async values => { try { await update.mutateAsync(values); message.success("Curso de catálogo actualizado"); } catch (error) { message.error((error as {response?:{data?:{message?:string}}})?.response?.data?.message ?? "No se pudo guardar"); } }} /> },
      { key:"ediciones", label:`Ediciones (${editions.length})`, children:<DataTable rowKey="id_course" dataSource={editions} getRowUrl={row => `/courses/${row.id_course}`} columns={[{title:"Edición",dataIndex:"course_name",render:(value,row)=>{const start=latestGroupByCourse.get(row.id_course)?.start_date;const year=start?new Date(start).getFullYear():null;return <><YearTag year={year} style={{marginRight:6}} />{value}</>;}},{title:"Expediente",dataIndex:"file_number",render:value=>value||"-"},{title:"Inicio",key:"start_date",render:(_,row)=>formatDate(latestGroupByCourse.get(row.id_course)?.start_date,"-")},{title:"Fin",key:"end_date",render:(_,row)=>formatDate(latestGroupByCourse.get(row.id_course)?.end_date,"-")},{title:"Modalidad",dataIndex:"modality"}]} /> },
      { key:"interesados", label:`Interesados (${interests.length})`, children:<CourseInterestsSection catalogCourseId={id} canEdit={canEditInterests} canAdd={canAddInterests} /> },
      { key:"contenidos", label:"Contenidos", children:<CatalogCourseContentsTab catalogCourseId={id} initialContents={data.contents} canEdit={canEditContents} /> },
    ]} />
    <Modal title="Fusionar curso de catálogo" open={mergeOpen} onCancel={() => setMergeOpen(false)} onOk={async () => { if (!target) return; await merge.mutateAsync(target); message.success("Cursos fusionados"); navigate(`/course-catalog/${target}`); }} okButtonProps={{disabled:!target}} okText="Fusionar" cancelText="Cancelar">
      <Space direction="vertical" style={{width:"100%"}}><span>Todas las ediciones se trasladarán al curso seleccionado.</span><Select showSearch optionFilterProp="label" style={{width:"100%"}} value={target} onChange={setTarget} options={all.filter(item=>item.id_catalog_course!==id).map(item=>({value:item.id_catalog_course,label:item.name}))} /></Space>
    </Modal>
  </>;
}
