import { useParams, Link } from "react-router-dom";
import { App, Button, DatePicker, Input, InputNumber, Select, Table, Tag } from "antd";
import { DeleteOutlined } from "@ant-design/icons";
import { useEffect, useMemo, useState } from "react";
import dayjs, { Dayjs } from "dayjs";
import { RouteTabs } from "../../components/common/RouteTabs";
import { AuthzHide } from "../../components/permissions/authz-hide";
import { Role } from "../../hooks/api/auth/use-login.mutation";
import { useConsultingClientQuery } from "../../hooks/api/consulting-client/use-consulting-client.query";
import { useCenterQuery } from "../../hooks/api/centers/use-center.query";
import { useConsultingPlanItemsQuery } from "../../hooks/api/consulting-plan-item/use-consulting-plan-items.query";
import { useOrganizationSettingsQuery } from "../../hooks/api/organization/use-organization-settings.query";
import { useConsultingActionEvaluationsQuery } from "../../hooks/api/consulting-action-evaluation/use-consulting-action-evaluations.query";
import { useCreateConsultingActionEvaluationMutation } from "../../hooks/api/consulting-action-evaluation/use-create-consulting-action-evaluation.mutation";
import { useUpdateConsultingActionEvaluationMutation } from "../../hooks/api/consulting-action-evaluation/use-update-consulting-action-evaluation.mutation";
import { useDeleteConsultingActionEvaluationMutation } from "../../hooks/api/consulting-action-evaluation/use-delete-consulting-action-evaluation.mutation";
import { ConsultingActionEvaluation } from "../../shared/types/consulting-action-evaluation/consulting-action-evaluation";
import { useAllUsersLookupQuery } from "../../hooks/api/users/use-users.query";
import { useConsultingRosterQuery } from "../../hooks/api/consulting-cuadro/use-consulting-roster.query";
import { useSetConsultingRosterAdjustmentMutation } from "../../hooks/api/consulting-cuadro/use-set-consulting-roster-adjustment.mutation";
import { useRemoveConsultingRosterAdjustmentMutation } from "../../hooks/api/consulting-cuadro/use-remove-consulting-roster-adjustment.mutation";
import { useConsultingCuadroQuery } from "../../hooks/api/consulting-cuadro/use-consulting-cuadro.query";
import { useAddConsultingActionAttendeeMutation } from "../../hooks/api/consulting-cuadro/use-add-consulting-action-attendee.mutation";
import { useRemoveConsultingActionAttendeeMutation } from "../../hooks/api/consulting-cuadro/use-remove-consulting-action-attendee.mutation";

