import { useParams, Link } from "react-router-dom";
import { Result, Tabs } from "antd";
import { useConsultingCentroEvaluationsQuery } from "../../hooks/api/consulting-centro/use-consulting-centro-evaluations.query";
import ConsultingCentroEvaluationsTab from "./consulting-centro-evaluations-tab";
import ConsultingCentroCompetenciesTab from "./consulting-centro-competencies-tab";
import ConsultingCentroAttendeesTab from "./consulting-centro-attendees-tab";

// Consultoría concreta de este centro — alcance cerrado del acceso externo
// por token (ver docs/consultoria.md): evaluar sus acciones, evaluar
// competencias, registrar asistentes de sus propias acciones. Sin roster
// ajustable ni búsqueda de todos los usuarios del sistema — eso sigue
// siendo solo de ADMIN/CONSULTOR. Pantallas simples por ahora (reutilizan
// la misma lógica que las internas); si en el futuro conviene una versión
// más amigable para los centros, se revisará entonces.
export default function ConsultingCentroEngagementRoute() {
  const { id_annual_engagement } = useParams<{ id_annual_engagement: string }>();
  const engagementId = Number(id_annual_engagement);
  const { isError } = useConsultingCentroEvaluationsQuery(engagementId);

  if (isError) {
    return <Result status="403" title="Sin acceso" subTitle="Este enlace no funciona, o este centro no participa en esta consultoría." />;
  }

  return (
    <div>
      <p><Link to="/consultoria-centro/app">&larr; Volver a mis consultorías</Link></p>
      <Tabs
        items={[
          { key: "evaluacion", label: "Evaluación de acciones", children: <ConsultingCentroEvaluationsTab engagementId={engagementId} /> },
          { key: "competencias", label: "Competencias", children: <ConsultingCentroCompetenciesTab engagementId={engagementId} /> },
          { key: "asistentes", label: "Asistentes", children: <ConsultingCentroAttendeesTab engagementId={engagementId} /> },
        ]}
      />
    </div>
  );
}
