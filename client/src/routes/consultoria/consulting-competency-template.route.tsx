import { useMemo, useState } from "react";
import { App, Button, Input, Modal, Select, Table } from "antd";
import { DeleteOutlined, EditOutlined, PlusOutlined, ThunderboltOutlined } from "@ant-design/icons";
import { Link } from "react-router-dom";
import { AuthzHide } from "../../components/permissions/authz-hide";
import { Role } from "../../hooks/api/auth/use-login.mutation";
import { useRole } from "../../utils/permissions/use-role";
import { RouteTabs } from "../../components/common/RouteTabs";
import { ConfirmPasswordModal } from "../../components/common/ConfirmPasswordModal";
import { useVerifyPasswordMutation } from "../../hooks/api/auth/use-verify-password.mutation";
import { useConsultingJobPositionsQuery } from "../../hooks/api/consulting-job-position/use-consulting-job-positions.query";
import { useConsultingCompetenciesQuery } from "../../hooks/api/consulting-competency/use-consulting-competencies.query";
import { useCreateConsultingCompetencyMutation } from "../../hooks/api/consulting-competency/use-create-consulting-competency.mutation";
import { useUpdateConsultingCompetencyMutation } from "../../hooks/api/consulting-competency/use-update-consulting-competency.mutation";
import { useRemoveConsultingCompetencyMutation } from "../../hooks/api/consulting-competency/use-remove-consulting-competency.mutation";
import { useConsultingCompetencyTemplateQuery } from "../../hooks/api/consulting-job-position/use-consulting-competency-template.query";
import { useSetConsultingCompetencyTemplateMutation } from "../../hooks/api/consulting-job-position/use-set-consulting-competency-template.mutation";
import { useFillConsultingCatalogMutation } from "../../hooks/api/consulting-catalog-seed/use-fill-consulting-catalog.mutation";

const VALUE_OPTIONS = [
  { value: 'true', label: 'No necesita mejorar' },
  { value: 'false', label: 'Necesita mejorar' },
  { value: 'null', label: 'No aplica' },
];

const toOptionValue = (v: boolean | null) => v === true ? 'true' : v === false ? 'false' : 'null';
const fromOptionValue = (v: string): boolean | null => v === 'true' ? true : v === 'false' ? false : null;

