import { useMemo, useState } from "react";
import { App, Button, Empty, Select, Space, Spin, Table, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import { DeleteOutlined, FileExcelOutlined, PlusOutlined } from "@ant-design/icons";
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
import { AutoSaveText } from "../common/AutoSaveText";
import { PersonSearchOrCreateModal, type PersonSearchOrCreateInput } from "../common/PersonSearchOrCreateModal";

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

// canAdd también habilita eliminar (alta/baja del listado); canEdit cubre además
// editar los campos de una fila existente y exportar Excel.
interface Props { catalogCourseId: number; canEdit: boolean; canAdd?: boolean; }

export function CourseInterestsSection({ catalogCourseId, canEdit, canAdd = canEdit }: Props) {
  const { message, modal } = App.useApp();
  const { data = [], isLoading } = useCourseInterestsByCatalogQuery(catalogCourseId);
  const { data: users = [] } = useAllUsersLookupQuery();
  const createInterest = useCreateCourseInterestMutation();
  const updateInterests = useUpdateCourseInterestsMutation(catalogCourseId);
  const deleteInterest = useDeleteCourseInterestMutation();
  const [addOpen, setAddOpen] = useState(false);

  const rows = data;
  const existingOpenUsers = useMemo(() => new Set(data.filter(row => !SYSTEM_MANAGED_STATUSES.includes(row.status) && row.status !== "DESCARTADO").map(row => row.id_user)), [data]);
  const availableUsersForAdd = useMemo(() => users.filter(u => !existingOpenUsers.has(u.id_user)), [users, existingOpenUsers]);

  const saveField = async <K extends keyof CourseInterestPatch>(id: number, field: K, value: CourseInterestPatch[K]) => {
    try {
      await updateInterests.mutateAsync([{ id_interest: id, [field]: value } as CourseInterestPatch]);
    } catch (error) {
      message.error(errorMessage(error, "No se pudo guardar el cambio."));
    }
  };

  const handleAdd = async (input: PersonSearchOrCreateInput) => {
    try {
      await createInterest.mutateAsync({ ...input, id_catalog_course: catalogCourseId });
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
      onChange={value => saveField(r.id_interest, field, (value ?? null) as CourseInterestPatch[keyof CourseInterestPatch])} />,
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
            onChange={value => saveField(r.id_interest, "status", value)} />,
    },
    selectColumn("Origen", "source", SOURCES, 130, true),
    selectColumn("Modalidad preferida", "preferred_modality", MODALITIES, 150, true),
    { title: "Disponibilidad", width: 170, render: (_, r) => <AutoSaveText value={r.availability ?? ""} disabled={!canEdit} onSave={value => saveField(r.id_interest, "availability", value)} /> },
    { title: "Notas", width: 240, render: (_, r) => <AutoSaveText textarea value={r.notes ?? ""} disabled={!canEdit} onSave={value => saveField(r.id_interest, "notes", value)} /> },
    { title: "Acciones", fixed: "right", width: 90, render: (_, r) => canAdd && !SYSTEM_MANAGED_STATUSES.includes(r.status)
      ? <Button danger size="small" aria-label="Eliminar interés" icon={<DeleteOutlined />} onClick={() => remove(r)} /> : null },
  ];

  if (isLoading) return <div style={{ textAlign: "center", padding: 48 }}><Spin /></div>;
  return <>
    <Space wrap style={{ marginBottom: 12 }}>
      {canAdd && <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddOpen(true)}>Añadir interesado</Button>}
      <Button icon={<FileExcelOutlined />} onClick={exportExcel} disabled={!rows.length}>Exportar Excel</Button>
    </Space>
    {!rows.length ? <Empty description="Todavía no hay nadie interesado en este curso." /> :
      <Table<CourseInterest> rowKey="id_interest" columns={columns} dataSource={rows} pagination={{ pageSize: 50 }} scroll={{ x: 1400 }} size="small" />}
    {canAdd && <PersonSearchOrCreateModal title="Añadir interesado" open={addOpen} onClose={() => setAddOpen(false)} availableUsers={availableUsersForAdd} submitting={createInterest.isPending} onSubmit={handleAdd} />}
  </>;
}
