import { useState } from "react";
import { App, Button, Modal, Segmented, Table, Tag } from "antd";
import { LeftOutlined, RightOutlined } from "@ant-design/icons";
import { useConsultingCentroCompetenciesQuery } from "../../hooks/api/consulting-centro/use-consulting-centro-competencies.query";
import { useSetConsultingCentroCompetencyMutation } from "../../hooks/api/consulting-centro/use-set-consulting-centro-competency.mutation";

interface Props {
  engagementId: number;
}

// Evaluación de competencias de los trabajadores de este centro — mismo
// patrón que la pestaña interna "Competencias" (tabla + modal paso a paso),
// alcance cerrado del acceso externo por token. El valor de partida se
// autorrellena desde la plantilla del puesto; no editable aquí quién
// mapea qué puesto (eso sigue siendo cosa de ADMIN).
export default function ConsultingCentroCompetenciesTab({ engagementId }: Props) {
  const { message } = App.useApp();
  const { data, isLoading } = useConsultingCentroCompetenciesQuery(engagementId);
  const { mutateAsync: setValue } = useSetConsultingCentroCompetencyMutation(engagementId);
  const [evaluatingUserId, setEvaluatingUserId] = useState<number | undefined>();

  const evaluatingIndex = (data?.members ?? []).findIndex((m) => m.id_user === evaluatingUserId);
  const evaluatingMember = evaluatingIndex >= 0 ? data?.members[evaluatingIndex] : undefined;

  const handleSetValue = async (id_user: number, id_competency: number, value: boolean | null) => {
    try {
      await setValue({ id_user, id_competency, value });
    } catch {
      message.error('No se pudo guardar. Inténtalo de nuevo.');
    }
  };

  return (
    <div>
      <p style={{ color: '#8a968d', marginTop: -4, marginBottom: 16 }}>
        25 competencias por trabajador. El valor de partida se autorrellena según el puesto — editable trabajador a trabajador desde "Evaluar".
      </p>
      <Table
        rowKey="id_user"
        loading={isLoading}
        dataSource={data?.members}
        pagination={false}
        columns={[
          { title: 'Nombre', key: 'name', render: (_, r) => `${r.name} ${r.first_surname ?? ''} ${r.second_surname ?? ''}`.trim() },
          { title: 'DNI', dataIndex: 'dni' },
          {
            title: 'Puesto',
            key: 'job_position',
            render: (_, r) => r.job_position
              ? (r.id_job_position ? r.job_position : <span>{r.job_position} <Tag color="orange">sin mapear</Tag></span>)
              : <span style={{ color: '#8a968d' }}>—</span>,
          },
          {
            title: 'Resumen',
            key: 'summary',
            render: (_, r) => {
              const applicable = r.values.filter((v) => v.value !== null).length;
              const needsImprovement = r.values.filter((v) => v.value === false).length;
              return needsImprovement > 0
                ? <Tag color="red">{needsImprovement} necesita(n) mejorar</Tag>
                : <Tag color="green">{applicable}/{r.values.length} sin necesidad de mejora</Tag>;
            },
          },
          {
            title: '',
            key: 'actions',
            width: 100,
            render: (_, r) => <Button size="small" onClick={() => setEvaluatingUserId(r.id_user)}>Evaluar</Button>,
          },
        ]}
      />

      <Modal
        open={!!evaluatingMember}
        title={evaluatingMember ? `${evaluatingMember.name} ${evaluatingMember.first_surname ?? ''} ${evaluatingMember.second_surname ?? ''}`.trim() : ''}
        onCancel={() => setEvaluatingUserId(undefined)}
        footer={[
          <Button key="prev" icon={<LeftOutlined />} disabled={evaluatingIndex <= 0} onClick={() => setEvaluatingUserId(data?.members[evaluatingIndex - 1]?.id_user)}>Anterior</Button>,
          <Button key="next" icon={<RightOutlined />} iconPosition="end" disabled={evaluatingIndex < 0 || evaluatingIndex >= (data?.members.length ?? 0) - 1} onClick={() => setEvaluatingUserId(data?.members[evaluatingIndex + 1]?.id_user)}>Siguiente</Button>,
          <Button key="close" type="primary" onClick={() => setEvaluatingUserId(undefined)}>Cerrar</Button>,
        ]}
        width={640}
      >
        {evaluatingMember && !evaluatingMember.id_job_position && (
          <p style={{ color: '#d4380d' }}>
            Puesto "{evaluatingMember.job_position ?? 'sin especificar'}" sin mapear al catálogo — no hay autorelleno.
          </p>
        )}
        {evaluatingMember?.values.map((v) => (
          <div key={v.id_competency} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '6px 0', borderBottom: '1px solid #eee' }}>
            <span>{data?.competencies.find((c) => c.id_competency === v.id_competency)?.name}</span>
            <Segmented
              value={v.value === true ? 'ok' : v.value === false ? 'improve' : 'na'}
              onChange={(val) => handleSetValue(evaluatingMember.id_user, v.id_competency, val === 'ok' ? true : val === 'improve' ? false : null)}
              options={[
                { label: 'No necesita mejorar', value: 'ok' },
                { label: 'Necesita mejorar', value: 'improve' },
                { label: 'No aplica', value: 'na' },
              ]}
            />
          </div>
        ))}
      </Modal>
    </div>
  );
}
