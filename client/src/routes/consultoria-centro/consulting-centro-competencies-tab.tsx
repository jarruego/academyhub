import { useState } from "react";
import { App, Button, Table, Tag } from "antd";
import { useConsultingCentroCompetenciesQuery } from "../../hooks/api/consulting-centro/use-consulting-centro-competencies.query";
import { useSetConsultingCentroCompetencyMutation } from "../../hooks/api/consulting-centro/use-set-consulting-centro-competency.mutation";
import { useConsultingCentroJobPositionsQuery } from "../../hooks/api/consulting-centro/use-consulting-centro-job-positions.query";
import { useUpsertConsultingCentroJobPositionAliasMutation } from "../../hooks/api/consulting-centro/use-upsert-consulting-centro-job-position-alias.mutation";
import { CompetencyEvaluationModal } from "../../components/consultoria/CompetencyEvaluationModal";

interface Props {
  engagementId: number;
}

// Evaluación de competencias de los trabajadores de este centro — mismo
// patrón que la pestaña interna "Competencias" (tabla + modal paso a paso
// compartida, `CompetencyEvaluationModal`), alcance cerrado del acceso
// externo por token. El valor de partida se autorrellena desde la plantilla
// del puesto; el propio centro puede mapear/remapear su puesto al catálogo
// desde la modal — OJO: el mapeo es global (mismo texto de puesto puede
// venir de otros centros), decisión consciente, ver
// consulting_job_position_alias.table.ts.
export default function ConsultingCentroCompetenciesTab({ engagementId }: Props) {
  const { message } = App.useApp();
  const { data, isLoading } = useConsultingCentroCompetenciesQuery(engagementId);
  const { mutateAsync: setValue } = useSetConsultingCentroCompetencyMutation(engagementId);
  const { data: jobPositionsData } = useConsultingCentroJobPositionsQuery(engagementId);
  const { mutateAsync: upsertJobPositionAlias } = useUpsertConsultingCentroJobPositionAliasMutation(engagementId);
  const [evaluatingUserId, setEvaluatingUserId] = useState<number | undefined>();

  const evaluatingIndex = (data?.members ?? []).findIndex((m) => m.id_user === evaluatingUserId);
  const evaluatingMember = evaluatingIndex >= 0 ? data?.members[evaluatingIndex] : undefined;
  const jobPositionOptions = (jobPositionsData ?? []).map((p) => ({ value: p.id_job_position, label: p.group_name ? `${p.name} (${p.group_name})` : p.name }));

  const handleSetValue = async (id_user: number, id_competency: number, value: boolean | null) => {
    try {
      await setValue({ id_user, id_competency, value });
    } catch {
      message.error('No se pudo guardar. Inténtalo de nuevo.');
    }
  };

  const handleChangeJobPosition = async (job_position: string, id_job_position: number) => {
    try {
      await upsertJobPositionAlias({ job_position, id_job_position });
    } catch {
      message.error('No se pudo cambiar el puesto. Inténtalo de nuevo.');
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

      <CompetencyEvaluationModal
        member={evaluatingMember}
        competencies={data?.competencies ?? []}
        jobPositionOptions={jobPositionOptions}
        onClose={() => setEvaluatingUserId(undefined)}
        onChangeValue={handleSetValue}
        onChangeJobPosition={handleChangeJobPosition}
        hasPrev={evaluatingIndex > 0}
        hasNext={evaluatingIndex >= 0 && evaluatingIndex < (data?.members.length ?? 0) - 1}
        onPrev={() => setEvaluatingUserId(data?.members[evaluatingIndex - 1]?.id_user)}
        onNext={() => setEvaluatingUserId(data?.members[evaluatingIndex + 1]?.id_user)}
      />
    </div>
  );
}
