import { Button, Table } from "antd";
import { useCoursesQuery } from "../hooks/api/courses/use-courses.query";

export default function CoursesRoute() {
  const { data: coursesData, isLoading: isCoursesLoading, isFetching: isCoursesRefetching, refetch: refetchCourses } = useCoursesQuery();

  return <div>
    <Button onClick={() => refetchCourses()} loading={isCoursesRefetching}>Refrescar</Button>
    <Table rowKey="id_course" columns={[
    {
      title: 'ID',
      dataIndex: 'id_course',
    },
    {
      title: 'Name',
      dataIndex: 'course_name',
    },
    {
      title: "Actions",
      render: () => <Button>Grupos</Button>
    }
  ]} dataSource={coursesData} loading={isCoursesLoading}/>
  </div>
}