const errorMessage = (error: unknown, fallback: string) =>
  (error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback;

// Una competencia es global (compartida por todas las plantillas de puesto),
// así que darla de alta/renombrarla/borrarla vive en su propia pestaña, no
// dentro de la vista de un puesto concreto — y, al afectar a todas las
// plantillas de golpe, se confirma con la contraseña del usuario (mismo
// mecanismo que la importación de Preinscritos INAEM). Ver docs/consultoria.md.
type PendingCompetencyAction =
  | { type: 'create'; name: string }
  | { type: 'rename'; id: number; oldName: string; newName: string }
  | { type: 'delete'; id: number; name: string };

export default function ConsultingCompetencyTemplateRoute() {
  const { message, modal } = App.useApp();
  const role = useRole();
  const canEdit = role === Role.ADMIN || role === Role.CONSULTOR;
  const { data: jobPositionsData } = useConsultingJobPositionsQuery();
  const { data: competenciesData, isLoading: isCompetenciesLoading } = useConsultingCompetenciesQuery();
  const { mutateAsync: createCompetency } = useCreateConsultingCompetencyMutation();
  const { mutateAsync: updateCompetency } = useUpdateConsultingCompetencyMutation();
  const { mutateAsync: removeCompetency } = useRemoveConsultingCompetencyMutation();
  const { mutateAsync: fillCatalog, isPending: isFillingCatalog } = useFillConsultingCatalogMutation();
  const verifyPassword = useVerifyPasswordMutation();

  const [selectedJobPositionId, setSelectedJobPositionId] = useState<number | undefined>();
  const [newCompetencyName, setNewCompetencyName] = useState("");
  const [competencyRenameDraft, setCompetencyRenameDraft] = useState<{ id: number; oldName: string; newName: string } | null>(null);
  const [pendingCompetencyAction, setPendingCompetencyAction] = useState<PendingCompetencyAction | null>(null);
  const [competencyPasswordError, setCompetencyPasswordError] = useState<string | null>(null);

  const { data: templateData, isLoading: isTemplateLoading } = useConsultingCompetencyTemplateQuery(selectedJobPositionId);
  const { mutateAsync: setTemplateValue } = useSetConsultingCompetencyTemplateMutation(selectedJobPositionId);

  const templateRows = useMemo(() => templateData ?? (competenciesData ?? []).map((c) => ({ id_competency: c.id_competency, name: c.name, default_value: null })), [templateData, competenciesData]);

  const handleFillCatalog = async () => {
    try {
      const result = await fillCatalog();
      modal.info({
        title: "Catálogo autorrellenado",
        content: `Añadidas ${result.competenciesCreated} competencias y ${result.jobPositionsCreated} puestos de trabajo, y fijados ${result.templateValuesSet} valores de plantilla (lo que ya existía por nombre, o ya tenía un valor guardado, no se ha tocado).`,
        okText: "Entendido",
      });
    } catch (error) {
      message.error(errorMessage(error, 'No se pudo autorrellenar el catálogo.'));
    }
  };

  const handleSetValue = async (id_competency: number, optionValue: string) => {
    try {
      await setTemplateValue({ id_competency, default_value: fromOptionValue(optionValue) });
    } catch {
      message.error('No se pudo guardar el valor por defecto.');
    }
  };

  // --- Competencias: globales, afectan a todas las plantillas — confirmación con contraseña ---
  const handleConfirmCompetencyAction = async (password: string) => {
    if (!pendingCompetencyAction) return;
    setCompetencyPasswordError(null);
    try {
      await verifyPassword.mutateAsync(password);
    } catch {
      setCompetencyPasswordError('Contraseña incorrecta.');
      return;
    }
    try {
      if (pendingCompetencyAction.type === 'create') {
        await createCompetency({ name: pendingCompetencyAction.name });
        setNewCompetencyName("");
      } else if (pendingCompetencyAction.type === 'rename') {
        await updateCompetency({ id_competency: pendingCompetencyAction.id, name: pendingCompetencyAction.newName });
      } else {
        await removeCompetency(pendingCompetencyAction.id);
      }
      setPendingCompetencyAction(null);
    } catch (error) {
      setCompetencyPasswordError(errorMessage(error, 'No se pudo completar la acción.'));
    }
  };

  const competencyActionDescription = (() => {
    if (!pendingCompetencyAction) return null;
    if (pendingCompetencyAction.type === 'create') {
      return <>Vas a añadir la competencia <strong>"{pendingCompetencyAction.name}"</strong> — aparecerá en la plantilla de <strong>todos los puestos</strong> (sin valor configurado todavía). Introduce tu contraseña para confirmarlo.</>;
    }
    if (pendingCompetencyAction.type === 'rename') {
      return <>Vas a renombrar <strong>"{pendingCompetencyAction.oldName}"</strong> a <strong>"{pendingCompetencyAction.newName}"</strong> — afecta a la plantilla de <strong>todos los puestos</strong> que la usan. Introduce tu contraseña para confirmarlo.</>;
    }
    return <>Vas a borrar la competencia <strong>"{pendingCompetencyAction.name}"</strong> — desaparece de la plantilla de <strong>todos los puestos</strong>. Se bloquea si algún puesto ya tiene un valor configurado para ella. Introduce tu contraseña para confirmarlo.</>;
  })();

  const items = [
    {
      key: "plantillas",
      label: "Plantillas por puesto",
      children: (
        <div>
          <p style={{ color: 'var(--ink-faint, #8a968d)', marginTop: -4, marginBottom: 16 }}>
            Fija con qué valor arranca la evaluación de un trabajador según su puesto. Se puede editar después, trabajador a trabajador. Las competencias en sí se gestionan en la pestaña "Competencias"; los puestos (añadir/renombrar/borrar) en <Link to="/consultoria/job-positions">Puestos de trabajo</Link>.
          </p>

          <Select
            showSearch
            placeholder="Elige un puesto de trabajo..."
            style={{ minWidth: 360, marginBottom: 16 }}
            value={selectedJobPositionId}
            onChange={setSelectedJobPositionId}
            filterOption={(input, option) => (option?.label as string ?? '').toLowerCase().includes(input.toLowerCase())}
            options={(jobPositionsData ?? []).map((p) => ({ value: p.id_job_position, label: p.group_name ? `${p.name} (${p.group_name})` : p.name }))}
          />

          {selectedJobPositionId && (
            <Table
              rowKey="id_competency"
              loading={isTemplateLoading}
              dataSource={templateRows}
              pagination={false}
              columns={[
                { title: 'Competencia', dataIndex: 'name' },
                {
                  title: 'Valor por defecto',
                  key: 'value',
                  width: 260,
                  render: (_, record) => canEdit ? (
                    <Select
                      style={{ width: 220 }}
                      value={toOptionValue(record.default_value)}
                      onChange={(v) => handleSetValue(record.id_competency, v)}
                      options={VALUE_OPTIONS}
                    />
                  ) : (VALUE_OPTIONS.find((o) => o.value === toOptionValue(record.default_value))?.label),
                },
              ]}
            />
          )}
        </div>
      ),
    },
    {
      key: "competencias",
      label: "Competencias",
      children: (
        <div>
          <p style={{ color: 'var(--ink-faint, #8a968d)', marginTop: -4, marginBottom: 16 }}>
            Catálogo de competencias, compartido por todas las plantillas de puesto. Añadir, renombrar o borrar una competencia afecta a la plantilla de todos los puestos — se pide tu contraseña para confirmarlo.
          </p>
          <AuthzHide roles={[Role.ADMIN]}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, maxWidth: 420 }}>
              <Input
                placeholder="Nueva competencia..."
                value={newCompetencyName}
                onChange={(e) => setNewCompetencyName(e.target.value)}
              />
              <Button
                icon={<PlusOutlined />}
                disabled={!newCompetencyName.trim()}
                onClick={() => setPendingCompetencyAction({ type: 'create', name: newCompetencyName.trim() })}
              >
                Añadir competencia
              </Button>
            </div>
          </AuthzHide>
          <Table
            rowKey="id_competency"
            loading={isCompetenciesLoading}
            dataSource={competenciesData}
            pagination={false}
            columns={[
              { title: 'Competencia', dataIndex: 'name' },
              {
                title: '',
                key: 'actions',
                width: 90,
                render: (_, record) => (
                  <AuthzHide roles={[Role.ADMIN]}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <Button size="small" type="text" icon={<EditOutlined />} onClick={() => setCompetencyRenameDraft({ id: record.id_competency, oldName: record.name, newName: record.name })} aria-label={`Renombrar ${record.name}`} />
                      <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => setPendingCompetencyAction({ type: 'delete', id: record.id_competency, name: record.name })} aria-label={`Borrar ${record.name}`} />
                    </div>
                  </AuthzHide>
                ),
              },
            ]}
          />
        </div>
      ),
    },
  ];

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Consultoría · Configurador de competencias por puesto</h2>

      <AuthzHide roles={[Role.ADMIN]}>
        <div style={{ border: '1px dashed var(--border-faint, #d9d9d9)', borderRadius: 6, padding: 12, marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
          <ThunderboltOutlined style={{ color: '#faad14' }} />
          <span style={{ flex: 1, color: 'var(--ink-faint, #8a968d)', fontSize: 13 }}>
            Herramienta temporal: da de alta de golpe un borrador de competencias/puestos habituales, para no escribirlos a mano. Se puede borrar sin problema cuando ya no haga falta.
          </span>
          <Button size="small" loading={isFillingCatalog} onClick={handleFillCatalog}>Autorrellenar catálogo</Button>
        </div>
      </AuthzHide>

      <RouteTabs items={items} />

      <Modal
        open={!!competencyRenameDraft}
        title="Renombrar competencia"
        onCancel={() => setCompetencyRenameDraft(null)}
        onOk={() => {
          if (!competencyRenameDraft || !competencyRenameDraft.newName.trim()) return;
          setPendingCompetencyAction({ type: 'rename', id: competencyRenameDraft.id, oldName: competencyRenameDraft.oldName, newName: competencyRenameDraft.newName.trim() });
          setCompetencyRenameDraft(null);
        }}
        okText="Continuar"
        cancelText="Cancelar"
      >
        <Input
          value={competencyRenameDraft?.newName ?? ''}
          onChange={(e) => setCompetencyRenameDraft((prev) => prev ? { ...prev, newName: e.target.value } : prev)}
          placeholder="Nombre"
        />
      </Modal>

      <ConfirmPasswordModal
        open={!!pendingCompetencyAction}
        title="Confirma tu contraseña"
        description={competencyActionDescription}
        confirmLoading={verifyPassword.isPending}
        error={competencyPasswordError}
        onConfirm={handleConfirmCompetencyAction}
        onCancel={() => { setPendingCompetencyAction(null); setCompetencyPasswordError(null); }}
      />
    </div>
  );
}
