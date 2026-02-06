import { ColumnProps } from "antd/es/table";
import { User } from "../../shared/types/user/user";
import { UserCenter } from "../../shared/types/center/user-center";
import React from "react";
import { Progress } from "antd";
// Use the existing `UserCenter` type (includes is_main_center) and add the
// optional `is_enrollment_center` flag that the backend may include.
type Center = UserCenter & { is_enrollment_center?: boolean };

const formatTimeSpent = (value?: number | null) => {
  if (value === null || value === undefined) return '-';
  const total = Number(value);
  if (!Number.isFinite(total) || total < 0) return '-';
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = Math.floor(total % 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
};

export const USERS_TABLE_COLUMNS: ColumnProps<User>[] = [
    // { title: 'ID', dataIndex: ['id_user'], sorter: {
    //     compare: (a, b) =>  a.id_user > b.id_user ? 1 : -1,
    //     multiple: 1,
    // },}, 
    { title: 'Nombre', dataIndex: ['name'], sorter: {
        compare: (a,b) => a.name.localeCompare(b.name),
        multiple: 2
    } }, 
    { title: 'Apellidos', dataIndex: ['first_surname'], sorter: {
        compare: (a, b) => (a.first_surname || '').localeCompare(b.first_surname || ''),
    } },
  { title: 'Rol', dataIndex: ['role_shortname'], sorter: {
    compare: (a, b) => (a.role_shortname || '').localeCompare(b.role_shortname || ''),
  }, render: (_: unknown, user: User) => (user.role_shortname ?? (user.id_role ? String(user.id_role) : '-')) },
    // { title: 'Email', dataIndex: ['email'], sorter: {
    //     compare: (a, b) => (a.email || '').localeCompare(b.email || ''),
    // } },
    // { title: 'MOODLE USERNAME', dataIndex: ['moodle_username'], sorter: {
    //     compare: (a, b) => (a.moodle_username || '').localeCompare(b.moodle_username || ''),
    // } },
    { title: 'Porcentaje', dataIndex: ['completion_percentage'], sorter: {
        compare: (a, b) => (Number(a.completion_percentage) || 0) - (Number(b.completion_percentage) || 0),
    }, render: (_: unknown, user: User) => {
        const percent = Number(user.completion_percentage) || 0;
        return React.createElement(Progress, {
            percent,
            size: "small",
            style: { minWidth: 80 },
            strokeColor: percent >= 75 ? '#52c41a' : '#ff4d4f',
        });
    } },
    { title: 'Tiempo usado', dataIndex: ['time_spent'], sorter: {
      compare: (a, b) => (Number(a.time_spent) || 0) - (Number(b.time_spent) || 0),
    }, render: (_: unknown, user: User) => formatTimeSpent(user.time_spent) },
  { title: 'Centro',
      sorter: {
        compare: (a, b) => {
          const pick = (u: User) => u.centers?.find((c: Center) => c.is_enrollment_center) ?? u.centers?.find((c: Center) => c.is_main_center) ?? u.centers?.[0];
          const ca = pick(a)?.center_name ?? '-';
          const cb = pick(b)?.center_name ?? '-';
          return (ca || '').localeCompare(cb || '');
        }
      },
      render: (_, user) => {
        const center = user.centers?.find((c: Center) => c.is_enrollment_center) ?? user.centers?.find((c: Center) => c.is_main_center) ?? user.centers?.[0];
        return center?.center_name ?? '-';
      } },
    { title: 'Empresa',
      sorter: {
        compare: (a, b) => {
          const pick = (u: User) => u.centers?.find((c: Center) => c.is_enrollment_center) ?? u.centers?.find((c: Center) => c.is_main_center) ?? u.centers?.[0];
          const ca = pick(a)?.company_name ?? '-';
          const cb = pick(b)?.company_name ?? '-';
          return (ca || '').localeCompare(cb || '');
        }
      },
      render: (_, user) => {
        const center = user.centers?.find((c: Center) => c.is_enrollment_center) ?? user.centers?.find((c: Center) => c.is_main_center) ?? user.centers?.[0];
        return center?.company_name ?? '-';
      } },
]