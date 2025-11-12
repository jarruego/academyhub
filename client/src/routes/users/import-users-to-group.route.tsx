import { useParams, useNavigate } from "react-router-dom";
import { Button, Upload, message, Table } from "antd";
import { UploadOutlined } from "@ant-design/icons";
import * as XLSX from "xlsx";
import { useState, useEffect } from "react";
import { UserImportTemplate } from "../../shared/types/user/user-import-template";
import { User } from "../../shared/types/user/user";
import { useBulkCreateAndAddToGroupMutation } from "../../hooks/api/users/use-bulk-create-and-add-to-group.mutation";
import { useAddUserToGroupMutation } from "../../hooks/api/groups/use-add-user-to-group.mutation";
import { useBulkUpdateUsersMutation } from "../../hooks/api/users/use-bulk-update-users.mutation";
import { useAllUsersLookupQuery } from "../../hooks/api/users/use-users.query";

export default function ImportUsersToGroupRoute() {
  const { id_group } = useParams();
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserImportTemplate[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const { mutateAsync: bulkCreateAndAddToGroup } = useBulkCreateAndAddToGroupMutation();
  const { mutateAsync: addUserToGroup } = useAddUserToGroupMutation();
  const { mutateAsync: bulkUpdateUsers } = useBulkUpdateUsersMutation();
  const [messageApi, messageContextHolder] = message.useMessage();
  // We need a plain array of users to be able to call `.find` on it.
  // Use lightweight lookup (dni + name/surnames) for much faster initial load
  const { data: existingUsers } = useAllUsersLookupQuery();

  // Normalizar DNI para comparación robusta: convertir a string, trim, quitar espacios/puntos/guiones, pasar a mayúsculas
  const normalizeDni = (v: unknown) =>
    String(v ?? "").trim().replace(/[\.\-\s]/g, "").toUpperCase();

  useEffect(() => {
    if (existingUsers && users.length > 0) {
      // Debugging helpers: print small samples so we can inspect mismatches in the browser console
      try {
        console.debug('[import-users] existingUsers sample (first 20 dni):', existingUsers.slice(0, 20).map(u => u.dni));
        console.debug('[import-users] imported rows sample (first 20 DNI):', users.slice(0, 20).map(u => u.DNI));
        const preview = users.slice(0, 20).map((u) => {
          const match = existingUsers.find(db => normalizeDni(db.dni) === normalizeDni(u.DNI));
          return { original: u.DNI, normalized: normalizeDni(u.DNI), matched: !!match, matchedDni: match?.dni ?? null };
        });
        console.debug('[import-users] match preview (first 20):', preview);
      } catch (e) {
        console.debug('[import-users] debug failed', e);
      }
      const updatedUsers = users.map(user => {
        const dbUser = existingUsers.find((dbUser) => normalizeDni(dbUser.dni) === normalizeDni(user.DNI));
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
        messageApi.error("Error al leer el archivo");
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
      // Build two lists: new users to create, and existing users to add to group
      const selectedUsers = selectedUserIds
        .map((userId) => users.find((user) => normalizeDni(user.DNI) === normalizeDni(userId)))
        .filter((u): u is UserImportTemplate => !!u);

      const usersToCreate = selectedUsers
        .filter(u => !u.existsInDB)
        .map((user) => ({
          dni: user.DNI,
          name: user.NOMBRE,
          first_surname: user.AP1,
          second_surname: user.AP2,
          // The backend expects a document_type; default to 'DNI' for imports
          document_type: 'DNI',
          // Ensure email and phone are strings (backend validation expects strings)
          email: user.email ?? '',
          phone: user.movil ? String(user.movil) : '',
        } as Omit<User, 'id_user'>));

      const existingUserIdsToAdd = (selectedUsers as any[])
        .filter(u => !!(u as any).existsInDB && !!(u as any).dbUser)
        .map(u => ((u as any).dbUser as any).id_user as number)
        .filter(Boolean);

      console.debug('[import-users] usersToCreate count', usersToCreate.length, usersToCreate.slice(0,5));
      console.debug('[import-users] existingUserIdsToAdd count', existingUserIdsToAdd.length, existingUserIdsToAdd.slice(0,5));

      if (!id_group) {
        messageApi.error("ID de grupo no válido");
        return;
      }

      // Prepare promises: create new users (which will be added to the group by the endpoint),
      // and add existing users to the group via the group endpoint.
      const tasks: Promise<any>[] = [];

      if (usersToCreate.length > 0) {
        tasks.push(bulkCreateAndAddToGroup({ users: usersToCreate, id_group: parseInt(id_group, 10) }));
      }

      if (existingUserIdsToAdd.length > 0) {
        // Use Promise.all to add existing users in parallel
        tasks.push(Promise.all(existingUserIdsToAdd.map(id_user => addUserToGroup({ id_group: parseInt(id_group!, 10), id_user }))));
      }

      if (tasks.length === 0) {
        messageApi.info('No hay usuarios seleccionados para crear o añadir al grupo.');
        return;
      }

      await Promise.all(tasks);
      navigate(`/groups/${id_group}/edit`);
    } catch (error) {
      console.error('[import-users] import failed', error);
      messageApi.error(`No se pudo importar a los usuarios: ${(error as Error).message}`);
    }
  };

  const handleUpdateSelected = async () => {
    try {
      const selectedUsers = selectedUserIds
        .map((userId) => users.find((user) => normalizeDni(user.DNI) === normalizeDni(userId)))
        .filter((u): u is UserImportTemplate => !!u);

      const updates = (selectedUsers as any[])
        .filter(u => !!(u as any).existsInDB && !!(u as any).dbUser)
        .map(u => ({
          id_user: ((u as any).dbUser as any).id_user as number,
          data: {
            name: u.NOMBRE || undefined,
            first_surname: u.AP1 || undefined,
            second_surname: u.AP2 || undefined,
            email: u.email ?? '',
            phone: u.movil ? String(u.movil) : '',
          }
        }));

      if (updates.length === 0) {
        messageApi.info('No hay usuarios seleccionados que existan en la BD para actualizar.');
        return;
      }

      console.debug('[import-users] bulk updating users count', updates.length);
      await bulkUpdateUsers(updates);
      messageApi.success('Usuarios actualizados correctamente en la BD');
    } catch (error) {
      console.error('[import-users] update selected failed', error);
      messageApi.error(`No se pudieron actualizar los usuarios: ${(error as Error).message}`);
    }
  };

  const rowSelection = {
    selectedRowKeys: selectedUserIds,
    onChange: (selectedRowKeys: React.Key[]) => {
      console.debug('[import-users] selectedRowKeys changed', selectedRowKeys);
      setSelectedUserIds(selectedRowKeys as string[]);
    },
  };

  // Mostrar primero registros NO encontrados en la BD
  const displayedUsers = users.slice().sort((a, b) => {
    const aFound = !!a.existsInDB;
    const bFound = !!b.existsInDB;
    return (aFound ? 1 : 0) - (bFound ? 1 : 0);
  });

  return (
    <div>
      <h1>Importación de Usuarios a Grupo {id_group}</h1>
      {messageContextHolder}
      <Upload beforeUpload={handleUpload}>
        <Button icon={<UploadOutlined />}>Seleccionar Archivo</Button>
      </Upload>
      <div style={{ maxHeight: '60vh', overflowY: 'auto', marginTop: 16 }}>
      <Table
        id="import-users-table"
        rowKey={(record) => normalizeDni(record.DNI)} // Use normalized DNI as row key
        sortDirections={['ascend', 'descend']}
        pagination={false}
        columns={[
          { title: "BD", dataIndex: "existsInDB", render: (text) => text ? 'Sí' : 'No', align: 'left' },
          { title: "Nombre", dataIndex: "NOMBRE", align: 'left', sorter: (a, b) => a.NOMBRE.localeCompare(b.NOMBRE), render: (text, record) => <span style={{ color: record.existsInDB ? undefined : 'red', display: 'block', textAlign: 'left' }}>{text || '-'}</span> },
          { title: "Apellido 1", dataIndex: "AP1", align: 'left', sorter: (a, b) => a.AP1.localeCompare(b.AP1), render: (text, record) => <span style={{ color: record.existsInDB ? undefined : 'red', display: 'block', textAlign: 'left' }}>{text || '-'}</span> },
          { title: "Apellido 2", dataIndex: "AP2", align: 'left', sorter: (a, b) => a.AP2.localeCompare(b.AP2), render: (text, record) => <span style={{ color: record.existsInDB ? undefined : 'red', display: 'block', textAlign: 'left' }}>{text || '-'}</span> },
          { title: "DNI", dataIndex: "DNI", align: 'left', render: (text, record) => <span style={{ color: record.existsInDB ? undefined : 'red', display: 'block', textAlign: 'left' }}>{text || '-'}</span> },
          { title: "DNI BD", dataIndex: ["dbUser", "dni"], render: (text) => text || '-', align: 'left' },
          { title: "Nombre BD", dataIndex: ["dbUser", "name"], render: (text) => text || '-', align: 'left' },
          { title: "Apellido 1 BD", dataIndex: ["dbUser", "first_surname"], render: (text) => text || '-', align: 'left' },
          { title: "Apellido 2 BD", dataIndex: ["dbUser", "second_surname"], render: (text) => text || '-', align: 'left' },
        ]}
  dataSource={displayedUsers}
        rowSelection={{
          ...rowSelection,
          getCheckboxProps: (record) => ({
            id: `user-checkbox-${record.DNI}`,
            name: `user-checkbox-${record.DNI}`,
          }),
        }}
  rowClassName={(record) => record.existsInDB ? '' : 'import-row-not-found'}
        style={{ marginTop: 0 }}
      />
      </div>
      <Button type="primary" onClick={handleImportUsers}>
        Importar al Grupo
      </Button>
      <Button type="default" style={{ marginLeft: 12 }} onClick={handleUpdateSelected}>
        Actualizar BD
      </Button>
      <Button type="default" onClick={() => navigate(-1)}>
        Volver
      </Button>
    </div>
  );
}