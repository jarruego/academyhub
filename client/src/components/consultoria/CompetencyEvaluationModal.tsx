import { Button, Modal, Select, Tooltip } from "antd";
import { LeftOutlined, RightOutlined } from "@ant-design/icons";

export type CompetencyEvaluationMember = {
  id_user: number;
  name: string;
  first_surname?: string | null;
  second_surname?: string | null;
  job_position?: string | null;
  id_job_position: number | null;
  values: { id_competency: number; value: boolean | null }[];
};

type CompetencyValueState = "ok" | "improve" | "na";

const COMPETENCY_VALUE_OPTIONS: { state: CompetencyValueState; color: string; label: string }[] = [
  { state: "ok", color: "#389e0d", label: "No necesita mejorar" },
  { state: "improve", color: "#cf1322", label: "Necesita mejorar" },
  { state: "na", color: "#8c8c8c", label: "No aplica" },
];

const toState = (value: boolean | null): CompetencyValueState => (value === true ? "ok" : value === false ? "improve" : "na");
const toValue = (state: CompetencyValueState): boolean | null => (state === "ok" ? true : state === "improve" ? false : null);

// Selector de 3 cuadrados (verde/rojo/gris) en vez del Segmented de texto:
// se reconoce el valor de un vistazo por color, sin tener que leer las tres
// etiquetas — que siguen ahí como `title`/`aria-label` de cada cuadrado.
function CompetencyValueToggle({ value, onChange }: { value: boolean | null; onChange: (value: boolean | null) => void }) {
  const state = toState(value);
  return (
    <div style={{ display: "flex", gap: 6 }} role="radiogroup" aria-label="Valoración de la competencia">
      {COMPETENCY_VALUE_OPTIONS.map((opt) => {
        const active = state === opt.state;
        return (
          <button
            key={opt.state}
            type="button"
            role="radio"
            aria-checked={active}
            title={opt.label}
            aria-label={opt.label}
            onClick={() => onChange(toValue(opt.state))}
            style={{
              width: 26,
              height: 26,
              flexShrink: 0,
              borderRadius: 4,
              cursor: "pointer",
              border: `2px solid ${opt.color}`,
              background: active ? opt.color : "transparent",
              color: active ? "#fff" : opt.color,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 0,
              fontSize: 14,
              lineHeight: 1,
              fontWeight: 700,
            }}
          >
            {active ? "✓" : ""}
          </button>
        );
      })}
    </div>
  );
}

// Nombre del puesto mapeado + selector para mapear/remapear, con el valor
// original (tal cual llega en `user.job_position`) entre paréntesis — en
// rojo mientras no haya mapeo, porque entonces no hay autorelleno de
// competencias para ese trabajador. Mapear es SIEMPRE editable, esté ya
// mapeado o no (`upsertAlias` hace tanto el alta como el cambio).
function JobPositionField({
  jobPosition,
  idJobPosition,
  jobPositionOptions,
  onChange,
}: {
  jobPosition: string;
  idJobPosition: number | null;
  jobPositionOptions: { value: number; label: string }[];
  onChange: (id_job_position: number) => void;
}) {
  const mapped = idJobPosition != null;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, flexWrap: "wrap", fontWeight: 400, fontSize: 14 }}>
      <Select
        showSearch
        size="small"
        placeholder="Elegir puesto del catálogo…"
        status={mapped ? undefined : "error"}
        style={{ width: 220 }}
        value={idJobPosition ?? undefined}
        onChange={onChange}
        filterOption={(input, option) => (option?.label as string ?? "").toLowerCase().includes(input.toLowerCase())}
        options={jobPositionOptions}
      />
      <Tooltip title="Valor de «Puesto» tal cual llega del trabajador, sin mapear al catálogo">
        <span style={{ color: mapped ? "var(--ink-faint, #8a968d)" : "#cf1322", fontWeight: mapped ? 400 : 600 }}>
          ({jobPosition})
        </span>
      </Tooltip>
    </span>
  );
}

export type CompetencyEvaluationModalProps = {
  member: CompetencyEvaluationMember | undefined;
  competencies: { id_competency: number; name: string }[];
  jobPositionOptions: { value: number; label: string }[];
  onClose: () => void;
  onChangeValue: (id_user: number, id_competency: number, value: boolean | null) => void;
  onChangeJobPosition: (job_position: string, id_job_position: number) => void;
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
};

// Modal paso a paso de evaluación de competencias — compartida entre la
// vista interna (ADMIN/CONSULTOR, consulting-engagement-center.route.tsx) y
// el acceso externo del centro por token (consulting-centro-competencies-
// tab.tsx): mismo diseño en las dos, cada una con su propia fuente de datos
// (autenticada vs. token) para las mutaciones que recibe por props.
export function CompetencyEvaluationModal({
  member,
  competencies,
  jobPositionOptions,
  onClose,
  onChangeValue,
  onChangeJobPosition,
  hasPrev,
  hasNext,
  onPrev,
  onNext,
}: CompetencyEvaluationModalProps) {
  const fullName = member ? `${member.name} ${member.first_surname ?? ""} ${member.second_surname ?? ""}`.trim() : "";

  return (
    <Modal
      open={!!member}
      title={
        member ? (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span>{fullName}</span>
            {member.job_position && (
              <JobPositionField
                jobPosition={member.job_position}
                idJobPosition={member.id_job_position}
                jobPositionOptions={jobPositionOptions}
                onChange={(id_job_position) => onChangeJobPosition(member.job_position as string, id_job_position)}
              />
            )}
          </span>
        ) : (
          ""
        )
      }
      onCancel={onClose}
      footer={[
        <Button key="prev" icon={<LeftOutlined />} disabled={!hasPrev} onClick={onPrev}>Anterior</Button>,
        <Button key="next" icon={<RightOutlined />} iconPosition="end" disabled={!hasNext} onClick={onNext}>Siguiente</Button>,
        <Button key="close" type="primary" onClick={onClose}>Cerrar</Button>,
      ]}
      width="80%"
      style={{ maxWidth: 1100 }}
    >
      <div className="competency-evaluation-grid">
        {member?.values.map((v) => (
          <div key={v.id_competency} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "6px 0", borderBottom: "1px solid var(--border-faint, #eee)" }}>
            <span>{competencies.find((c) => c.id_competency === v.id_competency)?.name}</span>
            <CompetencyValueToggle value={v.value} onChange={(value) => onChangeValue(member.id_user, v.id_competency, value)} />
          </div>
        ))}
      </div>
    </Modal>
  );
}
