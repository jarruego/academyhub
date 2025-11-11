import { Button, Table, Input } from "antd";
import { useNavigate } from "react-router-dom";
import { useAllGroupsQuery } from "../../hooks/api/groups/use-all-groups.query";
import { useCoursesQuery } from "../../hooks/api/courses/use-courses.query";
import { PlusOutlined } from "@ant-design/icons";
import { useEffect, useMemo, useState } from "react";
import { Group } from "../../shared/types/group/group";
import { Course } from "../../shared/types/course/course";
import { AuthzHide } from "../../components/permissions/authz-hide";
import { Role } from "../../hooks/api/auth/use-login.mutation";

export default function GroupsRoute() {
  const { data: groupsData, isLoading: isGroupsLoading } = useAllGroupsQuery();
  const { data: coursesData, isLoading: isCoursesLoading } = useCoursesQuery();
  const [searchText, setSearchText] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "Grupos";
  }, []);

  const normalize = (str: string) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchText(e.target.value);
  };

  const normalizedSearch = normalize(searchText);

  // Build course id -> course name map for display
  const courseNameById = useMemo(() => {
    const map: Record<number, string> = {};
    (coursesData || []).forEach((c: Course) => map[c.id_course] = c.course_name ?? '');
    return map;
  }, [coursesData]);

  const filtered = (groupsData || []).filter(g => {
    const courseName = courseNameById[g.id_course] ?? '';
    return (
      normalize(g.group_name ?? '').includes(normalizedSearch) ||
      normalize(String(g.moodle_id ?? '')).includes(normalizedSearch) ||
      normalize(g.fundae_id ?? '').includes(normalizedSearch) ||
      normalize(courseName).includes(normalizedSearch)
    );
  }).slice().sort((a: Group, b: Group) => {
    const aTs = a.end_date ? new Date(a.end_date).getTime() : 0;
    const bTs = b.end_date ? new Date(b.end_date).getTime() : 0;
    return bTs - aTs;
  });

  return (
    <div>
      <Input.Search
        id="groups-search"
        placeholder="Buscar grupos"
        style={{ marginBottom: 16 }}
        value={searchText}
        onChange={handleSearch}
        aria-label="Buscar grupos"
      />

      <AuthzHide roles={[Role.ADMIN]}>
        <Button type="primary" onClick={() => navigate('/courses')} icon={<PlusOutlined />} style={{ marginBottom: 12 }}>Añadir Grupo</Button>
      </AuthzHide>

      <Table
        rowKey="id_group"
        columns={[
          {
            title: 'ID',
            dataIndex: 'id_group',
            sorter: (a: Group, b: Group) => a.id_group - b.id_group,
          },
          {
            title: 'ID Moodle',
            dataIndex: 'moodle_id',
            sorter: (a: Group, b: Group) => (a.moodle_id ?? 0) - (b.moodle_id ?? 0),
          },
          {
            title: 'Nombre',
            dataIndex: 'group_name',
            sorter: (a: Group, b: Group) => (a.group_name ?? '').localeCompare(b.group_name ?? ''),
          },
          {
            title: 'Curso',
            dataIndex: 'id_course',
            render: (id: number) => courseNameById[id] ?? '',
            sorter: (a: Group, b: Group) => (courseNameById[a.id_course] ?? '').localeCompare(courseNameById[b.id_course] ?? ''),
          },
          {
            title: 'Inicio',
            dataIndex: 'start_date',
            render: (d: Date | null) => d ? new Date(d).toLocaleDateString('es-ES') : '',
            sorter: (a: Group, b: Group) => ((b.start_date ? new Date(b.start_date).getTime() : 0) - (a.start_date ? new Date(a.start_date).getTime() : 0)),
          },
          {
            title: 'Fin',
            dataIndex: 'end_date',
            render: (d: Date | null) => d ? new Date(d).toLocaleDateString('es-ES') : '',
            sorter: (a: Group, b: Group) => ((b.end_date ? new Date(b.end_date).getTime() : 0) - (a.end_date ? new Date(a.end_date).getTime() : 0)),
          },
          {
            title: 'FUNDAE',
            dataIndex: 'fundae_id',
            sorter: (a: Group, b: Group) => (a.fundae_id ?? '').localeCompare(b.fundae_id ?? ''),
          },
        ]}
        dataSource={filtered}
        loading={isGroupsLoading || isCoursesLoading}
        onRow={(record) => ({
          onDoubleClick: () => {
            try {
              const url = `${window.location.origin}/groups/${record.id_group}/edit`;
              window.open(url, '_blank', 'noopener,noreferrer');
            } catch (e) {
              // fallback: use relative path
              window.open(`/groups/${record.id_group}/edit`, '_blank');
            }
          },
          style: { cursor: 'pointer' }
        })}
      />
    </div>
  );
}
