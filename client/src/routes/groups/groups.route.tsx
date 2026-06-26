import { Button, Input, Tag, Tooltip } from "antd";
import { useNavigate } from "react-router-dom";
import { useAllGroupsQuery } from "../../hooks/api/groups/use-all-groups.query";
import { useCoursesQuery } from "../../hooks/api/courses/use-courses.query";
import { PlusOutlined } from "@ant-design/icons";
import { useEffect, useMemo, useState } from "react";
import { Group } from "../../shared/types/group/group";
import { Course } from "../../shared/types/course/course";
import { AuthzHide } from "../../components/permissions/authz-hide";
import { Role } from "../../hooks/api/auth/use-login.mutation";
import { isGroupActive } from "../../utils/group-active.util";
import { DataTable } from "../../components/common/DataTable";
import { ActiveTag } from "../../components/common/tags";
import { formatDate } from "../../utils/format";
import { normalizeLoose, matchesLoose } from "../../utils/normalize-search";
import { FLAG_COLORS } from "../../theme/semantic-colors";

export default function GroupsRoute() {
  const { data: groupsData, isLoading: isGroupsLoading } = useAllGroupsQuery();
  const { data: coursesData, isLoading: isCoursesLoading } = useCoursesQuery();
  const [searchText, setSearchText] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "Grupos";
  }, []);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchText(e.target.value);
  };

  const normalizedSearch = normalizeLoose(searchText);

  // Build course id -> course name map for display
  const courseNameById = useMemo(() => {
    const map: Record<number, string> = {};
    (coursesData || []).forEach((c: Course) => map[c.id_course] = c.course_name ?? '');
    return map;
  }, [coursesData]);

  const filtered = (groupsData || []).filter(g =>
    matchesLoose(normalizedSearch, [g.group_name, g.moodle_id, g.fundae_id, courseNameById[g.id_course]])
  ).slice().sort((a: Group, b: Group) => {
    const aTs = a.end_date ? new Date(a.end_date).getTime() : 0;
    const bTs = b.end_date ? new Date(b.end_date).getTime() : 0;
    return bTs - aTs;
  });

  return (
    <div>
      <div className="list-controls">
        <Input.Search
          id="groups-search"
          placeholder="Buscar grupos"
          style={{ minWidth: 260 }}
          value={searchText}
          onChange={handleSearch}
          aria-label="Buscar grupos"
        />
        <AuthzHide roles={[Role.ADMIN]}>
          <Button type="primary" onClick={() => navigate('/courses')} icon={<PlusOutlined />}>Añadir Grupo</Button>
        </AuthzHide>
      </div>

      <DataTable<Group>
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
            render: (text: string) => {
              if (!text) return '';
              return text.length > 25
                ? <Tooltip title={text}><span>{text.slice(0, 25)}…</span></Tooltip>
                : text;
            },
            sorter: (a: Group, b: Group) => (a.group_name ?? '').localeCompare(b.group_name ?? ''),
          },
          {
            title: 'Curso',
            dataIndex: 'id_course',
            render: (id: number) => {
              const text = courseNameById[id] ?? '';
              if (!text) return '';
              return text.length > 45
                ? <Tooltip title={text}><span>{text.slice(0, 45)}…</span></Tooltip>
                : text;
            },
            sorter: (a: Group, b: Group) => (courseNameById[a.id_course] ?? '').localeCompare(courseNameById[b.id_course] ?? ''),
          },
          {
            title: 'Inicio',
            dataIndex: 'start_date',
            render: (d: Date | null) => formatDate(d),
            sorter: (a: Group, b: Group) => ((b.start_date ? new Date(b.start_date).getTime() : 0) - (a.start_date ? new Date(a.start_date).getTime() : 0)),
          },
          {
            title: 'Fin',
            dataIndex: 'end_date',
            render: (d: Date | null) => formatDate(d),
            sorter: (a: Group, b: Group) => ((b.end_date ? new Date(b.end_date).getTime() : 0) - (a.end_date ? new Date(a.end_date).getTime() : 0)),
          },
          {
            title: 'FUNDAE',
            dataIndex: 'fundae_id',
            sorter: (a: Group, b: Group) => (a.fundae_id ?? '').localeCompare(b.fundae_id ?? ''),
          },
          {
            title: 'Estado',
            key: 'active',
            render: (_: unknown, record: Group) => {
              const active = isGroupActive(record);
              const forced = record.active_mode && record.active_mode !== 'auto';
              return (
                <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
                  <ActiveTag active={active} />
                  {forced && <Tag color={FLAG_COLORS.manual}>Manual</Tag>}
                </span>
              );
            },
            sorter: (a: Group, b: Group) => Number(isGroupActive(a)) - Number(isGroupActive(b)),
          },
        ]}
        dataSource={filtered}
        loading={isGroupsLoading || isCoursesLoading}
        getRowUrl={(record) => `/groups/${record.id_group}/edit`}
      />
    </div>
  );
}
