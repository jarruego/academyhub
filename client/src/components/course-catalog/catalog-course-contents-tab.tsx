import { useEffect, useState } from "react";
import { App, Button } from "antd";
import { SaveOutlined } from "@ant-design/icons";
import HtmlEditor from "../courses/HtmlEditor";
import { AuthzHide } from "../permissions/authz-hide";
import { Role } from "../../hooks/api/auth/use-login.mutation";
import { useUpdateCatalogCourseMutation } from "../../hooks/api/course-catalog/use-course-catalog.mutations";

/**
 * Contenidos HTML del curso de catálogo, compartidos por todas sus ediciones
 * (antes vivían duplicados en cada edición — ver docs/course-catalog.md).
 */
export function CatalogCourseContentsTab({ catalogCourseId, initialContents, canEdit }: {
  catalogCourseId: number;
  initialContents?: string | null;
  canEdit: boolean;
}) {
  const { message } = App.useApp();
  const update = useUpdateCatalogCourseMutation(catalogCourseId);
  const [contents, setContents] = useState(initialContents ?? "");

  useEffect(() => {
    setContents(initialContents ?? "");
  }, [initialContents]);

  const handleSave = async () => {
    try {
      await update.mutateAsync({ contents });
      message.success("Contenidos actualizados");
    } catch {
      message.error("No se pudo guardar");
    }
  };

  if (!canEdit) {
    return (
      <div style={{ padding: 16, minHeight: 200 }}>
        <div dangerouslySetInnerHTML={{ __html: contents || "<em>No hay contenidos</em>" }} />
      </div>
    );
  }

  return (
    <div>
      <HtmlEditor value={contents} onChange={setContents} />
      <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
        <AuthzHide roles={[Role.ADMIN, Role.MANAGER]}>
          <Button type="primary" icon={<SaveOutlined />} loading={update.isPending} onClick={handleSave} data-testid="save-catalog-contents">
            Guardar Contenidos
          </Button>
        </AuthzHide>
      </div>
    </div>
  );
}
