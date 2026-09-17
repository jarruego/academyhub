import { useState } from "react";
import { App, Button, DatePicker, Select, Table, Tag } from "antd";
import { DeleteOutlined } from "@ant-design/icons";
import dayjs, { Dayjs } from "dayjs";
import { useConsultingCentroActionsQuery } from "../../hooks/api/consulting-centro/use-consulting-centro-actions.query";
import { useConsultingCentroRosterQuery } from "../../hooks/api/consulting-centro/use-consulting-centro-roster.query";
import { useConsultingCentroCuadroQuery } from "../../hooks/api/consulting-centro/use-consulting-centro-cuadro.query";
import { useCreateConsultingCentroAttendeeMutation } from "../../hooks/api/consulting-centro/use-create-consulting-centro-attendee.mutation";
import { useRemoveConsultingCentroAttendeeMutation } from "../../hooks/api/consulting-centro/use-remove-consulting-centro-attendee.mutation";

interface Props {
  engagementId: number;
}

const errorMessage = (error: unknown, fallback: string) =>
  (error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback;

// Registrar asistentes de las propias acciones de este centro (sin
// matrícula real) — alcance cerrado del acceso externo por token, paso 3
// del circuito de registro (ver docs/consultoria.md). El trabajador se
// elige del roster de este centro, no de una búsqueda de todos los
// usuarios del sistema (esa búsqueda sigue siendo solo para ADMIN/CONSULTOR
// — ver "Guards y acceso externo" § aislamiento).
export default function ConsultingCentroAttendeesTab({ engagementId }: Props) {
  const { message, modal } = App.useApp();
  const { data: actionsData } = useConsultingCentroActionsQuery(engagementId);
  const { data: rosterData } = useConsultingCentroRosterQuery(engagementId);
  const { data: cuadroData, isLoading: isCuadroLoading } = useConsultingCentroCuadroQuery(engagementId);
  const { mutateAsync: addAttendee, isPending: isAdding } = useCreateConsultingCentroAttendeeMutation(engagementId);
  const { mutateAsync: removeAttendee } = useRemoveConsultingCentroAttendeeMutation(engagementId);

  const [catalogCourseId, setCatalogCourseId] = useState<number | undefined>();
  const [userId, setUserId] = useState<number | undefined>();
  const [date, setDate] = useState<Dayjs | null>(dayjs());

  const workerOptions = (rosterData?.members ?? []).map((m) => ({
    value: m.id_user,
    label: `${m.name} ${m.first_surname ?? ''} ${m.second_surname ?? ''}${m.dni ? ` — ${m.dni}` : ''}`.trim(),
  }));

  const handleAdd = async () => {
    if (!catalogCourseId || !userId || !date) return;
    try {
      await addAttendee({ id_catalog_course: catalogCourseId, id_user: userId, attended_at: date.format('YYYY-MM-DD') });
      setCatalogCourseId(undefined);
      setUserId(undefined);
      setDate(dayjs());
    } catch (error) {
      message.error(errorMessage(error, 'No se pudo registrar el asistente. Si esta acción tiene matrícula real, el cuadro se deriva automáticamente y no admite registro a mano.'));
    }
  };

  const handleRemove = (id_action_attendee: number, name: string) => {
    modal.confirm({
      title: `¿Quitar a "${name}" de esta acción?`,
      okText: "Quitar",
      okType: "danger",
      cancelText: "Cancelar",
      onOk: async () => {
        try {
          await removeAttendee(id_action_attendee);
        } catch (error) {
          message.error(errorMessage(error, 'No se pudo quitar. Inténtalo de nuevo.'));
        }
      },
    });
  };

  return (
    <div>
      <p style={{ color: '#8a968d', marginTop: -4, marginBottom: 16 }}>
        Automático para acciones con matrícula real — solo lectura, no se toca desde aquí. Para tus propias acciones (sin matrícula real), regístralo a mano.
      </p>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <Select
          showSearch
          placeholder="Acción del plan..."
          style={{ minWidth: 240 }}
          value={catalogCourseId}
          onChange={setCatalogCourseId}
          filterOption={(input, option) => (option?.label as string ?? '').toLowerCase().includes(input.toLowerCase())}
          options={(actionsData ?? []).map((a) => ({ value: a.id_catalog_course, label: a.name }))}
        />
        <Select
          showSearch
          placeholder="Trabajador..."
          style={{ minWidth: 280 }}
          value={userId}
          onChange={setUserId}
          filterOption={(input, option) => (option?.label as string ?? '').toLowerCase().includes(input.toLowerCase())}
          options={workerOptions}
        />
        <DatePicker value={date} onChange={setDate} placeholder="Fecha" />
        <Button type="primary" onClick={handleAdd} disabled={!catalogCourseId || !userId} loading={isAdding}>
          Registrar asistente
        </Button>
      </div>
      <Table
        rowKey={(r) => r.id_action_attendee ?? `${r.id_catalog_course}-${r.id_user}-real`}
        loading={isCuadroLoading}
        dataSource={cuadroData?.rows}
        pagination={false}
        columns={[
          { title: 'Acción', dataIndex: 'action_name' },
          { title: 'Trabajador', key: 'name', render: (_, r) => `${r.name} ${r.first_surname ?? ''} ${r.second_surname ?? ''}`.trim() },
          { title: 'DNI', dataIndex: 'dni' },
          { title: 'Fecha', dataIndex: 'attended_at', render: (v: string) => v ? new Date(v).toLocaleDateString() : '—' },
          { title: 'Origen', dataIndex: 'source', render: (source: string) => source === 'real' ? <Tag>Matrícula real</Tag> : <Tag color="blue">Manual</Tag> },
          {
            title: '',
            key: 'actions',
            width: 80,
            render: (_, record) => record.source === 'manual' ? (
              <Button
                danger
                type="text"
                size="small"
                icon={<DeleteOutlined />}
                onClick={() => handleRemove(record.id_action_attendee!, record.name)}
                aria-label={`Quitar a ${record.name}`}
              />
            ) : null,
          },
        ]}
      />
    </div>
  );
}
