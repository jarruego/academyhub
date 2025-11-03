import { Button, Table, Input } from "antd";
import { useNavigate } from "react-router-dom";
import { useCoursesQuery } from "../../hooks/api/courses/use-courses.query";
import { PlusOutlined } from "@ant-design/icons"; // Importar los iconos
import { useAllGroupsQuery } from "../../hooks/api/groups/use-all-groups.query";
import { useEffect, useState, useMemo } from "react";
import { Course } from "../../shared/types/course/course";
import { AuthzHide } from "../../components/permissions/authz-hide";
import { Role } from "../../hooks/api/auth/use-login.mutation";

export default function CoursesRoute() {
  
  // We'll fetch all groups once and compute latest end_date per course to enable sorting
  const { data: allGroups, isLoading: isAllGroupsLoading } = useAllGroupsQuery();
  const { data: coursesData, isLoading: isCoursesLoading } = useCoursesQuery();
  const [searchText, setSearchText] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "Cursos";
  }, []);

  const normalize = (str: string) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchText(e.target.value);
  };

  const normalizedSearch = normalize(searchText);

  const filteredCourses = coursesData?.filter(course =>
    normalize(course.course_name ?? '').includes(normalizedSearch) ||
    normalize(course.short_name ?? '').includes(normalizedSearch) ||
    normalize(course.moodle_id ? String(course.moodle_id) : '').includes(normalizedSearch)
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

  // Build dataSource enriched with latest_group_end_date for sorting and display
  type CourseRow = Course & { latest_group_end_date?: number | null };

  const dataSource = useMemo(() => {
    return (filteredCourses || []).map(c => ({
      ...c,
      latest_group_end_date: latestGroupEndByCourse[c.id_course] ?? null,
    })) as CourseRow[];
  }, [filteredCourses, latestGroupEndByCourse]);

  return <div>
    <Input.Search 
      id="courses-search"
      placeholder="Buscar cursos" 
      style={{ marginBottom: 16 }} 
      value={searchText}
      onChange={handleSearch}
      aria-label="Buscar cursos"
    />
    <AuthzHide roles={[Role.ADMIN]}>
    <Button type="primary" onClick={() => navigate('/add-course')} icon={<PlusOutlined />}>Añadir Curso</Button>
    </AuthzHide>
    <Table 
      rowKey="id_course" 
      columns={[
        {
          title: 'ID',
          dataIndex: 'id_course',
          sorter: (a: CourseRow, b: CourseRow) => a.id_course - b.id_course,
        },
        {
          title: 'ID Moodle',
          dataIndex: 'moodle_id',
          sorter: (a: CourseRow, b: CourseRow) => (a.moodle_id ?? 0) - (b.moodle_id ?? 0),
        },
        {
          title: 'Nombre',
          dataIndex: 'course_name',
          sorter: (a: CourseRow, b: CourseRow) => (a.course_name ?? '').localeCompare(b.course_name ?? ''),
        },
        {
          title: 'Nombre Corto',
          dataIndex: 'short_name',
          sorter: (a: CourseRow, b: CourseRow) => (a.short_name ?? '').localeCompare(b.short_name ?? ''),
        },
        {
          title: 'Fecha Fin Grupo',
          dataIndex: 'latest_group_end_date',
          key: 'group_end_date',
          render: (ts: number | null) => ts ? new Date(ts).toLocaleDateString('es-ES') : '',
          sorter: (a: CourseRow, b: CourseRow) => ( (b.latest_group_end_date ?? 0) - (a.latest_group_end_date ?? 0) ),
          defaultSortOrder: 'ascend',
        },
      ]} 
      dataSource={dataSource} 
      loading={isCoursesLoading || isAllGroupsLoading}
      onRow={(record) => ({
        onDoubleClick: () => navigate(`/courses/${record.id_course}`),
        style: { cursor: 'pointer' }
      })}
    />
  </div>
}