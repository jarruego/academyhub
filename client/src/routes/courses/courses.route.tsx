import { Button, Table, Input, Tag } from "antd";
import { useNavigate } from "react-router-dom";
import { useCoursesQuery } from "../../hooks/api/courses/use-courses.query";
import { PlusOutlined } from "@ant-design/icons"; // Importar los iconos
import { useEffect, useState } from "react";
import { AuthzHide } from "../../components/permissions/authz-hide";
import { Role } from "../../hooks/api/auth/use-login.mutation";

export default function CoursesRoute() {
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
          sorter: (a, b) => a.id_course - b.id_course,
        },
        {
          title: 'ID Moodle',
          dataIndex: 'moodle_id',
          sorter: (a, b) => (a.moodle_id ?? 0) - (b.moodle_id ?? 0),
        },
        {
          title: 'Nombre',
          dataIndex: 'course_name',
          sorter: (a, b) => (a.course_name ?? '').localeCompare(b.course_name ?? ''),
        },
        {
          title: 'Nombre Corto',
          dataIndex: 'short_name',
          sorter: (a, b) => (a.short_name ?? '').localeCompare(b.short_name ?? ''),
        },
        {
          title: 'Fecha Inicio',
          dataIndex: 'start_date',
          sorter: (a, b) => new Date(a.start_date ?? '').getTime() - new Date(b.start_date ?? '').getTime(),
          render: (date) => date ? new Date(date).toLocaleDateString('es-ES') : '',
        },
        {
          title: 'Fecha Fin',
          dataIndex: 'end_date',
          sorter: (a, b) => new Date(a.end_date ?? '').getTime() - new Date(b.end_date ?? '').getTime(),
          render: (date) => date ? new Date(date).toLocaleDateString('es-ES') : '',
        },
        {
          title: 'Estado',
          dataIndex: 'end_date',
          sorter: (a, b) => {
            const today = new Date();
            const aActive = a.end_date ? new Date(a.end_date) >= new Date(today.getFullYear(), today.getMonth(), today.getDate()) : false;
            const bActive = b.end_date ? new Date(b.end_date) >= new Date(today.getFullYear(), today.getMonth(), today.getDate()) : false;
            // Activos primero
            if (aActive === bActive) return 0;
            return aActive ? -1 : 1;
          },
          render: (end_date) => {
            if (!end_date) return '';
            const today = new Date();
            const endDate = new Date(end_date);
            const isActive = endDate >= new Date(today.getFullYear(), today.getMonth(), today.getDate());
            return isActive ? (
              <Tag color="green">Activo</Tag>
            ) : (
              <Tag color="red">Finalizado</Tag>
            );
          },
        }
      ]} 
      dataSource={filteredCourses} 
      loading={isCoursesLoading}
      onRow={(record) => ({
        onDoubleClick: () => navigate(`/courses/${record.id_course}`),
        style: { cursor: 'pointer' }
      })}
    />
  </div>
}