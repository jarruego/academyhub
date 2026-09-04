import { useMemo, useState } from "react";
import { Input, Select, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import { Link } from "react-router-dom";
import dayjs from "dayjs";
import { DataTable } from "../../components/common/DataTable";
import { ListPageLayout } from "../../components/common/ListPageLayout";
import { useCourseCatalogQuery } from "../../hooks/api/course-catalog/use-course-catalog.query";
import { useCourseInterestsQuery } from "../../hooks/api/course-interests/use-course-interests";
import type { CourseInterest, InterestStatus } from "../../shared/types/course-interest/course-interest";
import { matchesLoose, normalizeLoose } from "../../utils/normalize-search";

const STATUSES: InterestStatus[] = ["INTERESADO", "CONTACTADO", "CONVOCADO", "MATRICULADO", "DESCARTADO"];
const STATUS_COLOR: Record<InterestStatus, string> = {
  INTERESADO: "blue", CONTACTADO: "gold", CONVOCADO: "purple", MATRICULADO: "green", DESCARTADO: "default",
};
const label = (value: string) => value.toLowerCase().replace(/_/g, " ").replace(/^./, c => c.toUpperCase());
const fullName = (r: CourseInterest) => [r.name, r.first_surname, r.second_surname].filter(Boolean).join(" ");

export default function CourseInterestsRoute() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<InterestStatus>();
  const [catalogCourseId, setCatalogCourseId] = useState<number>();
  const { data: catalogCourses = [] } = useCourseCatalogQuery();
  const { data = [], isLoading } = useCourseInterestsQuery({ status, id_catalog_course: catalogCourseId });

  const filtered = useMemo(() => {
    const term = normalizeLoose(search);
    if (!term) return data;
    return data.filter(row => matchesLoose(term, [fullName(row), row.dni]));
  }, [data, search]);

  const columns: ColumnsType<CourseInterest> = [
    { title: "Curso", dataIndex: "catalog_course_name", sorter: (a, b) => a.catalog_course_name.localeCompare(b.catalog_course_name) },
    { title: "Persona", render: (_, r) => <Link to={`/users/${r.id_user}`}>{fullName(r)}</Link> },
    { title: "DNI", dataIndex: "dni", render: value => value || "-" },
    { title: "Teléfono", dataIndex: "phone", render: value => value || "-" },
    { title: "Estado", dataIndex: "status", render: value => <Tag color={STATUS_COLOR[value as InterestStatus]}>{label(value)}</Tag> },
    { title: "Origen", dataIndex: "source", render: value => value ? label(value) : "-" },
    { title: "Fecha", dataIndex: "interest_date", render: value => value ? dayjs(value).format("DD/MM/YYYY") : "-", sorter: (a, b) => (a.interest_date ?? "").localeCompare(b.interest_date ?? "") },
  ];

  const toolbar = <>
    <Input.Search placeholder="Buscar por nombre o DNI" value={search} onChange={event => setSearch(event.target.value)} style={{ minWidth: 220, flex: "0 1 300px" }} />
    <Select allowClear placeholder="Curso de catálogo" style={{ minWidth: 220 }} value={catalogCourseId} onChange={setCatalogCourseId}
      showSearch optionFilterProp="label" options={catalogCourses.map(item => ({ value: item.id_catalog_course, label: item.name }))} />
    <Select allowClear placeholder="Estado" style={{ minWidth: 160 }} value={status} onChange={setStatus}
      options={STATUSES.map(value => ({ value, label: label(value) }))} />
  </>;

  return <ListPageLayout title="Personas interesadas" toolbar={toolbar}>
    <DataTable rowKey="id_interest" columns={columns} dataSource={filtered} loading={isLoading} getRowUrl={row => `/course-catalog/${row.id_catalog_course}`} />
  </ListPageLayout>;
}
