import React, { useEffect, useState } from 'react';
import { Modal, Button, Upload, Table, message } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import * as XLSX from 'xlsx';
import { UserImportTemplate } from '../../shared/types/user/user-import-template';
import { User } from '../../shared/types/user/user';
import { useBulkCreateAndAddToGroupMutation } from '../../hooks/api/users/use-bulk-create-and-add-to-group.mutation';
import { useAddUserToGroupMutation } from '../../hooks/api/groups/use-add-user-to-group.mutation';
import { useBulkUpdateUsersMutation } from '../../hooks/api/users/use-bulk-update-users.mutation';
import { useAllUsersLookupQuery } from '../../hooks/api/users/use-users.query';
import { useGroupQuery } from '../../hooks/api/groups/use-group.query';

interface Props {
  open: boolean;
  groupId?: string | number | null;
  onClose: () => void;
  onSuccess?: () => void;
}

const ImportUsersToGroupModal: React.FC<Props> = ({ open, groupId, onClose, onSuccess }) => {
  const [users, setUsers] = useState<UserImportTemplate[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const { mutateAsync: bulkCreateAndAddToGroup } = useBulkCreateAndAddToGroupMutation();
  const { mutateAsync: addUserToGroup } = useAddUserToGroupMutation();
  const { mutateAsync: bulkUpdateUsers } = useBulkUpdateUsersMutation();
  const [messageApi, messageContextHolder] = message.useMessage();
  const { data: existingUsers } = useAllUsersLookupQuery();
  const { data: groupData } = useGroupQuery(groupId ? String(groupId) : undefined);

  const normalizeDni = (v: unknown) => String(v ?? '').trim().replace(/[\.\-\s]/g, '').toUpperCase();

  useEffect(() => {
    if (existingUsers && users.length > 0) {
      const updatedUsers = users.map(user => {
        const dbUser = existingUsers.find((dbUser) => normalizeDni(dbUser.dni) === normalizeDni(user.DNI));
        const existsInDB = !!dbUser;
        return { ...user, existsInDB, dbUser } as any;
      });
      const isDifferent = JSON.stringify(updatedUsers) !== JSON.stringify(users);
      if (isDifferent) setUsers(updatedUsers as UserImportTemplate[]);
    }
  }, [existingUsers, users]);

  const handleUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      if (!e.target) {
        messageApi.error('Error al leer el archivo');
        return;
      }
      const data = new Uint8Array(e.target.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json<UserImportTemplate>(sheet);
      setUsers(jsonData);
    };
    reader.readAsArrayBuffer(file);
    return false;
  };

  const handleImportUsers = async () => {
    try {
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
          document_type: 'DNI',
          email: user.email ?? '',
          phone: user.movil ? String(user.movil) : '',
        } as Omit<User, 'id_user'>));

      const existingUserIdsToAdd = (selectedUsers as any[])
        .filter(u => !!u.existsInDB && !!u.dbUser)
        .map(u => (u.dbUser as any).id_user as number)
        .filter(Boolean);

      if (!groupId) {
        messageApi.error('ID de grupo no válido');
        return;
      }

      const tasks: Promise<any>[] = [];
      if (usersToCreate.length > 0) tasks.push(bulkCreateAndAddToGroup({ users: usersToCreate, id_group: parseInt(String(groupId), 10) }));
      if (existingUserIdsToAdd.length > 0) tasks.push(Promise.all(existingUserIdsToAdd.map(id_user => addUserToGroup({ id_group: parseInt(String(groupId), 10), id_user }))));

      if (tasks.length === 0) {
        messageApi.info('No hay usuarios seleccionados para crear o añadir al grupo.');
        return;
      }

      await Promise.all(tasks);
      messageApi.success('Usuarios importados correctamente');
      onSuccess ? onSuccess() : onClose();
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
        .filter(u => !!u.existsInDB && !!u.dbUser)
        .map(u => ({
          id_user: (u.dbUser as any).id_user as number,
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

      await bulkUpdateUsers(updates);
      messageApi.success('Usuarios actualizados correctamente en la BD');
    } catch (error) {
      console.error('[import-users] update selected failed', error);
      messageApi.error(`No se pudieron actualizar los usuarios: ${(error as Error).message}`);
    }
  };

  const rowSelection = {
    selectedRowKeys: selectedUserIds,
    onChange: (selectedRowKeys: React.Key[]) => setSelectedUserIds(selectedRowKeys as string[]),
  };

  const displayedUsers = users.slice().sort((a, b) => {
    const aFound = !!a.existsInDB;
    const bFound = !!b.existsInDB;
    return (aFound ? 1 : 0) - (bFound ? 1 : 0);
  });

  return (
    <Modal
      centered
      open={open}
      onCancel={onClose}
      title={`Importar a Grupo ${groupData?.group_name ?? groupId ?? ''}`}
      width={'80vw'}
      bodyStyle={{ padding: 16, maxHeight: '85vh', overflowY: 'auto' }}
      footer={null}
      destroyOnClose
    >
      {messageContextHolder}
      <Upload beforeUpload={handleUpload}>
        <Button icon={<UploadOutlined />}>Seleccionar Archivo</Button>
      </Upload>
      <div style={{ maxHeight: '64vh', overflowY: 'auto', marginTop: 16 }}>
        <Table
          id="import-users-table"
          rowKey={(record: any) => normalizeDni(record.DNI)}
          sortDirections={[ 'ascend', 'descend' ]}
          pagination={false}
          columns={[
            { title: 'BD', dataIndex: 'existsInDB', render: (text: any) => text ? 'Sí' : 'No', align: 'left' },
            { title: 'Nombre', dataIndex: 'NOMBRE', align: 'left', render: (text: any, record: any) => <span style={{ color: record.existsInDB ? undefined : 'red', display: 'block', textAlign: 'left' }}>{text || '-'}</span> },
            { title: 'Apellido 1', dataIndex: 'AP1', align: 'left', render: (text: any, record: any) => <span style={{ color: record.existsInDB ? undefined : 'red', display: 'block', textAlign: 'left' }}>{text || '-'}</span> },
            { title: 'Apellido 2', dataIndex: 'AP2', align: 'left', render: (text: any, record: any) => <span style={{ color: record.existsInDB ? undefined : 'red', display: 'block', textAlign: 'left' }}>{text || '-'}</span> },
            { title: 'DNI', dataIndex: 'DNI', align: 'left', render: (text: any, record: any) => <span style={{ color: record.existsInDB ? undefined : 'red', display: 'block', textAlign: 'left' }}>{text || '-'}</span> },
            { title: 'DNI BD', dataIndex: ['dbUser', 'dni'], render: (text: any) => text || '-', align: 'left' },
            { title: 'Nombre BD', dataIndex: ['dbUser', 'name'], render: (text: any) => text || '-', align: 'left' },
            { title: 'Apellido 1 BD', dataIndex: ['dbUser', 'first_surname'], render: (text: any) => text || '-', align: 'left' },
            { title: 'Apellido 2 BD', dataIndex: ['dbUser', 'second_surname'], render: (text: any) => text || '-', align: 'left' },
          ]}
          dataSource={displayedUsers}
          rowSelection={{
            ...rowSelection,
            getCheckboxProps: (record: any) => ({ id: `user-checkbox-${record.DNI}`, name: `user-checkbox-${record.DNI}` }),
          }}
          rowClassName={(record: any) => record.existsInDB ? '' : 'import-row-not-found'}
          style={{ marginTop: 0 }}
        />
      </div>

      <div style={{ marginTop: 12 }}>
        <Button type="primary" onClick={handleImportUsers}>Importar al Grupo</Button>
        <Button type="default" style={{ marginLeft: 12 }} onClick={handleUpdateSelected}>Actualizar BD</Button>
      </div>
    </Modal>
  );
};

export default ImportUsersToGroupModal;
