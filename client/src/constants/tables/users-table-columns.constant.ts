import { ColumnProps } from "antd/es/table";
import { User } from "../../shared/types/user/user";

export const USERS_TABLE_COLUMNS: ColumnProps<User>[] = [
    { title: 'ID', dataIndex: ['id_user'], sorter: {
        compare: (a, b) =>  a.id_user > b.id_user ? 1 : -1,
        multiple: 1,
    },}, // Caso para dato numérico
    { title: 'Nombre', dataIndex: ['name'], sorter: {
        compare: (a,b) => a.name.localeCompare(b.name),
        multiple: 2
    } }, // Caso para texto
    { title: 'Apellidos', dataIndex: ['first_surname'] },
    { title: 'Email', dataIndex: ['email'] },
    { title: 'MOODLE USERNAME', dataIndex: ['moodle_username'] },
    { title: 'Porcentaje', dataIndex: ['completion_percentage'] },
    { title: 'Centro', render: (_, user) => (user.centers?.find(c => c.is_main_center)?.center_name ?? user.centers?.[0]?.center_name ?? '-') },
    { title: 'Empresa', render: (_, user) => (user.centers?.find(c => c.is_main_center)?.company_name ?? user.centers?.[0]?.company_name ?? '-') },
]