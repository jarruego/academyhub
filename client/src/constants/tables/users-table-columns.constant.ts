import { ColumnProps } from "antd/es/table";

export const USERS_TABLE_COLUMNS: ColumnProps[] = [
    { title: 'ID', dataIndex: ['id_user'] },
    { title: 'Nombre', dataIndex: ['name'] },
    { title: 'Apellidos', dataIndex: ['first_surname'] },
    { title: 'Email', dataIndex: ['email'] },
    { title: 'MOODLE USERNAME', dataIndex: ['username'] },
    { title: 'Porcentaje', dataIndex: ['completion_percentage'] },
]