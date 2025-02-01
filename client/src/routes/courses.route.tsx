import { Button, Table } from "antd";
import { useNavigate } from "react-router-dom";
import { useCoursesQuery } from "../hooks/api/courses/use-courses.query";

export default function CoursesRoute() {
  const { data: coursesData, isLoading: isCoursesLoading, isFetching: isCoursesRefetching, refetch: refetchCourses } = useCoursesQuery();
  const navigate = useNavigate();

  return <div>
    <Button type="primary" onClick={() => navigate('/add-course')}>Añadir Curso</Button>
    <Button onClick={() => refetchCourses()} loading={isCoursesRefetching}>Refrescar</Button>
    <Table rowKey="id_course" columns={[
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
    },
    {
      title: "Actions",
      render: (_, record) => <Button onClick={() => navigate(`/courses/${record.id_course}`)}>Ver</Button>
    }
  ]} dataSource={coursesData} loading={isCoursesLoading}/>
  </div>
}