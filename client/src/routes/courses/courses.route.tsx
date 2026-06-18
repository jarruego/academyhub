import { Button, Table, Input, Tag, Segmented } from "antd";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useCoursesQuery } from "../../hooks/api/courses/use-courses.query";
import { PlusOutlined } from "@ant-design/icons"; // Importar los iconos
import { useAllGroupsQuery } from "../../hooks/api/groups/use-all-groups.query";
import { useEffect, useState, useMemo } from "react";
import { Course } from "../../shared/types/course/course";
import { CourseOrigin } from "../../shared/types/course/course-origin.enum";
import { CourseFunding } from "../../shared/types/course/course-funding.enum";
import { AuthzHide } from "../../components/permissions/authz-hide";
import { Role } from "../../hooks/api/auth/use-login.mutation";
import { isGroupActive } from "../../utils/group-active.util";
import type { ColumnsType } from "antd/es/table";

// Pestañas de tipología. Cada una es un predicado sobre el curso ya cargado
// (el filtrado es en cliente, coherente con la búsqueda y el estado activo que
// también se calculan aquí; los filtros server-side existen para uso por API).
type CourseTab = "todos" | "fundae" | "inaem" | "privada" | "sin_clasificar";

const TAB_OPTIONS: { label: string; value: CourseTab }[] = [
  { label: "Todos", value: "todos" },
  { label: "FUNDAE", value: "fundae" },
  { label: "INAEM", value: "inaem" },
  { label: "Privada", value: "privada" },
  { label: "Sin clasificar", value: "sin_clasificar" },
];

const TAB_PREDICATE: Record<CourseTab, (c: Course) => boolean> = {
  todos: () => true,
  fundae: (c) => c.funding === CourseFunding.FUNDAE,
  inaem: (c) => c.origin === CourseOrigin.INAEM,
  // Privada = mercado no bonificado (las bonificadas viven en la pestaña FUNDAE).
  privada: (c) => c.origin === CourseOrigin.PRIVADA && c.funding !== CourseFunding.FUNDAE,
  sin_clasificar: (c) => !c.origin,
};

const isCourseTab = (v: string | null): v is CourseTab =>
  !!v && TAB_OPTIONS.some((o) => o.value === v);

