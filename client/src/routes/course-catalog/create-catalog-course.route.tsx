import { App } from "antd";
import { useNavigate } from "react-router-dom";
import { CatalogCourseForm } from "../../components/course-catalog/catalog-course-form";
import { PageHeader } from "../../components/common/PageHeader";
import { useCreateCatalogCourseMutation } from "../../hooks/api/course-catalog/use-course-catalog.mutations";

export default function CreateCatalogCourseRoute() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const mutation = useCreateCatalogCourseMutation();
  return <>
    <PageHeader title="Nuevo curso de catálogo" />
    <CatalogCourseForm saving={mutation.isPending} onSubmit={async values => {
      try {
        const created = await mutation.mutateAsync(values);
        message.success("Curso de catálogo creado");
        navigate(`/course-catalog/${created.id_catalog_course}`);
      } catch (error) {
        message.error((error as {response?:{data?:{message?:string}}})?.response?.data?.message ?? "No se pudo crear el curso de catálogo");
      }
    }} />
  </>;
}
