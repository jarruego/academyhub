import React, { useEffect, useState } from 'react';
import { App, Modal, Table, Button, Tag, Spin, theme } from 'antd';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthenticatedAxios } from '../../utils/api/use-authenticated-axios.util';
import { getApiHost } from '../../utils/api/get-api-host.util';
import { useCourseRequestsQuery } from '../../hooks/api/course-requests/use-course-requests.query';
import { useAllUsersLookupQuery } from '../../hooks/api/users/use-users.query';
import { useGroupQuery } from '../../hooks/api/groups/use-group.query';
import { useBulkCreateAndAddToGroupMutation } from '../../hooks/api/users/use-bulk-create-and-add-to-group.mutation';
import { useBulkAddUsersToGroupMutation } from '../../hooks/api/groups/use-bulk-add-users-to-group.mutation';
import { useRole } from '../../utils/permissions/use-role';
import { Role } from '../../hooks/api/auth/use-login.mutation';
import { CourseRequestStatus } from '../../shared/types/course-request/course-request-status.enum';
import type { CourseRequest, CourseRequestDetail, CourseRequestStudent } from '../../shared/types/course-request/course-request';
import type { User } from '../../shared/types/user/user';
import { formatDate } from '../../utils/format';
import { openDetail } from '../../utils/open-detail';

interface Props {
  open: boolean;
  groupId?: string | number | null;
  courseId?: number | null;
  onClose: () => void;
  onSuccess?: () => void;
}

type LookupUser = Pick<User, 'id_user' | 'dni' | 'name' | 'first_surname' | 'second_surname'>;

type EnrichedStudent = CourseRequestStudent & {
  existsInDB: boolean;
  dbUser: LookupUser | null;
};

const normalizeDni = (v: unknown) =>
  String(v ?? '').trim().replace(/[.\-\s]/g, '').toUpperCase();

