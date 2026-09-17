import { useState } from "react";
import { App, Button, DatePicker, Input, InputNumber, Select, Table } from "antd";
import { DeleteOutlined } from "@ant-design/icons";
import dayjs, { Dayjs } from "dayjs";
import { useConsultingCentroActionsQuery } from "../../hooks/api/consulting-centro/use-consulting-centro-actions.query";
import { useConsultingCentroEvaluationsQuery } from "../../hooks/api/consulting-centro/use-consulting-centro-evaluations.query";
import { useCreateConsultingCentroEvaluationMutation } from "../../hooks/api/consulting-centro/use-create-consulting-centro-evaluation.mutation";
import { useUpdateConsultingCentroEvaluationMutation } from "../../hooks/api/consulting-centro/use-update-consulting-centro-evaluation.mutation";
import { useRemoveConsultingCentroEvaluationMutation } from "../../hooks/api/consulting-centro/use-remove-consulting-centro-evaluation.mutation";
import { ConsultingActionEvaluation } from "../../shared/types/consulting-action-evaluation/consulting-action-evaluation";

const errorMessage = (error: unknown, fallback: string) =>
  (error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback;

interface Props {
  engagementId: number;
}

// Evaluación de las acciones del plan efectivo de este centro — alcance
// cerrado del acceso externo por token (ver docs/consultoria.md). Solo
// lectura si la consultoría está cerrada (el backend lo bloquea; aquí solo
// se refleja con el error que devuelve).
export default function ConsultingCentroEvaluationsTab({ engagementId }: Props) {
  const { message, modal } = App.useApp();

  const { data: actionsData } = useConsultingCentroActionsQuery(engagementId);
  const { data: evaluationsData, isLoading: isEvaluationsLoading } = useConsultingCentroEvaluationsQuery(engagementId);
  const { mutateAsync: createEvaluation, isPending: isCreating } = useCreateConsultingCentroEvaluationMutation(engagementId);
  const { mutateAsync: updateEvaluation, isPending: isUpdating } = useUpdateConsultingCentroEvaluationMutation(engagementId);
  const { mutateAsync: removeEvaluation } = useRemoveConsultingCentroEvaluationMutation(engagementId);

  const [editingId, setEditingId] = useState<number | undefined>();
  const [catalogCourseId, setCatalogCourseId] = useState<number | undefined>();
  const [date, setDate] = useState<Dayjs | null>(dayjs());
  const [percentage, setPercentage] = useState<number | null>(null);
  const [text, setText] = useState('');
  const [imparte, setImparte] = useState('');

  const isOwnAction = (actionsData ?? []).find((a) => a.id_catalog_course === catalogCourseId)?.origin === 'OWN';

  const resetForm = () => {
    setEditingId(undefined);
    setCatalogCourseId(undefined);
    setDate(dayjs());
    setPercentage(null);
    setText('');
    setImparte('');
  };

  const handleEdit = (evaluation: ConsultingActionEvaluation) => {
    setEditingId(evaluation.id_action_evaluation);
    setCatalogCourseId(evaluation.id_catalog_course);
    setDate(dayjs(evaluation.evaluation_date));
    setPercentage(evaluation.percentage);
    setText(evaluation.evaluation_text ?? '');
    setImparte(evaluation.imparte_text ?? '');
  };

  const handleSubmit = async () => {
    if (!date || (!editingId && !catalogCourseId)) return;
    try {
      const payload = {
        evaluation_date: date.format('YYYY-MM-DD'),
        evaluation_text: text || undefined,
        percentage: percentage ?? undefined,
        imparte_text: imparte || undefined,
      };
      if (editingId) {
        await updateEvaluation({ id_action_evaluation: editingId, data: payload });
      } else {
        await createEvaluation({ id_catalog_course: catalogCourseId!, ...payload });
      }
      resetForm();
    } catch (error) {
      message.error(errorMessage(error, 'No se pudo guardar la evaluación. Si el porcentaje es menor de 50, el texto de evaluación es obligatorio; y la fecha debe caer en el año de esta consultoría.'));
    }
  };

  const handleRemove = (id_action_evaluation: number, name: string) => {
    modal.confirm({
      title: `¿Borrar la evaluación de "${name}"?`,
      okText: "Borrar",
      okType: "danger",
      cancelText: "Cancelar",
      onOk: async () => {
        try {
          await removeEvaluation(id_action_evaluation);
        } catch (error) {
          message.error(errorMessage(error, 'No se pudo borrar la evaluación.'));
        }
      },
    });
  };

  return (
    <div>
      <p style={{ color: '#8a968d', marginTop: -4, marginBottom: 16 }}>
        Solo se pueden evaluar acciones que ya están en el plan de este centro. La fecha debe caer en el año de esta consultoría.
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <Select
          showSearch
          placeholder="Acción del plan..."
          style={{ minWidth: 280 }}
          value={catalogCourseId}
          onChange={setCatalogCourseId}
          disabled={!!editingId}
          filterOption={(input, option) => (option?.label as string ?? '').toLowerCase().includes(input.toLowerCase())}
          options={(actionsData ?? []).map((a) => ({ value: a.id_catalog_course, label: a.name }))}
        />
        <DatePicker value={date} onChange={setDate} placeholder="Fecha" />
        <InputNumber value={percentage} onChange={(v) => setPercentage(v)} min={0} max={100} placeholder="%" style={{ width: 90 }} />
        <Input
          value={imparte}
          onChange={(e) => setImparte(e.target.value)}
          placeholder="Imparte (empresa/centro)"
          style={{ width: 220 }}
          disabled={isOwnAction}
          title={isOwnAction ? "Acción propia — siempre la imparte la organización" : undefined}
        />
      </div>
      <Input.TextArea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Evaluación / motivo (obligatorio si el porcentaje es menor de 50)"
        rows={2}
        style={{ marginBottom: 8, maxWidth: 720 }}
      />
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <Button
          type="primary"
          onClick={handleSubmit}
          disabled={!date || (!editingId && !catalogCourseId)}
          loading={isCreating || isUpdating}
        >
          {editingId ? 'Guardar cambios' : 'Añadir evaluación'}
        </Button>
        {editingId && <Button onClick={resetForm}>Cancelar</Button>}
      </div>

      <Table
        rowKey="id_action_evaluation"
        loading={isEvaluationsLoading}
        dataSource={evaluationsData}
        pagination={false}
        columns={[
          { title: 'Acción', dataIndex: 'name' },
          { title: 'Fecha', dataIndex: 'evaluation_date', render: (v: string) => new Date(v).toLocaleDateString() },
          { title: '%', dataIndex: 'percentage', render: (v: number | null) => v ?? '—' },
          { title: 'Evaluación', dataIndex: 'evaluation_text', ellipsis: true },
          { title: 'Imparte', dataIndex: 'imparte_text' },
          {
            title: '',
            key: 'actions',
            width: 100,
            render: (_, record) => (
              <div style={{ display: 'flex', gap: 4 }}>
                <Button size="small" onClick={() => handleEdit(record)}>Editar</Button>
                <Button size="small" danger type="text" icon={<DeleteOutlined />} onClick={() => handleRemove(record.id_action_evaluation, record.name)} />
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
