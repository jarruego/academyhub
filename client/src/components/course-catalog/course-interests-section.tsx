import { useMemo, useState } from "react";
import { App, Button, Empty, Input, Modal, Select, Space, Spin, Table, Tag, Upload } from "antd";
import type { ColumnsType } from "antd/es/table";
import { DeleteOutlined, FileExcelOutlined, PlusOutlined, SaveOutlined } from "@ant-design/icons";
import { Link } from "react-router-dom";
import dayjs from "dayjs";
import * as XLSX from "xlsx";
import { useAllUsersLookupQuery } from "../../hooks/api/users/use-users.query";
import {
  useCourseInterestsByCatalogQuery,
  useCreateCourseInterestMutation,
  useDeleteCourseInterestMutation,
  useUpdateCourseInterestsMutation,
} from "../../hooks/api/course-interests/use-course-interests";
import type { CourseInterest, CourseInterestPatch, InterestSource, InterestStatus } from "../../shared/types/course-interest/course-interest";
import { CourseModality } from "../../shared/types/course/course-modality.enum";

// Estados que puede elegir el equipo desde el editor. CONVOCADO y MATRICULADO
// quedan fuera a propósito: son derivados (existe una candidatura real
// detrás) y solo los asigna el servidor — se muestran como Tag de solo
// lectura, ver `SYSTEM_MANAGED_STATUSES` más abajo.
const MANUAL_STATUSES: InterestStatus[] = ["INTERESADO", "CONTACTADO", "DESCARTADO"];
const SOURCES: InterestSource[] = ["TELEFONO", "WEB", "PRESENCIAL", "CENTRO", "IMPORTACION", "OTRO"];
const MODALITIES = Object.values(CourseModality);
const SYSTEM_MANAGED_STATUSES: InterestStatus[] = ["CONVOCADO", "MATRICULADO"];
const STATUS_COLOR: Record<InterestStatus, string> = {
  INTERESADO: "blue", CONTACTADO: "gold", CONVOCADO: "purple", MATRICULADO: "green", DESCARTADO: "default",
};
const errorMessage = (error: unknown, fallback: string) =>
  (error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback;

const label = (value: string) => value.toLowerCase().replace(/_/g, " ").replace(/^./, (c: string) => c.toUpperCase());
const fullName = (r: CourseInterest) => [r.name, r.first_surname, r.second_surname].filter(Boolean).join(" ");
const normalizeDni = (value: unknown) => String(value ?? "").toUpperCase().replace(/[^0-9A-Z]/g, "");

interface Props { catalogCourseId: number; canEdit: boolean; }

export function CourseInterestsSection({ catalogCourseId, canEdit }: Props) {
  const { message, modal } = App.useApp();
  const { data = [], isLoading } = useCourseInterestsByCatalogQuery(catalogCourseId);
  const { data: users = [] } = useAllUsersLookupQuery();
  const createInterest = useCreateCourseInterestMutation();
  const updateInterests = useUpdateCourseInterestsMutation();
  const deleteInterest = useDeleteCourseInterestMutation();
  const [drafts, setDrafts] = useState<Record<number, CourseInterestPatch>>({});
  const [addOpen, setAddOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<number>();

  const rows = useMemo(() => data.map(row => ({ ...row, ...(drafts[row.id_interest] ?? {}) })), [data, drafts]);
  const existingOpenUsers = useMemo(() => new Set(data.filter(row => !SYSTEM_MANAGED_STATUSES.includes(row.status) && row.status !== "DESCARTADO").map(row => row.id_user)), [data]);
  const userOptions = useMemo(() => users.filter(u => !existingOpenUsers.has(u.id_user)).map(u => ({
    value: u.id_user,
    label: `${[u.name, u.first_surname, u.second_surname].filter(Boolean).join(" ")} · ${u.dni || "sin DNI"}`,
  })), [users, existingOpenUsers]);

  const patch = <K extends keyof CourseInterestPatch>(id: number, field: K, value: CourseInterestPatch[K]) =>
    setDrafts(previous => ({ ...previous, [id]: { ...(previous[id] ?? { id_interest: id }), [field]: value } }));

  const save = async () => {
    const pending = Object.values(drafts);
    if (!pending.length) return;
    try {
      await updateInterests.mutateAsync(pending);
      setDrafts({});
      message.success("Cambios guardados.");
    } catch {
      message.error("No se pudieron guardar los cambios.");
    }
  };

  const add = async () => {
    if (!selectedUser) return;
    try {
      await createInterest.mutateAsync({ id_user: selectedUser, id_catalog_course: catalogCourseId });
      setSelectedUser(undefined);
      setAddOpen(false);
      message.success("Interesado añadido.");
    } catch (error) {
      message.error(errorMessage(error, "No se pudo añadir."));
    }
  };

  const remove = (row: CourseInterest) => modal.confirm({
    title: "Eliminar interés",
    content: "Se eliminará este registro de la bolsa de interesados. La persona seguirá existiendo en la aplicación.",
    okText: "Eliminar",
    okType: "danger",
    onOk: async () => {
      try {
        await deleteInterest.mutateAsync(row.id_interest);
        message.success("Interés eliminado.");
      } catch (error) {
        message.error(errorMessage(error, "No se pudo eliminar."));
        throw error; // mantiene el modal abierto para que se vea el error
      }
    },
  });

  const importExcel = async (file: File) => {
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
      const byDni = new Map(users.map(u => [normalizeDni(u.dni), u.id_user]));
      const ids = new Set<number>();
      for (const row of raw) {
        const entry = Object.entries(row).find(([header]) => /^(dni|nie|nif|documento)$/i.test(header.trim()));
        const id = entry ? byDni.get(normalizeDni(entry[1])) : undefined;
        if (id && !existingOpenUsers.has(id)) ids.add(id);
      }
      let created = 0;
      for (const id_user of ids) {
        try { await createInterest.mutateAsync({ id_user, id_catalog_course: catalogCourseId }); created++; } catch { /* duplicado u otro conflicto: se omite */ }
      }
      const omitted = raw.length - created;
      message.success(`${created} interesado(s) importado(s)${omitted > 0 ? `; ${omitted} fila(s) no vinculadas o ya existentes` : ""}.`);
    } catch {
      message.error("No se pudo leer el Excel. Debe incluir una columna DNI, NIE, NIF o Documento.");
    }
    return false;
  };

  const exportExcel = () => {
    const sheet = XLSX.utils.json_to_sheet(rows.map(r => ({
      Nombre: fullName(r), DNI: r.dni, Email: r.email, Teléfono: r.phone,
      Estado: r.status, Origen: r.source ?? "", "Modalidad preferida": r.preferred_modality ?? "",
      Disponibilidad: r.availability ?? "", Notas: r.notes ?? "",
      "Fecha de interés": r.interest_date ? dayjs(r.interest_date).format("DD/MM/YYYY") : "",
    })));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "Interesados");
    XLSX.writeFile(workbook, `interesados-curso-${catalogCourseId}.xlsx`);
  };

  const selectColumn = <T extends string>(title: string, field: keyof CourseInterestPatch, values: T[], width = 150, allowClear = false) => ({
    title, key: String(field), width,
    render: (_: unknown, r: CourseInterest) => <Select size="small" value={r[field as keyof CourseInterest] as T | null} allowClear={allowClear}
      disabled={!canEdit} style={{ width: "100%" }} options={values.map(v => ({ value: v, label: label(v) }))}
      onChange={value => patch(r.id_interest, field, (value ?? null) as CourseInterestPatch[keyof CourseInterestPatch])} />,
  });

  const columns: ColumnsType<CourseInterest> = [
    { title: "Interesado", fixed: "left", width: 210, render: (_, r) => <Link to={`/users/${r.id_user}`}><strong>{fullName(r)}</strong></Link> },
    { title: "DNI", dataIndex: "dni", width: 105, render: value => value || "-" },
    { title: "Fecha", dataIndex: "interest_date", width: 100, render: value => value ? dayjs(value).format("DD/MM/YYYY") : "-" },
    {
      title: "Estado", key: "status", width: 150,
      render: (_, r) => SYSTEM_MANAGED_STATUSES.includes(r.status)
        ? <Tag color={STATUS_COLOR[r.status]} title="Lo asigna el sistema al incorporar a una edición o matricular la candidatura">{label(r.status)}</Tag>
        : <Select size="small" value={r.status} disabled={!canEdit} style={{ width: "100%" }}
            options={MANUAL_STATUSES.map(v => ({ value: v, label: label(v) }))}
            onChange={value => patch(r.id_interest, "status", value)} />,
    },
    selectColumn("Origen", "source", SOURCES, 130, true),
    selectColumn("Modalidad preferida", "preferred_modality", MODALITIES, 150, true),
    { title: "Disponibilidad", width: 170, render: (_, r) => <Input size="small" value={r.availability ?? ""} readOnly={!canEdit} onChange={e => patch(r.id_interest, "availability", e.target.value)} /> },
    { title: "Notas", width: 240, render: (_, r) => <Input.TextArea autoSize={{ minRows: 1, maxRows: 3 }} value={r.notes ?? ""} readOnly={!canEdit} onChange={e => patch(r.id_interest, "notes", e.target.value)} /> },
    { title: "Acciones", fixed: "right", width: 90, render: (_, r) => canEdit && !SYSTEM_MANAGED_STATUSES.includes(r.status)
      ? <Button danger size="small" aria-label="Eliminar interés" icon={<DeleteOutlined />} onClick={() => remove(r)} /> : null },
  ];

  if (isLoading) return <div style={{ textAlign: "center", padding: 48 }}><Spin /></div>;
  return <>
    <Space wrap style={{ marginBottom: 12 }}>
      {canEdit && <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddOpen(true)}>Añadir interesado</Button>}
      {canEdit && <Upload accept=".xlsx,.xls" showUploadList={false} beforeUpload={importExcel}><Button icon={<FileExcelOutlined />}>Importar Excel</Button></Upload>}
      <Button icon={<FileExcelOutlined />} onClick={exportExcel} disabled={!rows.length}>Exportar Excel</Button>
      {canEdit && <Button icon={<SaveOutlined />} onClick={save} loading={updateInterests.isPending} disabled={!Object.keys(drafts).length}>Guardar cambios ({Object.keys(drafts).length})</Button>}
    </Space>
    {!rows.length ? <Empty description="Todavía no hay nadie interesado en este curso." /> :
      <Table<CourseInterest> rowKey="id_interest" columns={columns} dataSource={rows} pagination={{ pageSize: 50 }} scroll={{ x: 1400 }} size="small" />}
    <Modal title="Añadir interesado" open={addOpen} onCancel={() => setAddOpen(false)} onOk={add} okButtonProps={{ disabled: !selectedUser, loading: createInterest.isPending }} destroyOnClose>
      <Select showSearch optionFilterProp="label" style={{ width: "100%" }} placeholder="Buscar por nombre o DNI" options={userOptions} value={selectedUser} onChange={setSelectedUser} />
    </Modal>
  </>;
}
