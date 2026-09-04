import { useEffect, useMemo, useRef, useState } from "react";
import { App, Button, Checkbox, Empty, Modal, Select, Space, Spin, Switch, Table, Tag, Tooltip, Upload } from "antd";
import type { ColumnsType } from "antd/es/table";
import { DeleteOutlined, FileExcelOutlined, PlusOutlined, TeamOutlined } from "@ant-design/icons";
import { Link } from "react-router-dom";
import * as XLSX from "xlsx";
import { useAllUsersLookupQuery } from "../../hooks/api/users/use-users.query";
import {
  useCourseCandidatesQuery,
  useCreateCourseCandidateMutation,
  useDeleteCourseCandidateMutation,
  useUpdateCandidateUserMutation,
  useUpdateCourseCandidatesMutation,
} from "../../hooks/api/course-candidates/use-course-candidates";
import { useCourseInterestsByCatalogQuery, useIncorporateInterestsMutation } from "../../hooks/api/course-interests/use-course-interests";
import { Role } from "../../hooks/api/auth/use-login.mutation";
import { useRole } from "../../utils/permissions/use-role";
import { detectDocumentType } from "../../utils/detect-document-type";
import { AutoSaveText } from "../common/AutoSaveText";
import { PersonSearchOrCreateModal, type PersonSearchOrCreateInput } from "../common/PersonSearchOrCreateModal";
import type {
  CandidateAttendanceStatus,
  CandidateEmploymentStatus,
  CandidateProcessStatus,
  CourseCandidate,
  CourseCandidatePatch,
} from "../../shared/types/course-candidate/course-candidate";
import type { CourseInterest } from "../../shared/types/course-interest/course-interest";

const PROCESS: CandidateProcessStatus[] = ["PENDIENTE", "SELECCIONADA", "RESERVA", "BAJA", "DESCARTADA"];
const EMPLOYMENT: CandidateEmploymentStatus[] = ["DESEMPLEO", "OCUPADO", "OTRO"];
const ATTENDANCE: CandidateAttendanceStatus[] = ["PENDIENTE", "SI", "NO"];

// Columna INAEM compacta: un solo carácter + tooltip con el nombre completo.
// DESCARTADO/BAJA se pliegan en "-" igual que "sin registro" — a efectos de
// esta columna solo importa si está vivo en INAEM (matriculado/preinscrito) o no.
const INAEM_INFO: Record<string, { symbol: string; tooltip: string; color: string }> = {
  MATRICULADO: { symbol: "M", tooltip: "Matriculado", color: "green" },
  PREINSCRITO: { symbol: "P", tooltip: "Preinscrito", color: "blue" },
};

// Colores suaves del estado del proceso (ver .process-select-* en index.css):
// gris/blanco pendiente, verde seleccionada, ámbar reserva, rosa baja, rojo descartada.
const PROCESS_CLASS: Record<CandidateProcessStatus, string> = {
  PENDIENTE: "process-select-pendiente",
  SELECCIONADA: "process-select-seleccionada",
  RESERVA: "process-select-reserva",
  BAJA: "process-select-baja",
  DESCARTADA: "process-select-descartada",
};

// Orden del listado: matriculado INAEM > seleccionada > reserva > pendiente >
// baja > descartada. Es lo único que reordena el listado: los demás campos
// (asistencia, documentación, notas, dni/teléfono/email...) no afectan al rango.
const PROCESS_RANK: Record<CandidateProcessStatus, number> = {
  SELECCIONADA: 1, RESERVA: 2, PENDIENTE: 3, BAJA: 4, DESCARTADA: 5,
};

const label = (value: string) => value.toLowerCase().replace(/_/g, " ").replace(/^./, (c: string) => c.toUpperCase());
const fullName = (r: { name: string; first_surname: string | null; second_surname: string | null }) =>
  [r.name, r.first_surname, r.second_surname].filter(Boolean).join(" ");
