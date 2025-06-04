import { Button, Table, Input } from "antd";
import { useNavigate } from "react-router-dom";
import { useCoursesQuery } from "../../hooks/api/courses/use-courses.query";
import { PlusOutlined } from "@ant-design/icons"; // Importar los iconos
import { useEffect, useState } from "react";

export default function CoursesRoute() {
  const { data: coursesData, isLoading: isCoursesLoading } = useCoursesQuery();
  const [searchText, setSearchText] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "Cursos";
  }, []);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchText(e.target.value);
  };

  const filteredCourses = coursesData?.filter(course =>
    (course.course_name ?? "").toLowerCase().includes(searchText.toLowerCase()) ||
    (course.short_name ?? "").toLowerCase().includes(searchText.toLowerCase()) ||
    (course.moodle_id ? String(course.moodle_id) : "").toLowerCase().includes(searchText.toLowerCase())
  );

  return <div>
    <Input.Search 
      placeholder="Buscar cursos" 
      style={{ marginBottom: 16 }} 
      value={searchText}
      onChange={handleSearch}
    />
    <Button type="primary" onClick={() => navigate('/add-course')} icon={<PlusOutlined />}>Añadir Curso</Button>
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
        },
        {
          title: 'Fecha Fin',
          dataIndex: 'end_date',
          sorter: (a, b) => new Date(a.end_date ?? '').getTime() - new Date(b.end_date ?? '').getTime(),
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