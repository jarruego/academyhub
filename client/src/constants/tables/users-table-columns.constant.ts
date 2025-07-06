import { ColumnProps } from "antd/es/table";
import { User } from "../../shared/types/user/user";
import React from "react";
import { Progress } from "antd";

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
    { title: 'Centro',
      sorter: {
        compare: (a, b) => {
          const ca = a.centers?.find(c => c.is_main_center)?.center_name ?? a.centers?.[0]?.center_name ?? '-';
          const cb = b.centers?.find(c => c.is_main_center)?.center_name ?? b.centers?.[0]?.center_name ?? '-';
          return (ca || '').localeCompare(cb || '');
        }
      },
      render: (_, user) => (user.centers?.find(c => c.is_main_center)?.center_name ?? user.centers?.[0]?.center_name ?? '-') },
    { title: 'Empresa',
      sorter: {
        compare: (a, b) => {
          const ca = a.centers?.find(c => c.is_main_center)?.company_name ?? a.centers?.[0]?.company_name ?? '-';
          const cb = b.centers?.find(c => c.is_main_center)?.company_name ?? b.centers?.[0]?.company_name ?? '-';
          return (ca || '').localeCompare(cb || '');
        }
      },
      render: (_, user) => (user.centers?.find(c => c.is_main_center)?.company_name ?? user.centers?.[0]?.company_name ?? '-') },
]