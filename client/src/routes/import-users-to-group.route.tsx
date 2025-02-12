import { useParams, useNavigate } from "react-router-dom";
import { Button, Upload, message, Table } from "antd";
import { UploadOutlined } from "@ant-design/icons";
import * as XLSX from "xlsx";
import { useState } from "react";
// import { useAddUserToGroupMutation } from "../hooks/api/groups/use-add-user-to-group.mutation";
import { UserImportTemplate } from "../shared/types/user/user-import-template";
// import { useCreateUserMutation } from "../hooks/api/users/use-create-user.mutation";
import { User } from "../shared/types/user/user";
import { generateEasyPassword } from "../utils/helpers";
import { useBulkCreateAndAddToGroupMutation } from "../hooks/api/users/use-bulk-create-and-add-to-group.mutation";

export default function ImportUsersToGroupRoute() {
  const { id_group } = useParams();
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserImportTemplate[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  // const { mutateAsync: addUserToGroup } = useAddUserToGroupMutation();
  // const { mutateAsync: createUser } = useCreateUserMutation();
  const { mutateAsync: bulkCreateAndAddToGroup } = useBulkCreateAndAddToGroupMutation();

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
            moodle_username: user.DNI.toLowerCase(),
            moodle_password: generateEasyPassword(),
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
        columns={[
          { title: "Nombre", dataIndex: "NOMBRE" },
          { title: "Apellido 1", dataIndex: "AP1" },
          { title: "Apellido 2", dataIndex: "AP2" },
          { title: "DNI", dataIndex: "DNI" },
          { title: "Email", dataIndex: "email" },
          { title: "Móvil", dataIndex: "movil" },
        ]}
        dataSource={users}
        rowSelection={rowSelection}
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