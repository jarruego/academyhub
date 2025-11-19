import React, { useEffect, useState } from 'react';
import { Modal, Button, Upload, Table, message } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import * as XLSX from 'xlsx';
import { UserImportTemplate } from '../../shared/types/user/user-import-template';
import { User } from '../../shared/types/user/user';
import { useBulkCreateAndAddToGroupMutation } from '../../hooks/api/users/use-bulk-create-and-add-to-group.mutation';
import { useBulkAddUsersToGroupMutation } from '../../hooks/api/groups/use-bulk-add-users-to-group.mutation';
import { useBulkUpdateUsersMutation } from '../../hooks/api/users/use-bulk-update-users.mutation';
import { useAllUsersLookupQuery } from '../../hooks/api/users/use-users.query';
import { useGroupQuery } from '../../hooks/api/groups/use-group.query';

interface Props {
  open: boolean;
  groupId?: string | number | null;
  onClose: () => void;
  onSuccess?: () => void;
}

type EnrichedUserImport = UserImportTemplate & { existsInDB?: boolean; dbUser?: User | null };

const ImportUsersToGroupModal: React.FC<Props> = ({ open, groupId, onClose, onSuccess }) => {
  const [users, setUsers] = useState<EnrichedUserImport[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const { mutateAsync: bulkCreateAndAddToGroup } = useBulkCreateAndAddToGroupMutation();
  const { mutateAsync: bulkAddUsersToGroup } = useBulkAddUsersToGroupMutation();
  const { mutateAsync: bulkUpdateUsers } = useBulkUpdateUsersMutation();
  const [messageApi, messageContextHolder] = message.useMessage();
  const { data: existingUsers } = useAllUsersLookupQuery();
  const { data: groupData } = useGroupQuery(groupId ? String(groupId) : undefined);

  const normalizeDni = (v: unknown) => String(v ?? '').trim().replace(/[\.\-\s]/g, '').toUpperCase();

  useEffect(() => {
    if (existingUsers && users.length > 0) {
      const updatedUsers: EnrichedUserImport[] = users.map(user => {
        const dbUser = existingUsers.find((dbUser) => normalizeDni(dbUser.dni) === normalizeDni(user.DNI)) ?? null;
        const existsInDB = !!dbUser;
        return { ...user, existsInDB, dbUser };
      });
      const isDifferent = JSON.stringify(updatedUsers) !== JSON.stringify(users);
      if (isDifferent) setUsers(updatedUsers);
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
        .filter((u): u is EnrichedUserImport => !!u);

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

      const existingUserIdsToAdd = selectedUsers
        .filter(u => !!u.existsInDB && !!u.dbUser)
        .map(u => u.dbUser!.id_user)
        .filter(Boolean);

      if (!groupId) {
        messageApi.error('ID de grupo no válido');
        return;
      }

      // Process creations and additions with a small concurrency limit to avoid flooding the API
      const id_group_num = parseInt(String(groupId), 10);

      // First, create & add new users in bulk (server endpoint handles them in one request)
      if (usersToCreate.length > 0) {
        await bulkCreateAndAddToGroup({ users: usersToCreate, id_group: id_group_num });
      }

      // Then, add existing users to the group using a server-side bulk endpoint (faster and avoids many HTTP requests)
      if (existingUserIdsToAdd.length > 0) {
        const resp = await bulkAddUsersToGroup({ id_group: id_group_num, userIds: existingUserIdsToAdd });
        const failed = (resp as any)?.failedIds ?? [];
        const existing = (resp as any)?.existingIds ?? [];
        if (failed && failed.length > 0) {
          messageApi.warning(`Algunos usuarios no se pudieron añadir al grupo: ${failed.join(', ')}`);
        } else if (existing && existing.length > 0) {
          // optional informative message when some users were already in the group
          messageApi.info(`${existing.length} usuarios ya pertenecían al grupo`);
        }
      }

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
        .filter((u): u is EnrichedUserImport => !!u);

      const updates = selectedUsers
        .filter(u => !!u.existsInDB && !!u.dbUser)
        .map(u => ({
          id_user: u.dbUser!.id_user,
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

      const resp = await bulkUpdateUsers(updates);
      // bulkUpdateUsers now returns { results, failedIds }
      const failed = (resp as any)?.failedIds ?? [];
      if (!failed || failed.length === 0) {
        messageApi.success('Usuarios actualizados correctamente en la BD');
      } else {
        messageApi.warning(`Actualizado parcialmente: ${failed.length} usuarios no se pudieron actualizar. IDs: ${failed.join(', ')}`);
      }
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
      styles={{ body: { padding: 16, maxHeight: '85vh', overflowY: 'auto' } }}
      footer={null}
      destroyOnClose
    >
      {messageContextHolder}
      <Upload beforeUpload={handleUpload}>
        <Button icon={<UploadOutlined />}>Seleccionar Archivo</Button>
      </Upload>
      <div style={{ maxHeight: '64vh', overflowY: 'auto', marginTop: 16 }}>
        <Table<EnrichedUserImport>
          id="import-users-table"
          rowKey={(record) => normalizeDni(record.DNI)}
          sortDirections={[ 'ascend', 'descend' ]}
          pagination={false}
          columns={[
            { title: 'BD', dataIndex: 'existsInDB', render: (value: EnrichedUserImport['existsInDB']) => value ? 'Sí' : 'No', align: 'left' },
            { title: 'Nombre', dataIndex: 'NOMBRE', align: 'left', render: (value: EnrichedUserImport['NOMBRE'], record: EnrichedUserImport) => <span style={{ color: record.existsInDB ? undefined : 'red', display: 'block', textAlign: 'left' }}>{value || '-'}</span> },
            { title: 'Apellido 1', dataIndex: 'AP1', align: 'left', render: (value: EnrichedUserImport['AP1'], record: EnrichedUserImport) => <span style={{ color: record.existsInDB ? undefined : 'red', display: 'block', textAlign: 'left' }}>{value || '-'}</span> },
            { title: 'Apellido 2', dataIndex: 'AP2', align: 'left', render: (value: EnrichedUserImport['AP2'], record: EnrichedUserImport) => <span style={{ color: record.existsInDB ? undefined : 'red', display: 'block', textAlign: 'left' }}>{value || '-'}</span> },
            { title: 'DNI', dataIndex: 'DNI', align: 'left', render: (value: EnrichedUserImport['DNI'], record: EnrichedUserImport) => <span style={{ color: record.existsInDB ? undefined : 'red', display: 'block', textAlign: 'left' }}>{value || '-'}</span> },
            { title: 'DNI BD', dataIndex: ['dbUser', 'dni'], render: (value: User['dni']) => value || '-', align: 'left' },
            { title: 'Nombre BD', dataIndex: ['dbUser', 'name'], render: (value: User['name']) => value || '-', align: 'left' },
            { title: 'Apellido 1 BD', dataIndex: ['dbUser', 'first_surname'], render: (value: User['first_surname']) => value || '-', align: 'left' },
            { title: 'Apellido 2 BD', dataIndex: ['dbUser', 'second_surname'], render: (value: User['second_surname']) => value || '-', align: 'left' },
          ]}
          dataSource={displayedUsers}
          rowSelection={{
            ...rowSelection,
            getCheckboxProps: (record: EnrichedUserImport) => ({ id: `user-checkbox-${record.DNI}`, name: `user-checkbox-${record.DNI}` }),
          }}
          rowClassName={(record: EnrichedUserImport) => record.existsInDB ? '' : 'import-row-not-found'}
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