// Todo lo de un centro dentro de una consultoría anual concreta vive aquí —
// Evaluación de acciones y Cuadro de formación siempre atados a
// (id_annual_engagement, id_center), nunca inferidos. Ver docs/consultoria.md.
export default function ConsultingEngagementCenterRoute() {
  const { id, id_annual_engagement, id_center } = useParams();
  const id_consulting_client = id || "";
  const { message, modal } = App.useApp();

  const { data: clientData } = useConsultingClientQuery(id_consulting_client);
  const { data: centerData } = useCenterQuery(id_center || "");
  const { data: planItemsData } = useConsultingPlanItemsQuery(id_consulting_client);
  const { data: orgSettings } = useOrganizationSettingsQuery();
  const orgName = orgSettings?.settings?.company?.razon_social || orgSettings?.settings?.site_name || '';

  const effectivePlanActions = useMemo(() => {
    const map = new Map<number, { name: string; origin?: string | null }>();
    for (const item of planItemsData ?? []) {
      if (item.id_center === null || item.id_center === Number(id_center)) map.set(item.id_catalog_course, { name: item.name, origin: item.origin });
    }
    return Array.from(map, ([id_catalog_course, { name, origin }]) => ({ id_catalog_course, name, origin }));
  }, [planItemsData, id_center]);

  // --- Evaluación de acciones ---
  const { data: evaluationsData, isLoading: isEvaluationsLoading } = useConsultingActionEvaluationsQuery(id_consulting_client, id_annual_engagement || "", id_center || "");
  const { mutateAsync: createEvaluation, isPending: isCreatingEvaluation } = useCreateConsultingActionEvaluationMutation(id_consulting_client, id_annual_engagement || "", id_center || "");
  const { mutateAsync: updateEvaluation, isPending: isUpdatingEvaluation } = useUpdateConsultingActionEvaluationMutation(id_consulting_client, id_annual_engagement || "", id_center || "");
  const { mutateAsync: deleteEvaluation } = useDeleteConsultingActionEvaluationMutation(id_consulting_client, id_annual_engagement || "", id_center || "");

  const [editingEvaluationId, setEditingEvaluationId] = useState<number | undefined>();
  const [evalCatalogCourseId, setEvalCatalogCourseId] = useState<number | undefined>();
  const [evalDate, setEvalDate] = useState<Dayjs | null>(dayjs());
  const [evalPercentage, setEvalPercentage] = useState<number | null>(null);
  const [evalText, setEvalText] = useState('');
  const [evalImparte, setEvalImparte] = useState('');

  const selectedActionOrigin = effectivePlanActions.find((a) => a.id_catalog_course === evalCatalogCourseId)?.origin;
  const isOwnAction = selectedActionOrigin === 'OWN';

  // Acción propia (de Mecohisa, dentro de la app) → quien imparte siempre es
  // la organización, no se elige a mano. El backend lo fuerza igual aunque
  // esto fallara, pero así el campo refleja la realidad sin que el usuario
  // tenga que escribirlo. Ver docs/consultoria.md.
  useEffect(() => {
    if (isOwnAction && orgName) setEvalImparte(orgName);
  }, [isOwnAction, orgName]);

  const resetEvaluationForm = () => {
    setEditingEvaluationId(undefined);
    setEvalCatalogCourseId(undefined);
    setEvalDate(dayjs());
    setEvalPercentage(null);
    setEvalText('');
    setEvalImparte('');
  };

  const handleEditEvaluation = (evaluation: ConsultingActionEvaluation) => {
    setEditingEvaluationId(evaluation.id_action_evaluation);
    setEvalCatalogCourseId(evaluation.id_catalog_course);
    setEvalDate(dayjs(evaluation.evaluation_date));
    setEvalPercentage(evaluation.percentage);
    setEvalText(evaluation.evaluation_text ?? '');
    setEvalImparte(evaluation.imparte_text ?? '');
  };

  const handleSubmitEvaluation = async () => {
    if (!evalDate || (!editingEvaluationId && !evalCatalogCourseId)) return;
    try {
      const payload = {
        evaluation_date: evalDate.format('YYYY-MM-DD'),
        evaluation_text: evalText || undefined,
        percentage: evalPercentage ?? undefined,
        imparte_text: evalImparte || undefined,
      };
      if (editingEvaluationId) {
        await updateEvaluation({ id_action_evaluation: editingEvaluationId, data: payload });
      } else {
        await createEvaluation({ id_catalog_course: evalCatalogCourseId!, ...payload });
      }
      resetEvaluationForm();
    } catch {
      message.error('No se pudo guardar la evaluación. Si el porcentaje es menor de 50, el texto de evaluación es obligatorio; y la fecha debe caer en el año de esta consultoría.');
    }
  };

  const handleDeleteEvaluation = (id_action_evaluation: number, name: string) => {
    modal.confirm({
      title: `¿Borrar la evaluación de "${name}"?`,
      okText: "Borrar",
      okType: "danger",
      cancelText: "Cancelar",
      onOk: async () => {
        try {
          await deleteEvaluation(id_action_evaluation);
        } catch {
          message.error('No se pudo borrar la evaluación. Inténtalo de nuevo.');
        }
      },
    });
  };

  // --- Cuadro de formación (roster + cruce trabajador × acción) ---
  const { data: allUsersData } = useAllUsersLookupQuery();
  const { data: rosterData, isLoading: isRosterLoading } = useConsultingRosterQuery(id_consulting_client, id_annual_engagement || "", id_center || "");
  const { mutateAsync: setRosterAdjustment, isPending: isSettingRoster } = useSetConsultingRosterAdjustmentMutation(id_consulting_client, id_annual_engagement || "", id_center || "");
  const { mutateAsync: removeRosterAdjustment } = useRemoveConsultingRosterAdjustmentMutation(id_consulting_client, id_annual_engagement || "", id_center || "");
  const { data: cuadroData, isLoading: isCuadroLoading } = useConsultingCuadroQuery(id_consulting_client, id_annual_engagement || "", id_center || "");
  const { mutateAsync: addAttendee, isPending: isAddingAttendee } = useAddConsultingActionAttendeeMutation(id_consulting_client, id_annual_engagement || "", id_center || "");
  const { mutateAsync: removeAttendee } = useRemoveConsultingActionAttendeeMutation(id_consulting_client, id_annual_engagement || "", id_center || "");

  const [rosterUserId, setRosterUserId] = useState<number | undefined>();
  const [attendeeCatalogCourseId, setAttendeeCatalogCourseId] = useState<number | undefined>();
  const [attendeeUserId, setAttendeeUserId] = useState<number | undefined>();
  const [attendeeDate, setAttendeeDate] = useState<Dayjs | null>(dayjs());

  const userOptions = (allUsersData ?? []).map((u) => ({
    value: u.id_user,
    label: `${u.name} ${u.first_surname ?? ''} ${u.second_surname ?? ''}${u.dni ? ` — ${u.dni}` : ''}`.trim(),
  }));

  const handleAddToRoster = async () => {
    if (!rosterUserId) return;
    try {
      await setRosterAdjustment({ id_user: rosterUserId, adjustment_type: 'ADD' });
      setRosterUserId(undefined);
    } catch {
      message.error('No se pudo añadir al roster. Inténtalo de nuevo.');
    }
  };

  const handleRemoveFromRoster = (id_user: number, name: string, source: 'real' | 'added') => {
    modal.confirm({
      title: `¿Quitar a "${name}" del roster de este centro?`,
      content: source === 'real' ? 'Sigue asociado realmente a este centro — esto solo lo excluye del cuadro/competencias de Consultoría.' : undefined,
      okText: "Quitar",
      okType: "danger",
      cancelText: "Cancelar",
      onOk: async () => {
        try {
          await setRosterAdjustment({ id_user, adjustment_type: 'REMOVE' });
        } catch {
          message.error('No se pudo quitar del roster. Inténtalo de nuevo.');
        }
      },
    });
  };

  const handleUndoAdjustment = (id_roster_adjustment: number) => {
    modal.confirm({
      title: '¿Deshacer este ajuste?',
      content: 'Vuelve al estado real (sin ajuste manual).',
      okText: "Deshacer",
      cancelText: "Cancelar",
      onOk: async () => {
        try {
          await removeRosterAdjustment(id_roster_adjustment);
        } catch {
          message.error('No se pudo deshacer el ajuste. Inténtalo de nuevo.');
        }
      },
    });
  };

  const handleAddAttendee = async () => {
    if (!attendeeCatalogCourseId || !attendeeUserId || !attendeeDate) return;
    try {
      await addAttendee({ id_catalog_course: attendeeCatalogCourseId, id_user: attendeeUserId, attended_at: attendeeDate.format('YYYY-MM-DD') });
      setAttendeeCatalogCourseId(undefined);
      setAttendeeUserId(undefined);
      setAttendeeDate(dayjs());
    } catch {
      message.error('No se pudo registrar el asistente. Si esta acción tiene matrícula real (edición), el cuadro se deriva automáticamente y no admite registro a mano.');
    }
  };

  const handleRemoveAttendee = (id_action_attendee: number, name: string) => {
    modal.confirm({
      title: `¿Quitar a "${name}" de esta acción?`,
      okText: "Quitar",
      okType: "danger",
      cancelText: "Cancelar",
      onOk: async () => {
        try {
          await removeAttendee(id_action_attendee);
        } catch {
          message.error('No se pudo quitar. Inténtalo de nuevo.');
        }
      },
    });
  };

  const year = rosterData?.year ?? cuadroData?.year;

  const items = [
    {
      key: "evaluacion",
      label: "Evaluación de acciones",
      children: (
        <div>
          <p style={{ color: 'var(--ink-faint, #8a968d)', marginTop: -4, marginBottom: 16 }}>
            Solo se pueden evaluar acciones que ya están en el plan de este centro (base o propia). La fecha de evaluación debe caer en el año de esta consultoría.
          </p>
          <AuthzHide roles={[Role.ADMIN, Role.CONSULTOR]}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              <Select
                showSearch
                placeholder="Acción del plan..."
                style={{ minWidth: 280 }}
                value={evalCatalogCourseId}
                onChange={setEvalCatalogCourseId}
                disabled={!!editingEvaluationId}
                filterOption={(input, option) => (option?.label as string ?? '').toLowerCase().includes(input.toLowerCase())}
                options={effectivePlanActions.map((a) => ({ value: a.id_catalog_course, label: a.name }))}
              />
              <DatePicker value={evalDate} onChange={setEvalDate} placeholder="Fecha" />
              <InputNumber value={evalPercentage} onChange={(v) => setEvalPercentage(v)} min={0} max={100} placeholder="%" style={{ width: 90 }} />
              <Input
                value={evalImparte}
                onChange={(e) => setEvalImparte(e.target.value)}
                placeholder="Imparte (empresa/centro)"
                style={{ width: 220 }}
                disabled={isOwnAction}
                title={isOwnAction ? "Acción propia — siempre la imparte la organización" : undefined}
              />
            </div>
            <Input.TextArea
              value={evalText}
              onChange={(e) => setEvalText(e.target.value)}
              placeholder="Evaluación / motivo (obligatorio si el porcentaje es menor de 50)"
              rows={2}
              style={{ marginBottom: 8, maxWidth: 720 }}
            />
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <Button
                type="primary"
                onClick={handleSubmitEvaluation}
                disabled={!evalDate || (!editingEvaluationId && !evalCatalogCourseId)}
                loading={isCreatingEvaluation || isUpdatingEvaluation}
              >
                {editingEvaluationId ? 'Guardar cambios' : 'Añadir evaluación'}
              </Button>
              {editingEvaluationId && <Button onClick={resetEvaluationForm}>Cancelar</Button>}
            </div>
          </AuthzHide>
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
                  <AuthzHide roles={[Role.ADMIN, Role.CONSULTOR]}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <Button size="small" onClick={() => handleEditEvaluation(record)}>Editar</Button>
                      <Button
                        danger
                        type="text"
                        size="small"
                        icon={<DeleteOutlined />}
                        onClick={() => handleDeleteEvaluation(record.id_action_evaluation, record.name)}
                        aria-label={`Borrar evaluación de ${record.name}`}
                      />
                    </div>
                  </AuthzHide>
                ),
              },
            ]}
          />
        </div>
      ),
    },
    {
      key: "cuadro",
      label: "Cuadro",
      children: (
        <div>
          <h3 style={{ marginTop: 0 }}>Roster del centro</h3>
          <p style={{ color: 'var(--ink-faint, #8a968d)', marginTop: -4, marginBottom: 16 }}>
            Trabajadores reales de este centro activos en {year ?? 'este año'}, más los ajustes manuales (añadir/quitar) que no tocan la asociación real — sirve de base para este cuadro y, más adelante, para la evaluación de competencias.
          </p>
          <AuthzHide roles={[Role.ADMIN, Role.CONSULTOR]}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
              <Select
                showSearch
                placeholder="Buscar trabajador por nombre, DNI, teléfono o email..."
                style={{ minWidth: 360 }}
                value={rosterUserId}
                onChange={setRosterUserId}
                filterOption={(input, option) => (option?.label as string ?? '').toLowerCase().includes(input.toLowerCase())}
                options={userOptions}
              />
              <Button type="primary" onClick={handleAddToRoster} disabled={!rosterUserId} loading={isSettingRoster}>
                Añadir al roster
              </Button>
            </div>
          </AuthzHide>
          <Table
            rowKey="id_user"
            loading={isRosterLoading}
            dataSource={rosterData?.members}
            pagination={false}
            columns={[
              { title: 'Nombre', key: 'name', render: (_, r) => `${r.name} ${r.first_surname ?? ''} ${r.second_surname ?? ''}`.trim() },
              { title: 'DNI', dataIndex: 'dni' },
              { title: 'Cargo', dataIndex: 'job_position' },
              { title: 'Origen', dataIndex: 'source', render: (source: string) => source === 'real' ? <Tag>Real</Tag> : <Tag color="blue">Añadido a mano</Tag> },
              {
                title: '',
                key: 'actions',
                width: 80,
                render: (_, record) => (
                  <AuthzHide roles={[Role.ADMIN, Role.CONSULTOR]}>
                    <Button
                      danger
                      type="text"
                      size="small"
                      icon={<DeleteOutlined />}
                      onClick={() => handleRemoveFromRoster(record.id_user, record.name, record.source)}
                      aria-label={`Quitar a ${record.name}`}
                    />
                  </AuthzHide>
                ),
              },
            ]}
          />
          {(rosterData?.adjustments?.length ?? 0) > 0 && (
            <>
              <h3 style={{ marginTop: 32 }}>Ajustes manuales</h3>
              <Table
                rowKey="id_roster_adjustment"
                dataSource={rosterData?.adjustments}
                pagination={false}
                columns={[
                  { title: 'Nombre', key: 'name', render: (_, r) => `${r.name} ${r.first_surname ?? ''} ${r.second_surname ?? ''}`.trim() },
                  { title: 'Ajuste', dataIndex: 'adjustment_type', render: (t: string) => t === 'ADD' ? <Tag color="blue">Añadido</Tag> : <Tag color="orange">Quitado</Tag> },
                  {
                    title: '',
                    key: 'actions',
                    width: 100,
                    render: (_, record) => (
                      <AuthzHide roles={[Role.ADMIN, Role.CONSULTOR]}>
                        <Button size="small" onClick={() => handleUndoAdjustment(record.id_roster_adjustment)}>Deshacer</Button>
                      </AuthzHide>
                    ),
                  },
                ]}
              />
            </>
          )}

          <h3 style={{ marginTop: 32 }}>Cruce trabajador × acción</h3>
          <p style={{ color: 'var(--ink-faint, #8a968d)', marginTop: -4, marginBottom: 16 }}>
            Automático para acciones con matrícula real (edición) — solo lectura, no se toca desde aquí. Para acciones sin matrícula real (externas, o propias sin edición), se registra a mano.
          </p>
          <AuthzHide roles={[Role.ADMIN, Role.CONSULTOR]}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
              <Select
                showSearch
                placeholder="Acción del plan..."
                style={{ minWidth: 240 }}
                value={attendeeCatalogCourseId}
                onChange={setAttendeeCatalogCourseId}
                filterOption={(input, option) => (option?.label as string ?? '').toLowerCase().includes(input.toLowerCase())}
                options={effectivePlanActions.map((a) => ({ value: a.id_catalog_course, label: a.name }))}
              />
              <Select
                showSearch
                placeholder="Trabajador..."
                style={{ minWidth: 320 }}
                value={attendeeUserId}
                onChange={setAttendeeUserId}
                filterOption={(input, option) => (option?.label as string ?? '').toLowerCase().includes(input.toLowerCase())}
                options={userOptions}
              />
              <DatePicker value={attendeeDate} onChange={setAttendeeDate} placeholder="Fecha" />
              <Button type="primary" onClick={handleAddAttendee} disabled={!attendeeCatalogCourseId || !attendeeUserId} loading={isAddingAttendee}>
                Registrar asistente
              </Button>
            </div>
          </AuthzHide>
          <Table
            rowKey={(r) => r.id_action_attendee ?? `${r.id_catalog_course}-${r.id_user}-real`}
            loading={isCuadroLoading}
            dataSource={cuadroData?.rows}
            pagination={false}
            columns={[
              { title: 'Acción', dataIndex: 'action_name' },
              { title: 'Trabajador', key: 'name', render: (_, r) => `${r.name} ${r.first_surname ?? ''} ${r.second_surname ?? ''}`.trim() },
              { title: 'DNI', dataIndex: 'dni' },
              { title: 'Cargo', dataIndex: 'job_position' },
              { title: 'Fecha', dataIndex: 'attended_at', render: (v: string) => v ? new Date(v).toLocaleDateString() : '—' },
              { title: 'Origen', dataIndex: 'source', render: (source: string) => source === 'real' ? <Tag>Matrícula real</Tag> : <Tag color="blue">Manual</Tag> },
              {
                title: '',
                key: 'actions',
                width: 80,
                render: (_, record) => record.source === 'manual' ? (
                  <AuthzHide roles={[Role.ADMIN, Role.CONSULTOR]}>
                    <Button
                      danger
                      type="text"
                      size="small"
                      icon={<DeleteOutlined />}
                      onClick={() => handleRemoveAttendee(record.id_action_attendee!, record.name)}
                      aria-label={`Quitar a ${record.name}`}
                    />
                  </AuthzHide>
                ) : null,
              },
            ]}
          />
        </div>
      ),
    },
  ];

  return (
    <div>
      <p>
        <Link to={`/consultoria/clients/${id_consulting_client}/annual-engagements/${id_annual_engagement}`}>← Centros de la consultoría</Link>
      </p>
      <h2 style={{ marginTop: 0 }}>Consultoría {year ?? ''} — {clientData?.name ?? ''} · {centerData?.center_name ?? ''}</h2>
      <RouteTabs items={items} />
    </div>
  );
}
