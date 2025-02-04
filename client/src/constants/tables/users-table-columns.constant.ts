import { ColumnProps } from "antd/es/table";

export const USERS_TABLE_COLUMNS: ColumnProps[] = [
    { title: 'ID', dataIndex: ['id_user'] },
    { title: 'Nombre', dataIndex: ['name'] },
    { title: 'Apellidos', dataIndex: ['surname'] },
    { title: 'Email', dataIndex: ['email'] },
    { title: 'MOODLE USERNAME', dataIndex: ['moodle_username'] },
]