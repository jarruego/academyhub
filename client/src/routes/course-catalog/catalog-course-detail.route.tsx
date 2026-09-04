import { App, Button, Modal, Select, Space } from "antd";
import { MergeCellsOutlined } from "@ant-design/icons";
import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CatalogCourseForm } from "../../components/course-catalog/catalog-course-form";
import { CourseInterestsSection } from "../../components/course-catalog/course-interests-section";
import { DataTable } from "../../components/common/DataTable";
import { PageHeader } from "../../components/common/PageHeader";
import { RouteTabs } from "../../components/common/RouteTabs";
import { AuthzHide } from "../../components/permissions/authz-hide";
import { Role } from "../../hooks/api/auth/use-login.mutation";
import { useCourseCatalogQuery, useCatalogCourseQuery } from "../../hooks/api/course-catalog/use-course-catalog.query";
import { useMergeCatalogCourseMutation, useUpdateCatalogCourseMutation } from "../../hooks/api/course-catalog/use-course-catalog.mutations";
import { useCourseInterestsByCatalogQuery } from "../../hooks/api/course-interests/use-course-interests";
import { useRole } from "../../utils/permissions/use-role";

export default function CatalogCourseDetailRoute() {
  const { id_catalog_course = "" } = useParams();
  const id = Number(id_catalog_course);
  const { message } = App.useApp();
  const navigate = useNavigate();
  const role = useRole();
  const canEdit = role === Role.ADMIN;
  const canEditInterests = role === Role.ADMIN || role === Role.MANAGER;
  const { data, isLoading } = useCatalogCourseQuery(id);
  const { data: all = [] } = useCourseCatalogQuery();
  const { data: interests = [] } = useCourseInterestsByCatalogQuery(id, Boolean(id));
  const update = useUpdateCatalogCourseMutation(id);
  const merge = useMergeCatalogCourseMutation(id);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [target, setTarget] = useState<number>();
  // Fecha de inicio descendente y, a igualdad, id_course descendente: las
  // ediciones más recientes primero.
  const editions = useMemo(() => [...(data?.editions ?? [])].sort((a, b) => {
    const aStart = a.start_date ? new Date(a.start_date).getTime() : 0;
    const bStart = b.start_date ? new Date(b.start_date).getTime() : 0;
    return bStart - aStart || b.id_course - a.id_course;
  }), [data?.editions]);
  if (isLoading) return <div>Cargando...</div>;
  if (!data) return <div>Curso de catálogo no encontrado</div>;
  return <>
    <PageHeader title={data.name} subtitle="Curso de catálogo" extra={<AuthzHide roles={[Role.ADMIN]}><Button icon={<MergeCellsOutlined />} onClick={() => setMergeOpen(true)}>Fusionar</Button></AuthzHide>} />
    <RouteTabs defaultTabKey="datos" items={[
      { key:"datos", label:"Datos generales", children:<CatalogCourseForm initial={data} readOnly={!canEdit} saving={update.isPending} onSubmit={async values => { try { await update.mutateAsync(values); message.success("Curso de catálogo actualizado"); } catch (error) { message.error((error as {response?:{data?:{message?:string}}})?.response?.data?.message ?? "No se pudo guardar"); } }} /> },
      { key:"ediciones", label:`Ediciones (${editions.length})`, children:<DataTable rowKey="id_course" dataSource={editions} getRowUrl={row => `/courses/${row.id_course}`} columns={[{title:"Edición",dataIndex:"course_name"},{title:"Expediente",dataIndex:"file_number",render:value=>value||"-"},{title:"Inicio",dataIndex:"start_date",render:value=>value?new Date(value).toLocaleDateString("es-ES"):"-"},{title:"Modalidad",dataIndex:"modality"}]} /> },
      { key:"interesados", label:`Interesados (${interests.length})`, children:<CourseInterestsSection catalogCourseId={id} canEdit={canEditInterests} /> },
    ]} />
    <Modal title="Fusionar curso de catálogo" open={mergeOpen} onCancel={() => setMergeOpen(false)} onOk={async () => { if (!target) return; await merge.mutateAsync(target); message.success("Cursos fusionados"); navigate(`/course-catalog/${target}`); }} okButtonProps={{disabled:!target}} okText="Fusionar" cancelText="Cancelar">
      <Space direction="vertical" style={{width:"100%"}}><span>Todas las ediciones se trasladarán al curso seleccionado.</span><Select showSearch optionFilterProp="label" style={{width:"100%"}} value={target} onChange={setTarget} options={all.filter(item=>item.id_catalog_course!==id).map(item=>({value:item.id_catalog_course,label:item.name}))} /></Space>
    </Modal>
  </>;
}
