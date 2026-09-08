import { PlusOutlined, TeamOutlined } from "@ant-design/icons";
import { Button, Input, Tag } from "antd";
import { ColumnsType } from "antd/es/table";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AuthzHide } from "../../components/permissions/authz-hide";
import { ActiveTag } from "../../components/common/tags";
import { DataTable } from "../../components/common/DataTable";
import { ListPageLayout } from "../../components/common/ListPageLayout";
import { useCourseCatalogQuery } from "../../hooks/api/course-catalog/use-course-catalog.query";
import { useCoursesQuery } from "../../hooks/api/courses/use-courses.query";
import { useAllGroupsQuery } from "../../hooks/api/groups/use-all-groups.query";
import { Role } from "../../hooks/api/auth/use-login.mutation";
import { CatalogCourse } from "../../shared/types/course-catalog/course-catalog";
import { isGroupActive } from "../../utils/group-active.util";
import { formatDate } from "../../utils/format";

type CatalogCourseRow = CatalogCourse & { latest_group_end_date?: number | null; is_active?: boolean };

export default function CourseCatalogRoute() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const { data = [], isLoading } = useCourseCatalogQuery(search);
  const { data: allCourses, isLoading: isCoursesLoading } = useCoursesQuery();
  const { data: allGroups, isLoading: isGroupsLoading } = useAllGroupsQuery();

  // Curso de catálogo -> ediciones -> grupos: el catálogo no tiene fechas
  // propias, así que su estado activo/inactivo y su orden se derivan del
  // mismo criterio que usa el listado de Ediciones (`courses.route.tsx`),
  // un nivel más arriba.
  const catalogIdByCourse = useMemo(() => {
    const map: Record<number, number> = {};
    for (const c of allCourses ?? []) map[c.id_course] = c.id_catalog_course;
    return map;
  }, [allCourses]);

  const latestGroupEndByCatalog = useMemo(() => {
    const map: Record<number, number | null> = {};
    for (const g of allGroups ?? []) {
      const catalogId = catalogIdByCourse[g.id_course as number];
      if (catalogId == null) continue;
      if (!g.end_date) {
        if (typeof map[catalogId] === "undefined") map[catalogId] = null;
        continue;
      }
      const ts = new Date(g.end_date).getTime();
      if (!map[catalogId] || (map[catalogId] as number) < ts) map[catalogId] = ts;
    }
    return map;
  }, [allGroups, catalogIdByCourse]);

  const activeByCatalog = useMemo(() => {
    const map: Record<number, boolean> = {};
    for (const g of allGroups ?? []) {
      const catalogId = catalogIdByCourse[g.id_course as number];
      if (catalogId == null) continue;
      if (!map[catalogId]) map[catalogId] = isGroupActive(g);
    }
    return map;
  }, [allGroups, catalogIdByCourse]);

  const dataSource = useMemo(() => {
    return data
      .map(c => ({
        ...c,
        latest_group_end_date: latestGroupEndByCatalog[c.id_catalog_course] ?? null,
        is_active: activeByCatalog[c.id_catalog_course] ?? false,
      }))
      .sort((a, b) => (b.latest_group_end_date ?? 0) - (a.latest_group_end_date ?? 0)); // Más recientes primero
  }, [data, latestGroupEndByCatalog, activeByCatalog]);

  const columns = useMemo<ColumnsType<CatalogCourseRow>>(() => [
    {
      title: "Curso",
      dataIndex: "name",
      sorter: (a, b) => a.name.localeCompare(b.name),
      render: (name: string, record) => (
        <>
          {name}
          {record.hidden_from_filters && (
            <Tag color="default" style={{ marginLeft: 8 }} title="No aparece en los selects de filtro/búsqueda (Peticiones, Interesados)">
              Oculto de filtros
            </Tag>
          )}
        </>
      ),
    },
    { title: "Código", dataIndex: "internal_code", render: value => value || "-" },
    { title: "Especialidad SEPE", dataIndex: "sepe_specialty_code", render: value => value || "-" },
    { title: "Familia profesional", dataIndex: "professional_family", render: value => value || "-" },
    { title: "Ediciones", dataIndex: "editions_count", sorter: (a, b) => Number(a.editions_count ?? 0) - Number(b.editions_count ?? 0) },
    {
      title: "Fecha Fin Grupo",
      dataIndex: "latest_group_end_date",
      key: "group_end_date",
      render: (ts: number | null) => formatDate(ts),
      sorter: (a, b) => (b.latest_group_end_date ?? 0) - (a.latest_group_end_date ?? 0),
      defaultSortOrder: "ascend" as const,
    },
    {
      title: "Activo",
      dataIndex: "is_active",
      key: "active",
      render: (active: boolean) => <ActiveTag active={active} title="Según fechas y estado de los grupos de sus ediciones" />,
      sorter: (a, b) => Number(a.is_active) - Number(b.is_active),
    },
  ], []);
  const toolbar = <>
    <Input.Search placeholder="Buscar en el catálogo" value={search} onChange={event => setSearch(event.target.value)} style={{minWidth:260,flex:"0 1 360px"}} />
    <Button icon={<TeamOutlined />} onClick={() => navigate("/course-catalog/interests")}>Personas interesadas</Button>
    <AuthzHide roles={[Role.ADMIN]}><Button type="primary" icon={<PlusOutlined />} onClick={() => navigate("/course-catalog/create")}>Nuevo curso de catálogo</Button></AuthzHide>
  </>;
  return <ListPageLayout title="Catálogo de cursos" toolbar={toolbar}>
    <DataTable rowKey="id_catalog_course" columns={columns} dataSource={dataSource} loading={isLoading || isCoursesLoading || isGroupsLoading} getRowUrl={row => `/course-catalog/${row.id_catalog_course}`} />
  </ListPageLayout>;
}
