import { Button, Table } from "antd";
import { useNavigate } from "react-router-dom";
import { useCoursesQuery } from "../hooks/api/courses/use-courses.query";
import { PlusOutlined, ReloadOutlined } from "@ant-design/icons"; // Importar los iconos

export default function CoursesRoute() {
  const { data: coursesData, isLoading: isCoursesLoading, isFetching: isCoursesRefetching, refetch: refetchCourses } = useCoursesQuery();
  const navigate = useNavigate();

  return <div>
    <Button type="primary" onClick={() => navigate('/add-course')} icon={<PlusOutlined />}>Añadir Curso</Button>
    <Button onClick={() => refetchCourses()} loading={isCoursesRefetching} icon={<ReloadOutlined />}>Refrescar</Button>
    <Table 
      rowKey="id_course" 
      columns={[
        {
          title: 'ID',
          dataIndex: 'id_course',
        },
        {
          title: 'ID Moodle',
          dataIndex: 'moodle_id',
        },
        {
          title: 'Nombre',
          dataIndex: 'course_name',
        },
        {
          title: 'Nombre Corto',
          dataIndex: 'short_name',
        },
        {
          title: 'Fecha Inicio',
          dataIndex: 'start_date',
        },
        {
          title: 'Fecha Fin',
          dataIndex: 'end_date',
        }
      ]} 
      dataSource={coursesData} 
      loading={isCoursesLoading}
      onRow={(record) => ({
        onDoubleClick: () => navigate(`/courses/${record.id_course}`),
        style: { cursor: 'pointer' }
      })}
    />
  </div>
}