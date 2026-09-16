import { useState } from "react";
import { App, Button, Divider, Input, Modal, Select, Table } from "antd";
import { DeleteOutlined, EditOutlined, PlusOutlined, ThunderboltOutlined } from "@ant-design/icons";
import { RouteTabs } from "../../components/common/RouteTabs";
import { useConsultingJobPositionsQuery } from "../../hooks/api/consulting-job-position/use-consulting-job-positions.query";
import { useCreateConsultingJobPositionMutation } from "../../hooks/api/consulting-job-position/use-create-consulting-job-position.mutation";
import { useUpdateConsultingJobPositionMutation } from "../../hooks/api/consulting-job-position/use-update-consulting-job-position.mutation";
import { useRemoveConsultingJobPositionMutation } from "../../hooks/api/consulting-job-position/use-remove-consulting-job-position.mutation";
import { useConsultingJobPositionGroupsQuery } from "../../hooks/api/consulting-job-position/use-consulting-job-position-groups.query";
import { useCreateConsultingJobPositionGroupMutation } from "../../hooks/api/consulting-job-position/use-create-consulting-job-position-group.mutation";
import { useUpdateConsultingJobPositionGroupMutation } from "../../hooks/api/consulting-job-position/use-update-consulting-job-position-group.mutation";
import { useRemoveConsultingJobPositionGroupMutation } from "../../hooks/api/consulting-job-position/use-remove-consulting-job-position-group.mutation";
import { useConsultingJobPositionAliasesUnmappedQuery } from "../../hooks/api/consulting-job-position/use-consulting-job-position-aliases-unmapped.query";
import { useConsultingJobPositionAliasesQuery } from "../../hooks/api/consulting-job-position/use-consulting-job-position-aliases.query";
import { useUpsertConsultingJobPositionAliasMutation } from "../../hooks/api/consulting-job-position/use-upsert-consulting-job-position-alias.mutation";
import { useRemoveConsultingJobPositionAliasMutation } from "../../hooks/api/consulting-job-position/use-remove-consulting-job-position-alias.mutation";
import { useAutoMapConsultingJobPositionsMutation } from "../../hooks/api/consulting-catalog-seed/use-automap-consulting-job-positions.mutation";