export default function CoursesRoute() {

  // We'll fetch all groups once and compute latest end_date per course to enable sorting
  const { data: allGroups, isLoading: isAllGroupsLoading } = useAllGroupsQuery();
  const { data: coursesData, isLoading: isCoursesLoading } = useCoursesQuery();
  const [searchText, setSearchText] = useState("");
  const navigate = useNavigate();

  // Pestaña activa persistida en la URL (?tab=) para enlaces compartibles.
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab: CourseTab = isCourseTab(searchParams.get("tab")) ? (searchParams.get("tab") as CourseTab) : "todos";
  const setActiveTab = (tab: CourseTab) => {
    const next = new URLSearchParams(searchParams);
    if (tab === "todos") next.delete("tab");
    else next.set("tab", tab);
    setSearchParams(next, { replace: true });
  };

  useEffect(() => {
    document.title = "Cursos";
  }, []);

  const normalize = (str: string) => str.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchText(e.target.value);
  };

  const normalizedSearch = normalize(searchText);

  const filteredCourses = coursesData?.filter(course =>
    TAB_PREDICATE[activeTab](course) && (
      normalize(course.course_name ?? '').includes(normalizedSearch) ||
      normalize(course.short_name ?? '').includes(normalizedSearch) ||
      normalize(course.file_number ?? '').includes(normalizedSearch) ||
      normalize(course.moodle_id ? String(course.moodle_id) : '').includes(normalizedSearch)
    )
  )?.slice().sort((a, b) => {
    const aDate = a.end_date ? new Date(a.end_date).getTime() : 0;
    const bDate = b.end_date ? new Date(b.end_date).getTime() : 0;
    return bDate - aDate; // Descendente: más recientes primero
  });

  // Map course id -> latest group end timestamp
  const latestGroupEndByCourse = useMemo(() => {
    const map: Record<number, number | null> = {};
    if (!allGroups) return map;
    for (const g of allGroups) {
      const courseId = g.id_course as number;
      if (!g.end_date) {
        if (typeof map[courseId] === 'undefined') map[courseId] = null;
        continue;
      }
      const ts = new Date(g.end_date).getTime();
      if (!map[courseId] || (map[courseId] as number) < ts) {
        map[courseId] = ts;
      }
    }
    return map;
  }, [allGroups]);

  // Map course id -> active (a course is active if it has at least one active group)
  const activeByCourse = useMemo(() => {
    const map: Record<number, boolean> = {};
    if (!allGroups) return map;
    for (const g of allGroups) {
      const courseId = g.id_course as number;
      if (!map[courseId]) map[courseId] = isGroupActive(g);
    }
    return map;
  }, [allGroups]);

  // Build dataSource enriched with latest_group_end_date for sorting and display
  type CourseRow = Course & { latest_group_end_date?: number | null; is_active?: boolean };

  const dataSource = useMemo(() => {
    return (filteredCourses || []).map(c => ({
      ...c,
      latest_group_end_date: latestGroupEndByCourse[c.id_course] ?? null,
      is_active: activeByCourse[c.id_course] ?? false,
    })) as CourseRow[];
  }, [filteredCourses, latestGroupEndByCourse, activeByCourse]);

  // Conteo por pestaña para mostrar el nº de cursos en cada una.
  const tabCounts = useMemo(() => {
    const counts = {} as Record<CourseTab, number>;
    for (const opt of TAB_OPTIONS) counts[opt.value] = 0;
    for (const c of coursesData ?? []) {
      for (const opt of TAB_OPTIONS) if (TAB_PREDICATE[opt.value](c)) counts[opt.value]++;
    }
    return counts;
  }, [coursesData]);

  // Columnas según la pestaña: se ocultan las redundantes (Origen en pestañas de
  // un solo origen; Nº Exp. fuera de INAEM; Financiación fuera de Todos/Privada).
  const columns = useMemo<ColumnsType<CourseRow>>(() => {
    const idCol = { title: 'ID', dataIndex: 'id_course', sorter: (a: CourseRow, b: CourseRow) => a.id_course - b.id_course };
    const moodleCol = { title: 'ID Moodle', dataIndex: 'moodle_id', sorter: (a: CourseRow, b: CourseRow) => (a.moodle_id ?? 0) - (b.moodle_id ?? 0) };
    const nameCol = { title: 'Nombre', dataIndex: 'course_name', sorter: (a: CourseRow, b: CourseRow) => (a.course_name ?? '').localeCompare(b.course_name ?? '') };
    const shortCol = { title: 'Nombre Corto', dataIndex: 'short_name', sorter: (a: CourseRow, b: CourseRow) => (a.short_name ?? '').localeCompare(b.short_name ?? '') };

    const expedienteCol = {
      title: 'Nº Exp.',
      dataIndex: 'file_number',
      render: (v: string | null, record: CourseRow) => (
        <span>
          {v || '-'}
          {record.is_provisional ? <Tag color="orange" style={{ marginLeft: 6 }}>Provisional</Tag> : null}
        </span>
      ),
      sorter: (a: CourseRow, b: CourseRow) => (a.file_number ?? '').localeCompare(b.file_number ?? ''),
    };

    const originCol = {
      title: 'Origen',
      dataIndex: 'origin',
      key: 'origin',
      render: (origin: string | null) => {
        if (!origin) return '-';
        const color = origin === 'INAEM' ? 'geekblue' : origin === 'PRIVADA' ? 'green' : 'default';
        return <Tag color={color}>{origin}</Tag>;
      },
    };

    const fundingCol = {
      title: 'Financiación',
      dataIndex: 'funding',
      key: 'funding',
      render: (funding: string | null) => {
        if (!funding) return '-';
        const color = funding === 'FUNDAE' ? 'gold' : funding === 'PUBLICA' ? 'geekblue' : 'blue';
        return <Tag color={color}>{funding}</Tag>;
      },
    };

    const groupEndCol = {
      title: 'Fecha Fin Grupo',
      dataIndex: 'latest_group_end_date',
      key: 'group_end_date',
      render: (ts: number | null) => ts ? new Date(ts).toLocaleDateString('es-ES') : '',
      sorter: (a: CourseRow, b: CourseRow) => ((b.latest_group_end_date ?? 0) - (a.latest_group_end_date ?? 0)),
      defaultSortOrder: 'ascend' as const,
    };

    const stateCol = {
      title: 'Estado',
      dataIndex: 'is_active',
      key: 'active',
      render: (active: boolean) => <Tag color={active ? 'green' : 'red'}>{active ? 'Activo' : 'Inactivo'}</Tag>,
      sorter: (a: CourseRow, b: CourseRow) => Number(a.is_active) - Number(b.is_active),
    };

    const cols: ColumnsType<CourseRow> = [idCol, moodleCol, nameCol, shortCol];
    if (activeTab === 'inaem' || activeTab === 'todos' || activeTab === 'sin_clasificar') cols.push(expedienteCol);
    if (activeTab === 'todos' || activeTab === 'sin_clasificar') cols.push(originCol);
    if (activeTab === 'todos' || activeTab === 'privada') cols.push(fundingCol);
    cols.push(groupEndCol, stateCol);
    return cols;
  }, [activeTab]);

  return <div>
    <Segmented<CourseTab>
      options={TAB_OPTIONS.map(o => ({ label: `${o.label} (${tabCounts[o.value] ?? 0})`, value: o.value }))}
      value={activeTab}
      onChange={setActiveTab}
      style={{ marginBottom: 16 }}
    />
    <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
      <Input.Search
        id="courses-search"
        placeholder="Buscar cursos"
        style={{ minWidth: 260, flex: '0 1 320px' }}
        value={searchText}
        onChange={handleSearch}
        aria-label="Buscar cursos"
      />
      <AuthzHide roles={[Role.ADMIN]}>
        <Button type="primary" onClick={() => navigate('/add-course')} icon={<PlusOutlined />}>Añadir Curso</Button>
      </AuthzHide>
    </div>
    <Table
      rowKey="id_course"
      columns={columns}
      dataSource={dataSource}
      loading={isCoursesLoading || isAllGroupsLoading}
      onRow={(record) => ({
        onClick: () => navigate(`/courses/${record.id_course}`),
        style: { cursor: 'pointer' }
      })}
    />
  </div>
}