const ImportFromCourseRequestsModal: React.FC<Props> = ({
  open,
  groupId,
  courseId,
  onClose,
  onSuccess,
}) => {
  const { message: messageApi, modal } = App.useApp();
  const queryClient = useQueryClient();
  const axiosRequest = useAuthenticatedAxios<unknown>();
  const role = useRole();
  const canEdit = role === Role.ADMIN || role === Role.MANAGER;
  const { token } = theme.useToken();

  const { data: requests, isLoading: isLoadingRequests } = useCourseRequestsQuery(
    { id_course: courseId ?? undefined, status: CourseRequestStatus.ABIERTA },
    { enabled: !!courseId },
  );
  const { data: allUsers } = useAllUsersLookupQuery();
  const { data: groupData } = useGroupQuery(groupId ? String(groupId) : undefined);
  const { mutateAsync: bulkCreateAndAddToGroup } = useBulkCreateAndAddToGroupMutation();
  const { mutateAsync: bulkAddUsersToGroup } = useBulkAddUsersToGroupMutation();

  const [selectedRequestIds, setSelectedRequestIds] = useState<number[]>([]);
  const [combinedStudents, setCombinedStudents] = useState<EnrichedStudent[]>([]);
  const [selectedStudentDnis, setSelectedStudentDnis] = useState<string[]>([]);
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);

  useEffect(() => {
    if (!open) {
      setSelectedRequestIds([]);
      setCombinedStudents([]);
      setSelectedStudentDnis([]);
    }
  }, [open]);

  const enrichStudents = (students: CourseRequestStudent[]): EnrichedStudent[] =>
    students.map((s) => {
      const dbUser = allUsers?.find((u) => normalizeDni(u.dni) === normalizeDni(s.dni)) ?? null;
      return { ...s, existsInDB: !!dbUser, dbUser };
    });

  const handleSelectRequests = async (ids: number[]) => {
    setSelectedRequestIds(ids);
    setSelectedStudentDnis([]);
    if (ids.length === 0) { setCombinedStudents([]); return; }

    setIsLoadingStudents(true);
    try {
      const details = await Promise.all(
        ids.map((id) =>
          axiosRequest({ method: 'GET', url: `${getApiHost()}/api/course-requests/${id}` }),
        ),
      );
      const seen = new Set<string>();
      const combined: CourseRequestStudent[] = [];
      for (const resp of details) {
        const data = resp as { data: CourseRequestDetail };
        for (const s of data.data.students) {
          const key = normalizeDni(s.dni);
          if (!seen.has(key)) { seen.add(key); combined.push(s); }
        }
      }
      setCombinedStudents(enrichStudents(combined));
    } catch {
      messageApi.error('No se pudieron cargar los alumnos de las peticiones');
    } finally {
      setIsLoadingStudents(false);
    }
  };

  const handleImport = async () => {
    if (!groupId) return;
    const selected = selectedStudentDnis
      .map((dni) => combinedStudents.find((s) => normalizeDni(s.dni) === normalizeDni(dni)))
      .filter((s): s is EnrichedStudent => !!s);

    if (selected.length === 0) {
      messageApi.warning('Selecciona al menos un alumno para importar');
      return;
    }

    const toCreate = selected
      .filter((s) => !s.existsInDB)
      .map((s) => ({
        dni: s.dni,
        name: s.name,
        first_surname: s.first_surname,
        second_surname: s.second_surname ?? undefined,
        document_type: 'DNI' as const,
        email: s.email ?? '',
        phone: s.phone_mobile ?? '',
      }));

    const existingIds = selected
      .filter((s) => s.existsInDB && s.dbUser)
      .map((s) => s.dbUser!.id_user);

    const id_group_num = parseInt(String(groupId), 10);

    const runImport = async () => {
      if (toCreate.length > 0) {
        const createResp = await bulkCreateAndAddToGroup({
          users: toCreate as Omit<User, 'id_user'>[],
          id_group: id_group_num,
        }) as {
          createdUsers?: number[];
          failedToCreate?: Array<{ dni?: string; error: string }>;
          failedToAddGroup?: Array<{ id_user: number; dni?: string; error: string }>;
        };

        const failedCreate = createResp?.failedToCreate ?? [];
        const failedAdd = createResp?.failedToAddGroup ?? [];
        if (failedCreate.length > 0 || failedAdd.length > 0) {
          modal.warning({
            title: 'Importación parcial',
            centered: true,
            content: (
              <div>
                {failedCreate.length > 0 && (
                  <p style={{ whiteSpace: 'pre-wrap' }}>
                    <strong>No se pudieron crear:</strong>{'\n'}
                    {failedCreate.slice(0, 10).map((f) => `${f.dni ?? 'DNI?'}: ${f.error}`).join('\n')}
                  </p>
                )}
                {failedAdd.length > 0 && (
                  <p style={{ whiteSpace: 'pre-wrap' }}>
                    <strong>Creados pero no añadidos al grupo:</strong>{'\n'}
                    {failedAdd.slice(0, 10).map((f) => `${f.dni ?? `ID ${f.id_user}`}: ${f.error}`).join('\n')}
                  </p>
                )}
              </div>
            ),
            okText: 'Entendido',
          });
        }
      }

      if (existingIds.length > 0) {
        const resp = await bulkAddUsersToGroup({ id_group: id_group_num, userIds: existingIds }) as {
          existingIds?: number[];
          failedIds?: number[];
        };
        if (resp?.failedIds && resp.failedIds.length > 0) {
          messageApi.warning(`Algunos usuarios no se pudieron añadir: ${resp.failedIds.join(', ')}`);
        } else if (resp?.existingIds && resp.existingIds.length > 0) {
          messageApi.info(`${resp.existingIds.length} alumno(s) ya pertenecían al grupo`);
        }
      }

      // Cerrar automáticamente las peticiones usadas
      await Promise.all(
        selectedRequestIds.map((id) =>
          axiosRequest({ method: 'PUT', url: `${getApiHost()}/api/course-requests/${id}/close` }),
        ),
      );
      await queryClient.invalidateQueries({ queryKey: ['course-requests'] });

      messageApi.success('Alumnos importados y peticiones cerradas correctamente');
      onSuccess?.();
    };

    if (toCreate.length > 0) {
      const preview = toCreate.slice(0, 8).map((u) => u.dni || '(sin DNI)').join(', ');
      const more = toCreate.length > 8 ? toCreate.length - 8 : 0;
      modal.confirm({
        title: 'Se crearán nuevos usuarios en la BD',
        centered: true,
        content: (
          <div>
            <p>Hay <strong>{toCreate.length}</strong> alumno(s) que no existen aún en la BD.</p>
            <p>Si aceptas, se crearán y se añadirán al grupo.</p>
            <p style={{ wordBreak: 'break-word' }}>
              <strong>DNI:</strong> {preview}{more > 0 ? ` … y ${more} más` : ''}
            </p>
          </div>
        ),
        okText: 'Crear y añadir',
        cancelText: 'Cancelar',
        onOk: runImport,
      });
    } else {
      await runImport();
    }
  };

  const requestColumns = [
    {
      title: 'Centro',
      dataIndex: 'center_name' as keyof CourseRequest,
      render: (v: unknown) => (v as string) || <span style={{ color: '#999' }}>—</span>,
    },
    {
      title: 'Empresa',
      dataIndex: 'company_name' as keyof CourseRequest,
      render: (v: unknown) => (v as string) || <span style={{ color: '#999' }}>—</span>,
    },
    {
      title: 'Fecha petición',
      dataIndex: 'request_date' as keyof CourseRequest,
      render: (v: unknown) => formatDate(v as string),
    },
    {
      title: 'Alumnos',
      dataIndex: 'student_count' as keyof CourseRequest,
      align: 'right' as const,
    },
    {
      title: 'Urgente',
      dataIndex: 'is_urgent' as keyof CourseRequest,
      render: (v: unknown) =>
        v ? <Tag color="red">Sí</Tag> : null,
    },
  ];

  const studentColumns = [
    {
      title: 'En BD',
      dataIndex: 'existsInDB' as keyof EnrichedStudent,
      width: 60,
      render: (v: unknown) =>
        v
          ? <span style={{ color: '#52c41a', fontWeight: 700 }}>Sí</span>
          : <span style={{ color: '#ff4d4f', fontWeight: 700 }}>No</span>,
    },
    {
      title: 'Nombre',
      dataIndex: 'name' as keyof EnrichedStudent,
      render: (v: unknown, r: EnrichedStudent) => (
        <span
          style={{ color: r.existsInDB ? token.colorPrimary : '#ff4d4f', cursor: 'pointer', textDecoration: 'underline' }}
          onClick={(e) => { e.stopPropagation(); openDetail(`/course-requests/${r.id_request}?tab=alumnos&studentId=${r.id}`); }}
        >
          {(v as string) || '—'}
        </span>
      ),
    },
    {
      title: 'Apellido 1',
      dataIndex: 'first_surname' as keyof EnrichedStudent,
      render: (v: unknown, r: EnrichedStudent) => (
        <span style={{ color: r.existsInDB ? undefined : '#ff4d4f' }}>{(v as string) || '—'}</span>
      ),
    },
    {
      title: 'Apellido 2',
      dataIndex: 'second_surname' as keyof EnrichedStudent,
      render: (v: unknown) => (v as string) || '—',
    },
    {
      title: 'DNI',
      dataIndex: 'dni' as keyof EnrichedStudent,
      render: (v: unknown, r: EnrichedStudent) => (
        <span style={{ color: r.existsInDB ? undefined : '#ff4d4f' }}>{(v as string) || '—'}</span>
      ),
    },
    {
      title: 'Email',
      dataIndex: 'email' as keyof EnrichedStudent,
      render: (v: unknown) => (v as string) || '—',
    },
    {
      title: 'DNI BD',
      render: (_: unknown, r: EnrichedStudent) => r.dbUser?.dni || '—',
    },
    {
      title: 'Nombre BD',
      render: (_: unknown, r: EnrichedStudent) => r.dbUser?.name || '—',
    },
    {
      title: 'Apellido 1 BD',
      render: (_: unknown, r: EnrichedStudent) => r.dbUser?.first_surname || '—',
    },
    {
      title: 'Apellido 2 BD',
      render: (_: unknown, r: EnrichedStudent) => r.dbUser?.second_surname || '—',
    },
  ];

  return (
    <Modal
      centered
      open={open}
      onCancel={onClose}
      title={`Importar desde Peticiones — Grupo ${groupData?.group_name ?? groupId ?? ''}`}
      width="85vw"
      styles={{ body: { padding: 16, maxHeight: '85vh', overflowY: 'auto' } }}
      footer={null}
      destroyOnClose
    >
      {/* ── Tabla de peticiones abiertas ── */}
      <div style={{ marginBottom: 16 }}>
        <strong>Peticiones abiertas para este curso:</strong>
        {isLoadingRequests ? (
          <div style={{ textAlign: 'center', padding: 24 }}><Spin /></div>
        ) : !requests || requests.length === 0 ? (
          <p style={{ color: '#999', marginTop: 8 }}>
            No hay peticiones abiertas para este curso.
          </p>
        ) : (
          <Table<CourseRequest>
            rowKey="id_request"
            size="small"
            pagination={false}
            dataSource={requests}
            columns={requestColumns}
            rowSelection={{
              type: 'checkbox',
              selectedRowKeys: selectedRequestIds,
              onChange: (keys) => void handleSelectRequests(keys as number[]),
            }}
            style={{ marginTop: 8 }}
            scroll={{ x: 'max-content' }}
          />
        )}
      </div>

      {/* ── Tabla de alumnos combinados ── */}
      {selectedRequestIds.length > 0 && (
        <div>
          <strong>
            Alumnos de las peticiones seleccionadas
            {combinedStudents.length > 0 && ` (${combinedStudents.length})`}:
          </strong>
          {isLoadingStudents ? (
            <div style={{ textAlign: 'center', padding: 24 }}><Spin /></div>
          ) : (
            <Table<EnrichedStudent>
              rowKey={(r) => normalizeDni(r.dni) || String(r.id)}
              size="small"
              pagination={false}
              dataSource={combinedStudents}
              columns={studentColumns}
              rowSelection={canEdit ? {
                type: 'checkbox',
                selectedRowKeys: selectedStudentDnis,
                onChange: (keys) => setSelectedStudentDnis(keys as string[]),
                getCheckboxProps: (r: EnrichedStudent) => ({
                  id: `student-cb-${normalizeDni(r.dni)}`,
                }),
              } : undefined}
              rowClassName={(r: EnrichedStudent) => r.existsInDB ? '' : 'import-row-not-found'}
              style={{ marginTop: 8 }}
              scroll={{ x: 'max-content' }}
            />
          )}
          {canEdit && (
            <div style={{ marginTop: 12 }}>
              <Button
                type="primary"
                onClick={() => void handleImport()}
                disabled={selectedStudentDnis.length === 0 || isLoadingStudents}
              >
                Importar al grupo ({selectedStudentDnis.length} alumno
                {selectedStudentDnis.length !== 1 ? 's' : ''})
              </Button>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
};

export default ImportFromCourseRequestsModal;