const errorMessage = (error: unknown, fallback: string) =>
  (error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback;

type JobPositionFormTarget = { id?: number; name: string; id_job_position_group: number | undefined };
type GroupFormTarget = { id?: number; name: string };

// Catálogo de puestos de trabajo de Consultoría (28 reales, ver
// docs/consultoria.md) + sus grupos + el mapeo de `user.job_position`
// (texto libre) contra ese catálogo, que resuelve el autorelleno de la
// evaluación de competencias. Antes el alta/edición/borrado de puestos
// vivía en el Configurador de competencias (/consultoria/competencies) —
// se centralizó aquí para no repartir la gestión del mismo catálogo en dos
// pantallas. El grupo del puesto era texto libre (`group_label`) — pasó a
// ser una entidad propia 2026-09-16 (pedido del usuario, para poder
// gestionar los grupos como tal: listarlos, renombrarlos, borrarlos).
export default function ConsultingJobPositionRoute() {
  const { message, modal } = App.useApp();
  const { data: jobPositionsData, isLoading: isJobPositionsLoading } = useConsultingJobPositionsQuery();
  const { mutateAsync: createJobPosition, isPending: isCreatingJobPosition } = useCreateConsultingJobPositionMutation();
  const { mutateAsync: updateJobPosition, isPending: isUpdatingJobPosition } = useUpdateConsultingJobPositionMutation();
  const { mutateAsync: removeJobPosition } = useRemoveConsultingJobPositionMutation();

  const { data: groupsData, isLoading: isGroupsLoading } = useConsultingJobPositionGroupsQuery();
  const { mutateAsync: createGroup, isPending: isCreatingGroup } = useCreateConsultingJobPositionGroupMutation();
  const { mutateAsync: updateGroup, isPending: isUpdatingGroup } = useUpdateConsultingJobPositionGroupMutation();
  const { mutateAsync: removeGroup } = useRemoveConsultingJobPositionGroupMutation();

  const { data: unmappedData, isLoading: isUnmappedLoading } = useConsultingJobPositionAliasesUnmappedQuery();
  const { data: aliasesData, isLoading: isAliasesLoading } = useConsultingJobPositionAliasesQuery();
  const { mutateAsync: upsertAlias, isPending: isUpserting } = useUpsertConsultingJobPositionAliasMutation();
  const { mutateAsync: removeAlias } = useRemoveConsultingJobPositionAliasMutation();
  const { mutateAsync: autoMap, isPending: isAutoMapping } = useAutoMapConsultingJobPositionsMutation();

  const [formTarget, setFormTarget] = useState<JobPositionFormTarget | null>(null);
  const [isGroupsManagerOpen, setIsGroupsManagerOpen] = useState(false);
  const [groupFormTarget, setGroupFormTarget] = useState<GroupFormTarget | null>(null);
  const [isCreatingGroupInline, setIsCreatingGroupInline] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [selections, setSelections] = useState<Record<string, number>>({});

  const jobPositionOptions = (jobPositionsData ?? []).map((p) => ({ value: p.id_job_position, label: p.group_name ? `${p.name} (${p.group_name})` : p.name }));
  const groupSelectOptions = (groupsData ?? []).map((g) => ({ value: g.id_job_position_group, label: g.name }));

  const handleUseNewGroup = async () => {
    if (!newGroupName.trim()) return;
    setIsCreatingGroupInline(true);
    try {
      const created = await createGroup({ name: newGroupName.trim() });
      setFormTarget((prev) => prev ? { ...prev, id_job_position_group: created.id_job_position_group } : prev);
      setNewGroupName("");
    } catch {
      message.error('No se pudo crear el grupo.');
    } finally {
      setIsCreatingGroupInline(false);
    }
  };

  const handleSaveJobPosition = async () => {
    if (!formTarget || !formTarget.name.trim()) return;
    try {
      if (formTarget.id) {
        await updateJobPosition({ id_job_position: formTarget.id, name: formTarget.name.trim(), id_job_position_group: formTarget.id_job_position_group ?? null });
      } else {
        await createJobPosition({ name: formTarget.name.trim(), id_job_position_group: formTarget.id_job_position_group ?? null });
      }
      setFormTarget(null);
    } catch {
      message.error('No se pudo guardar el puesto de trabajo.');
    }
  };

  const handleRemoveJobPosition = (id_job_position: number, name: string) => {
    modal.confirm({
      title: `¿Borrar el puesto "${name}"?`,
      okText: "Borrar",
      okType: "danger",
      cancelText: "Cancelar",
      onOk: async () => {
        try {
          await removeJobPosition(id_job_position);
        } catch (error) {
          modal.error({ title: "No se pudo borrar", content: errorMessage(error, 'Inténtalo de nuevo.'), okText: "Entendido" });
        }
      },
    });
  };

  const handleSaveGroup = async () => {
    if (!groupFormTarget || !groupFormTarget.name.trim()) return;
    try {
      if (groupFormTarget.id) {
        await updateGroup({ id_job_position_group: groupFormTarget.id, name: groupFormTarget.name.trim() });
      } else {
        await createGroup({ name: groupFormTarget.name.trim() });
      }
      setGroupFormTarget(null);
    } catch {
      message.error('No se pudo guardar el grupo.');
    }
  };

  const handleRemoveGroup = (id_job_position_group: number, name: string) => {
    modal.confirm({
      title: `¿Borrar el grupo "${name}"?`,
      okText: "Borrar",
      okType: "danger",
      cancelText: "Cancelar",
      onOk: async () => {
        try {
          await removeGroup(id_job_position_group);
        } catch (error) {
          modal.error({ title: "No se pudo borrar", content: errorMessage(error, 'Inténtalo de nuevo.'), okText: "Entendido" });
        }
      },
    });
  };

  const handleAutoMap = async () => {
    try {
      const result = await autoMap();
      modal.info({
        title: "Automapeo terminado",
        content: (
          <div>
            <p>{result.mapped} puestos mapeados automáticamente por palabra clave.</p>
            {result.garbage.length > 0 && <p>{result.garbage.length} valores no parecen un puesto real (revisar el dato de origen): {result.garbage.join(', ')}</p>}
            {result.unresolved.length > 0 && <p>{result.unresolved.length} sin coincidencia — siguen abajo, para asignar a mano.</p>}
          </div>
        ),
        okText: "Entendido",
        width: 480,
      });
    } catch {
      message.error('No se pudo automapear. Inténtalo de nuevo.');
    }
  };

  const handleAssign = async (job_position: string) => {
    const id_job_position = selections[job_position];
    if (!id_job_position) return;
    try {
      await upsertAlias({ job_position, id_job_position });
      setSelections((prev) => {
        const next = { ...prev };
        delete next[job_position];
        return next;
      });
    } catch {
      message.error('No se pudo asignar el puesto. Inténtalo de nuevo.');
    }
  };

  const handleChangeMapping = async (job_position: string, id_job_position: number) => {
    try {
      await upsertAlias({ job_position, id_job_position });
    } catch {
      message.error('No se pudo cambiar el mapeo. Inténtalo de nuevo.');
    }
  };

  const handleRemoveAlias = (id_job_position_alias: number, job_position: string) => {
    modal.confirm({
      title: `¿Quitar el mapeo de "${job_position}"?`,
      content: "Vuelve a la pestaña de pendientes de relacionar.",
      okText: "Quitar",
      okType: "danger",
      cancelText: "Cancelar",
      onOk: async () => {
        try {
          await removeAlias(id_job_position_alias);
        } catch {
          message.error('No se pudo quitar el mapeo. Inténtalo de nuevo.');
        }
      },
    });
  };

  const items = [
    {
      key: "listado",
      label: "Listado",
      children: (
        <div>
          <p style={{ color: 'var(--ink-faint, #8a968d)', marginTop: -4, marginBottom: 16 }}>
            Los puestos de trabajo de Consultoría — cada uno tiene su propia plantilla de competencias (en <code>/consultoria/competencies</code>).
          </p>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setFormTarget({ name: '', id_job_position_group: undefined })}>
              Añadir puesto
            </Button>
            <Button onClick={() => setIsGroupsManagerOpen(true)}>
              Gestionar grupos
            </Button>
          </div>
          <Table
            rowKey="id_job_position"
            loading={isJobPositionsLoading}
            dataSource={jobPositionsData}
            pagination={false}
            columns={[
              { title: 'Puesto', dataIndex: 'name', sorter: (a, b) => a.name.localeCompare(b.name) },
              { title: 'Grupo', dataIndex: 'group_name', sorter: (a, b) => (a.group_name ?? '').localeCompare(b.group_name ?? '') },
              {
                title: '',
                key: 'actions',
                width: 90,
                render: (_, record) => (
                  <div style={{ display: 'flex', gap: 4 }}>
                    <Button size="small" type="text" icon={<EditOutlined />} onClick={() => setFormTarget({ id: record.id_job_position, name: record.name, id_job_position_group: record.id_job_position_group ?? undefined })} aria-label={`Editar ${record.name}`} />
                    <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => handleRemoveJobPosition(record.id_job_position, record.name)} aria-label={`Borrar ${record.name}`} />
                  </div>
                ),
              },
            ]}
          />
        </div>
      ),
    },
    {
      key: "pendientes",
      label: "Pendientes de relacionar",
      children: (
        <div>
          <p style={{ color: 'var(--ink-faint, #8a968d)', marginTop: -4, marginBottom: 16 }}>
            Valores de "Puesto" que aparecen en trabajadores reales pero todavía no corresponden a ningún puesto del catálogo — sin relacionar, esos trabajadores no reciben autorelleno en la evaluación de competencias.
          </p>

          <div style={{ border: '1px dashed var(--border-faint, #d9d9d9)', borderRadius: 6, padding: 12, marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
            <ThunderboltOutlined style={{ color: '#faad14' }} />
            <span style={{ flex: 1, color: 'var(--ink-faint, #8a968d)', fontSize: 13 }}>
              Herramienta temporal: intenta relacionar automáticamente los valores de abajo por palabra clave (p. ej. "GEROCULT..." → Gerocultor/a). Conservador — lo que no reconoce lo deja igual, para revisar a mano. Se puede borrar sin problema cuando ya no haga falta.
            </span>
            <Button size="small" loading={isAutoMapping} onClick={handleAutoMap}>Automapear puestos de trabajo</Button>
          </div>

          <Table
            rowKey={(v) => v}
            loading={isUnmappedLoading}
            dataSource={unmappedData}
            pagination={false}
            locale={{ emptyText: 'Todo relacionado' }}
            columns={[
              { title: 'Valor en el sistema', key: 'job_position', sorter: (a: string, b: string) => a.localeCompare(b), render: (_, job_position: string) => job_position },
              {
                title: 'Puesto del catálogo',
                key: 'select',
                width: 360,
                sorter: (a: string, b: string) => {
                  const labelOf = (jp: string) => (jobPositionOptions.find((o) => o.value === selections[jp])?.label ?? '');
                  return labelOf(a).localeCompare(labelOf(b));
                },
                render: (_, job_position: string) => (
                  <Select
                    showSearch
                    placeholder="Elige un puesto..."
                    style={{ width: 260 }}
                    value={selections[job_position]}
                    onChange={(v) => setSelections((prev) => ({ ...prev, [job_position]: v }))}
                    filterOption={(input, option) => (option?.label as string ?? '').toLowerCase().includes(input.toLowerCase())}
                    options={jobPositionOptions}
                  />
                ),
              },
              {
                title: '',
                key: 'actions',
                width: 100,
                render: (_, job_position: string) => (
                  <Button type="primary" size="small" disabled={!selections[job_position]} loading={isUpserting} onClick={() => handleAssign(job_position)}>
                    Relacionar
                  </Button>
                ),
              },
            ]}
          />
        </div>
      ),
    },
    {
      key: "relacionados",
      label: "Ya relacionados",
      children: (
        <div>
          <p style={{ color: 'var(--ink-faint, #8a968d)', marginTop: -4, marginBottom: 16 }}>
            Valores ya relacionados con un puesto del catálogo. Cambiar el puesto se guarda al momento.
          </p>
          <Table
            rowKey="id_job_position_alias"
            loading={isAliasesLoading}
            dataSource={aliasesData}
            pagination={false}
            columns={[
              { title: 'Valor en el sistema', dataIndex: 'job_position', sorter: (a, b) => a.job_position.localeCompare(b.job_position) },
              {
                title: 'Puesto del catálogo',
                key: 'job_position_name',
                width: 360,
                sorter: (a, b) => (a.job_position_name ?? '').localeCompare(b.job_position_name ?? ''),
                render: (_, record) => (
                  <Select
                    showSearch
                    style={{ width: 260 }}
                    value={record.id_job_position}
                    onChange={(v) => handleChangeMapping(record.job_position, v)}
                    filterOption={(input, option) => (option?.label as string ?? '').toLowerCase().includes(input.toLowerCase())}
                    options={jobPositionOptions}
                  />
                ),
              },
              {
                title: '',
                key: 'actions',
                width: 80,
                render: (_, record) => (
                  <Button
                    danger
                    type="text"
                    icon={<DeleteOutlined />}
                    onClick={() => handleRemoveAlias(record.id_job_position_alias, record.job_position)}
                    aria-label={`Quitar mapeo de ${record.job_position}`}
                  />
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
      <h2 style={{ marginTop: 0 }}>Consultoría · Puestos de trabajo</h2>

      <RouteTabs items={items} />

      <Modal
        open={!!formTarget}
        title={formTarget?.id ? "Editar puesto de trabajo" : "Añadir puesto de trabajo"}
        onCancel={() => setFormTarget(null)}
        onOk={handleSaveJobPosition}
        confirmLoading={isCreatingJobPosition || isUpdatingJobPosition}
        okText="Guardar"
        cancelText="Cancelar"
      >
        <Input
          value={formTarget?.name ?? ''}
          onChange={(e) => setFormTarget((prev) => prev ? { ...prev, name: e.target.value } : prev)}
          placeholder="Nombre"
          style={{ marginBottom: 8 }}
        />
        <Select
          allowClear
          showSearch
          style={{ width: '100%' }}
          value={formTarget?.id_job_position_group}
          onChange={(v) => setFormTarget((prev) => prev ? { ...prev, id_job_position_group: v ?? undefined } : prev)}
          placeholder="Grupo (opcional)"
          filterOption={(input, option) => (option?.label as string ?? '').toLowerCase().includes(input.toLowerCase())}
          options={groupSelectOptions}
          dropdownRender={(menu) => (
            <>
              {menu}
              <Divider style={{ margin: '8px 0' }} />
              <div style={{ display: 'flex', gap: 8, padding: '0 8px 8px' }}>
                <Input
                  placeholder="Nuevo grupo..."
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  onKeyDown={(e) => e.stopPropagation()}
                />
                <Button type="text" icon={<PlusOutlined />} loading={isCreatingGroupInline} onClick={handleUseNewGroup}>Usar</Button>
              </div>
            </>
          )}
        />
      </Modal>

      <Modal
        open={isGroupsManagerOpen}
        title="Grupos de puestos de trabajo"
        onCancel={() => setIsGroupsManagerOpen(false)}
        footer={null}
      >
        <p style={{ color: 'var(--ink-faint, #8a968d)', marginTop: -4, marginBottom: 16 }}>
          Agrupación visual de los puestos del catálogo (p. ej. "Dirección", "Cuidados") — sin más efecto en la app.
        </p>
        <Button icon={<PlusOutlined />} onClick={() => setGroupFormTarget({ name: '' })} style={{ marginBottom: 16 }}>
          Añadir grupo
        </Button>
        <Table
          rowKey="id_job_position_group"
          loading={isGroupsLoading}
          dataSource={groupsData}
          pagination={false}
          size="small"
          columns={[
            { title: 'Grupo', dataIndex: 'name', sorter: (a, b) => a.name.localeCompare(b.name) },
            {
              title: '',
              key: 'actions',
              width: 90,
              render: (_, record) => (
                <div style={{ display: 'flex', gap: 4 }}>
                  <Button size="small" type="text" icon={<EditOutlined />} onClick={() => setGroupFormTarget({ id: record.id_job_position_group, name: record.name })} aria-label={`Renombrar ${record.name}`} />
                  <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => handleRemoveGroup(record.id_job_position_group, record.name)} aria-label={`Borrar ${record.name}`} />
                </div>
              ),
            },
          ]}
        />
      </Modal>

      <Modal
        open={!!groupFormTarget}
        title={groupFormTarget?.id ? "Renombrar grupo" : "Añadir grupo"}
        onCancel={() => setGroupFormTarget(null)}
        onOk={handleSaveGroup}
        confirmLoading={isCreatingGroup || isUpdatingGroup}
        okText="Guardar"
        cancelText="Cancelar"
      >
        <Input
          value={groupFormTarget?.name ?? ''}
          onChange={(e) => setGroupFormTarget((prev) => prev ? { ...prev, name: e.target.value } : prev)}
          placeholder="Nombre del grupo"
        />
      </Modal>
    </div>
  );
}
