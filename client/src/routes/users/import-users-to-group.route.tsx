import { useParams, useNavigate } from "react-router-dom";
import { Button, Upload, message, Table } from "antd";
import { UploadOutlined } from "@ant-design/icons";
import * as XLSX from "xlsx";
import { useState, useEffect } from "react";
import { UserImportTemplate } from "../../shared/types/user/user-import-template";
import { User } from "../../shared/types/user/user";
import { useBulkCreateAndAddToGroupMutation } from "../../hooks/api/users/use-bulk-create-and-add-to-group.mutation";
import { useUsersQuery } from "../../hooks/api/users/use-users.query";

export default function ImportUsersToGroupRoute() {
  const { id_group } = useParams();
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserImportTemplate[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const { mutateAsync: bulkCreateAndAddToGroup } = useBulkCreateAndAddToGroupMutation();
  const { data: existingUsers } = useUsersQuery();

  useEffect(() => {
    if (existingUsers && users.length > 0) {
      const updatedUsers = users.map(user => {
        const dbUser = existingUsers.find(dbUser => dbUser.dni === user.DNI);
        const existsInDB = !!dbUser;
        return { ...user, existsInDB, dbUser };
      });

      // Verificar si los usuarios actualizados son diferentes antes de llamar a setUsers
      // Esto evita un bucle infinito de actualizaciones
      const isDifferent = JSON.stringify(updatedUsers) !== JSON.stringify(users);
      if (isDifferent) {
        setUsers(updatedUsers);
      }
    }
  }, [existingUsers, users]); 

  const handleUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      if (!e.target) {
        message.error("Error al leer el archivo");
        return;
      }
      const data = new Uint8Array(e.target.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json<UserImportTemplate>(sheet);
      setUsers(jsonData);
    };
    reader.readAsArrayBuffer(file);
    return false; // Evitar la subida automática del archivo
  };

  const handleImportUsers = async () => {
    try {
      const usersToCreate = selectedUserIds.map((userId) => {
        const user = users.find((user) => user.DNI === userId);
        if (user) {
          return {
            dni: user.DNI,
            name: user.NOMBRE,
            first_surname: user.AP1,
            second_surname: user.AP2,
            email: user.email,
            phone: user.movil.toString(),
          } as Omit<User, 'id_user'>;
        }
        return null;
      }).filter(user => user !== null);
      if (id_group) {
        await bulkCreateAndAddToGroup({ users: usersToCreate, id_group: parseInt(id_group, 10) });
      } else {
        message.error("ID de grupo no válido");
      }
      navigate(`/groups/${id_group}/edit`);
    } catch (error) {
      message.error(`No se pudo importar a los usuarios: ${(error as Error).message}`);
    }
  };

  const rowSelection = {
    selectedRowKeys: selectedUserIds,
    onChange: (selectedRowKeys: React.Key[]) => {
      setSelectedUserIds(selectedRowKeys as string[]);
    },
  };

  return (
    <div>
      <h1>Importación de Usuarios a Grupo {id_group}</h1>
      <Upload beforeUpload={handleUpload}>
        <Button icon={<UploadOutlined />}>Seleccionar Archivo</Button>
      </Upload>
      <Table
        rowKey="DNI" //TODO: Cambiar por el identificador único
        sortDirections={['ascend', 'descend']}
        columns={[
          { title: "BD", dataIndex: "existsInDB", render: (text) => text ? 'Sí' : 'No' },
          { title: "Nombre", dataIndex: "NOMBRE", sorter: (a, b) => a.NOMBRE.localeCompare(b.NOMBRE) },
          { title: "Apellido 1", dataIndex: "AP1", sorter: (a, b) => a.AP1.localeCompare(b.AP1) },
          { title: "Apellido 2", dataIndex: "AP2", sorter: (a, b) => a.AP2.localeCompare(b.AP2) },
          { title: "DNI", dataIndex: "DNI" },
          { title: "Email", dataIndex: "email" },
          { title: "Móvil", dataIndex: "movil" },
          { title: "Nombre BD", dataIndex: ["dbUser", "name"], render: (text) => text || '-' },
          { title: "Apellido 1 BD", dataIndex: ["dbUser", "first_surname"], render: (text) => text || '-' },
          { title: "Apellido 2 BD", dataIndex: ["dbUser", "second_surname"], render: (text) => text || '-' },
        ]}
        dataSource={users}
        rowSelection={rowSelection}
        rowClassName={(record) => record.existsInDB ? '' : 'ant-table-placeholder'}
        style={{ marginTop: "16px" }}
      />
      <Button type="primary" onClick={handleImportUsers}>
        Importar al Grupo
      </Button>
      <Button type="default" onClick={() => navigate(-1)}>
        Volver
      </Button>
    </div>
  );
}