const errorMessage = (error: unknown, fallback: string) =>
  (error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback;
const normalizeDni = (value: unknown) => String(value ?? "").toUpperCase().replace(/[^0-9A-Z]/g, "");

/** Modal "Incorporar interesados", separada por el mismo motivo (la selección de filas no debe re-renderizar la tabla de candidatos). */
function IncorporateModal({ open, onClose, availableInterests, submitting, onSubmit }: {
  open: boolean;
  onClose: () => void;
  availableInterests: CourseInterest[];
  submitting: boolean;
  onSubmit: (interestIds: number[]) => void;
}) {
  const [selectedInterests, setSelectedInterests] = useState<number[]>([]);
  const handleOk = () => { if (selectedInterests.length) onSubmit(selectedInterests); };

  return <Modal width={680} title="Incorporar interesados a esta edición" open={open} onCancel={onClose}
    onOk={handleOk} okText={`Incorporar${selectedInterests.length ? ` (${selectedInterests.length})` : ""}`}
    okButtonProps={{ disabled: !selectedInterests.length, loading: submitting }} destroyOnClose>
    {!availableInterests.length
      ? <Empty description="No hay interesados disponibles (interesados o contactados) para el curso de catálogo de esta edición." />
      : <Table size="small" rowKey="id_interest" pagination={false} scroll={{ y: 360 }}
          rowSelection={{ selectedRowKeys: selectedInterests, onChange: keys => setSelectedInterests(keys as number[]) }}
          dataSource={availableInterests}
          columns={[
            { title: "Persona", render: (_: unknown, r: CourseInterest) => fullName(r) },
            { title: "DNI", dataIndex: "dni", render: (value: string | null) => value || "-" },
            { title: "Estado", dataIndex: "status", render: (value: string) => label(value) },
            { title: "Disponibilidad", dataIndex: "availability", render: (value: string | null) => value || "-" },
          ]} />}
  </Modal>;
}

interface Props { courseId: number; catalogCourseId: number; canEdit: boolean; }

export function CourseCandidatesSection({ courseId, catalogCourseId, canEdit }: Props) {
  const { message, modal } = App.useApp();
  const role = useRole();
  const { data = [], isLoading } = useCourseCandidatesQuery(courseId);
  const { data: users = [] } = useAllUsersLookupQuery();
  const { data: catalogInterests = [] } = useCourseInterestsByCatalogQuery(catalogCourseId, Boolean(catalogCourseId));
  const createCandidate = useCreateCourseCandidateMutation(courseId);
  const updateCandidates = useUpdateCourseCandidatesMutation(courseId);
  const updateCandidateUser = useUpdateCandidateUserMutation(courseId);
  const deleteCandidate = useDeleteCourseCandidateMutation(courseId);
  const incorporateInterests = useIncorporateInterestsMutation();
  const [addOpen, setAddOpen] = useState(false);
  const [incorporateOpen, setIncorporateOpen] = useState(false);
  // Fila recién creada: se fuerza al principio del listado hasta que se edite
  // algún dato suyo, momento en el que se reubica según su proceso/estado.
  const [justCreatedId, setJustCreatedId] = useState<number | null>(null);
  const scrolledRef = useRef(false);

  const rows = useMemo(() => {
    const rank = (r: CourseCandidate) => {
      if (r.id_candidate === justCreatedId) return -1;
      if (r.inaem_status === "MATRICULADO") return 0;
      return PROCESS_RANK[r.process_status];
    };
    return data.slice().sort((a, b) => rank(a) - rank(b));
  }, [data, justCreatedId]);
  const existingUsers = useMemo(() => new Set(data.map(row => row.id_user)), [data]);
  const availableUsersForAdd = useMemo(() => users.filter(u => !existingUsers.has(u.id_user)), [users, existingUsers]);
  const availableInterests = useMemo(() => catalogInterests.filter(interest =>
    (interest.status === "INTERESADO" || interest.status === "CONTACTADO") && !existingUsers.has(interest.id_user),
  ), [catalogInterests, existingUsers]);

  useEffect(() => { scrolledRef.current = false; }, [justCreatedId]);
  useEffect(() => {
    if (justCreatedId == null || scrolledRef.current) return;
    const el = document.querySelector(`tr[data-row-key="${justCreatedId}"]`);
    if (!el) return;
    scrolledRef.current = true;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    (el.querySelector("input, textarea, .ant-select-selector") as HTMLElement | null)?.focus();
  }, [justCreatedId, rows]);

  const clearJustCreated = (id: number) => { if (id === justCreatedId) setJustCreatedId(null); };

  const saveField = async <K extends keyof CourseCandidatePatch>(id: number, field: K, value: CourseCandidatePatch[K]) => {
    clearJustCreated(id);
    try {
      await updateCandidates.mutateAsync([{ id_candidate: id, [field]: value } as CourseCandidatePatch]);
    } catch (error) {
      message.error(errorMessage(error, "No se pudo guardar el cambio."));
    }
  };

  const saveUserField = async (r: CourseCandidate, field: "dni" | "phone" | "email", value: string) => {
    clearJustCreated(r.id_candidate);
    try {
      await updateCandidateUser.mutateAsync({ id_user: r.id_user, patch: { name: r.name, [field]: value || null } });
    } catch (error) {
      message.error(errorMessage(error, "No se pudo guardar el cambio."));
    }
  };

  const handleAdd = async (input: PersonSearchOrCreateInput) => {
    try {
      const created = await createCandidate.mutateAsync(input);
      setAddOpen(false);
      if (created?.id_candidate) setJustCreatedId(created.id_candidate);
      message.success("Candidato añadido.");
    } catch (error) {
      message.error(errorMessage(error, "No se pudo añadir."));
    }
  };

  const handleIncorporate = async (interestIds: number[]) => {
    try {
      await incorporateInterests.mutateAsync({ id_course: courseId, interest_ids: interestIds });
      setIncorporateOpen(false);
      message.success(`${interestIds.length} interesado(s) incorporado(s) a esta edición.`);
    } catch (error) {
      message.error(errorMessage(error, "No se pudo incorporar."));
    }
  };

  const removeCandidate = (candidate: CourseCandidate) => {
    // Capturada por el checkbox de abajo y leída en onOk: Modal.confirm es
    // imperativo (no hay estado React "vivo" al que enlazar directamente).
    let force = false;
    modal.confirm({
      title: "Eliminar candidatura",
      content: <Space direction="vertical">
        <span>Solo se elimina de esta edición; la persona permanece en la aplicación.</span>
        {candidate.inaem_status && (
          <>
            <span>Esta persona consta preinscrita en INAEM ({label(candidate.inaem_status)}); por defecto no se puede borrar.</span>
            <Checkbox onChange={e => { force = e.target.checked; }}>Forzar borrado (también borra la preinscripción oficial INAEM)</Checkbox>
          </>
        )}
      </Space>,
      okText: "Eliminar",
      okType: "danger",
      onOk: async () => {
        try {
          await deleteCandidate.mutateAsync({ candidateId: candidate.id_candidate, force });
          message.success("Candidatura eliminada.");
        } catch (error) {
          message.error(errorMessage(error, "No se pudo eliminar."));
          throw error; // mantiene el modal abierto para que se vea el error
        }
      },
    });
  };

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
        if (id && !existingUsers.has(id)) ids.add(id);
      }
      for (const id_user of ids) await createCandidate.mutateAsync({ id_user, source: "EXCEL_OPERATIVO" });
      const omitted = raw.length - ids.size;
      message.success(`${ids.size} candidato(s) importado(s)${omitted > 0 ? `; ${omitted} fila(s) no vinculadas o ya existentes` : ""}.`);
    } catch {
      message.error("No se pudo leer el Excel. Debe incluir una columna DNI, NIE, NIF o Documento.");
    }
    return false;
  };

  const exportExcel = () => {
    const sheet = XLSX.utils.json_to_sheet(rows.map(r => ({
      Nombre: fullName(r), DNI: r.dni, Teléfono: r.phone, Email: r.email,
      "Situación INAEM": r.inaem_status ?? "NO REGISTRADO",
      Proceso: r.process_status, "Asistencia prueba": r.attendance_status,
      "Cumple requisitos": r.meets_requirements == null ? "" : r.meets_requirements ? "SI" : "NO",
      DARDE: r.has_darde ? "SI" : "NO", "DNI/NIE": r.has_dni ? "SI" : "NO", "Titulación": r.has_titulacion ? "SI" : "NO",
      "Estado laboral": r.employment_status, Observaciones: r.operational_notes,
    })));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "Candidatos");
    XLSX.writeFile(workbook, `candidatos-curso-${courseId}.xlsx`);
  };

  const selectColumn = <T extends string>(title: string, field: keyof CourseCandidatePatch, values: T[], width = 130) => ({
    title, key: String(field), width,
    render: (_: unknown, r: CourseCandidate) => <Select size="small" value={r[field as keyof CourseCandidate] as T | null} allowClear={field === "employment_status"}
      disabled={!canEdit} style={{ width: "100%" }} options={values.map(v => ({ value: v, label: label(v) }))}
      className={field === "process_status" ? PROCESS_CLASS[r.process_status] : undefined}
      onChange={value => saveField(r.id_candidate, field, value as CourseCandidatePatch[keyof CourseCandidatePatch])} />,
  });

  // Título en letra pequeña para las columnas checkbox: así el ancho de la
  // cabecera no obliga a ensanchar una columna que solo lleva un Switch.
  const smallTitle = (title: string) => <span style={{ fontSize: 11 }}>{title}</span>;

  const boolColumn = (title: string, field: "has_darde" | "has_dni" | "has_titulacion", width = 55) => ({
    title: smallTitle(title), key: field, width, align: "center" as const,
    render: (_: unknown, r: CourseCandidate) => <Switch size="small" checked={r[field]} disabled={!canEdit}
      onChange={value => saveField(r.id_candidate, field, value)} />,
  });

  const textColumn = (title: string, field: "dni" | "phone" | "email", width = 100, validate?: (v: string) => boolean) => ({
    title, key: field, width,
    render: (_: unknown, r: CourseCandidate) => <AutoSaveText value={r[field] ?? ""} disabled={!canEdit} validate={validate} onSave={value => saveUserField(r, field, value)} />,
  });

  const columns: ColumnsType<CourseCandidate> = [
    { title: "INAEM", fixed: "left", width: 55, align: "center", render: (_, r) => {
      const info = r.inaem_status ? INAEM_INFO[r.inaem_status] : undefined;
      return <Tooltip title={info?.tooltip ?? "No registrado"}><Tag color={info?.color ?? "default"}>{info?.symbol ?? "-"}</Tag></Tooltip>;
    } },
    { title: "Candidato", fixed: "left", width: 190, render: (_, r) => <Link to={`/users/${r.id_user}`}><strong>{fullName(r)}</strong></Link> },
    textColumn("DNI", "dni", 95, v => Boolean(detectDocumentType(v))),
    textColumn("Teléfono", "phone", 105),
    textColumn("Email", "email", 165),
    selectColumn("Estado laboral", "employment_status", EMPLOYMENT, 115),
    boolColumn("DARDE", "has_darde"),
    boolColumn("DNI/NIE", "has_dni"),
    boolColumn("Titulación", "has_titulacion", 60),
    { title: smallTitle("Cumple Requisitos"), width: 60, align: "center", render: (_, r) => <Switch size="small" className="requirements-switch" checked={r.meets_requirements === true} checkedChildren="Sí" unCheckedChildren={r.meets_requirements === false ? "No" : "?"} disabled={!canEdit} onChange={value => saveField(r.id_candidate, "meets_requirements", value)} /> },
    selectColumn("Prueba", "attendance_status", ATTENDANCE, 95),
    selectColumn("Estado", "process_status", PROCESS, 135),
    { title: "Observaciones", width: 260, render: (_, r) => <AutoSaveText textarea value={r.operational_notes ?? ""} disabled={!canEdit} onSave={value => saveField(r.id_candidate, "operational_notes", value)} /> },
    { title: "", fixed: "right", width: 60, render: (_, r) => canEdit
      ? <Button danger size="small" aria-label="Eliminar candidatura" icon={<DeleteOutlined />} onClick={() => removeCandidate(r)} /> : null },
  ];

  if (isLoading) return <div style={{ textAlign: "center", padding: 48 }}><Spin /></div>;
  return <>
    <Space wrap style={{ marginBottom: 12 }}>
      {canEdit && <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddOpen(true)}>Añadir candidato</Button>}
      {canEdit && Boolean(catalogCourseId) && <Button icon={<TeamOutlined />} onClick={() => setIncorporateOpen(true)}>Desde interesados{availableInterests.length ? ` (${availableInterests.length})` : ""}</Button>}
      {role === Role.ADMIN && <Upload accept=".xlsx,.xls" showUploadList={false} beforeUpload={importExcel}><Button icon={<FileExcelOutlined />}>Importar Excel</Button></Upload>}
      <Button icon={<FileExcelOutlined />} onClick={exportExcel} disabled={!rows.length}>Exportar Excel</Button>
    </Space>
    {!rows.length ? <Empty description="Aún no hay candidatos. Puedes añadirlos aunque todavía no estén preinscritos en INAEM." /> :
      <Table<CourseCandidate> rowKey="id_candidate" columns={columns} dataSource={rows} pagination={false} scroll={{ x: 1520 }} size="small" />}
    <PersonSearchOrCreateModal title="Añadir candidato" open={addOpen} onClose={() => setAddOpen(false)} availableUsers={availableUsersForAdd} submitting={createCandidate.isPending} onSubmit={handleAdd} />
    <IncorporateModal open={incorporateOpen} onClose={() => setIncorporateOpen(false)} availableInterests={availableInterests} submitting={incorporateInterests.isPending} onSubmit={handleIncorporate} />
  </>;
}
