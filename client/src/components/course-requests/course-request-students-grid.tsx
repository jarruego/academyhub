import { useEffect, useMemo, useRef, useState } from "react";
import { App, Button, Input, Modal, Popconfirm, Table, Tag, Tooltip, Upload } from "antd";
import type { UploadRequestOption } from "rc-upload/lib/interface";
import { DeleteOutlined, InboxOutlined, PlusOutlined, SaveOutlined, SnippetsOutlined, UnlockOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import {
  CourseRequestStudent,
  CourseRequestStudentInput,
} from "../../shared/types/course-request/course-request";
import { detectDocumentType } from "../../utils/detect-document-type";

// Saneo de campos (espacios, mayúsculas de DNI, minúsculas de email...), igual
// que hace el backend al guardar/subir Excel — aquí solo para que la grid ya se
// vea limpia al pegar/editar, no sustituye al saneo del servidor.
function sanitizeCellText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}
function sanitizeDniValue(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}
function sanitizeEmailValue(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "");
}
function sanitizePhoneValue(value: string): string {
  const s = value.trim();
  const hasPlus = s.startsWith("+");
  const digits = s.replace(/\D/g, "");
  return hasPlus ? `+${digits}` : digits;
}
const FIELD_SANITIZERS: Record<keyof CourseRequestStudentInput, (value: string) => string> = {
  name: sanitizeCellText,
  first_surname: sanitizeCellText,
  second_surname: sanitizeCellText,
  dni: sanitizeDniValue,
  email: sanitizeEmailValue,
  phone_mobile: sanitizePhoneValue,
};

type Row = CourseRequestStudentInput & {
  key: string;
  id: number;
  id_group: number | null;
  currently_in_group: boolean;
};

const EMPTY_ROW = (): Row => ({
  key: `new-${Math.random().toString(36).slice(2)}`,
  id: 0,
  id_group: null,
  currently_in_group: false,
  name: "",
  first_surname: "",
  second_surname: "",
  dni: "",
  email: "",
  phone_mobile: "",
});

function toRows(students: CourseRequestStudent[]): Row[] {
  return students.map((s) => ({
    key: `id-${s.id}`,
    id: s.id,
    id_group: s.id_group,
    currently_in_group: s.currently_in_group,
    name: s.name,
    first_surname: s.first_surname,
    second_surname: s.second_surname ?? "",
    dni: s.dni,
    email: s.email,
    phone_mobile: s.phone_mobile ?? "",
  }));
}

// Alias de cabecera reconocidos al pegar un bloque copiado de Excel. Si la
// primera fila no matchea ninguno, se asume el orden fijo NOMBRE/APELLIDO1/
// APELLIDO2/DNI/EMAIL/TELÉFONO (el orden en el que se piden estos datos).
const PASTE_HEADER_ALIASES: Record<keyof CourseRequestStudentInput, string[]> = {
  name: ["NOMBRE"],
  first_surname: ["APELLIDO 1", "APELLIDO1", "AP1", "AP.1", "PRIMER APELLIDO"],
  second_surname: ["APELLIDO 2", "APELLIDO2", "AP2", "AP.2", "SEGUNDO APELLIDO"],
  dni: ["DNI", "NIF", "NIF/NIE"],
  email: ["CORREO ELECTRONICO", "CORREO ELECTRÓNICO", "EMAIL", "CORREO"],
  phone_mobile: ["TELEFONO MOVIL", "TELÉFONO MÓVIL", "MOVIL", "MÓVIL", "TELEFONO", "TELÉFONO"],
};

const PASTE_FIXED_ORDER: (keyof CourseRequestStudentInput)[] = [
  "name",
  "first_surname",
  "second_surname",
  "dni",
  "email",
  "phone_mobile",
];

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(new RegExp("[\\u0300-\\u036f]", "g"), "")
    .trim()
    .toUpperCase();
}

function parsePasteBlock(text: string): Row[] {
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== "");
  if (!lines.length) return [];
  const cellsByLine = lines.map((line) => line.split("\t"));

  let fields: (keyof CourseRequestStudentInput | undefined)[] = PASTE_FIXED_ORDER;
  let dataLines = cellsByLine;

  const firstLineNormalized = cellsByLine[0].map(normalize);
  const looksLikeHeader = firstLineNormalized.some((cell) =>
    Object.values(PASTE_HEADER_ALIASES).some((aliases) => aliases.includes(cell)),
  );
  if (looksLikeHeader) {
    fields = firstLineNormalized.map((cell) => {
      const entry = Object.entries(PASTE_HEADER_ALIASES).find(([, aliases]) => aliases.includes(cell));
      return entry ? (entry[0] as keyof CourseRequestStudentInput) : undefined;
    });
    dataLines = cellsByLine.slice(1);
  }

  return dataLines
    .map((cells) => {
      const row = EMPTY_ROW();
      cells.forEach((value, i) => {
        const field = fields[i];
        if (field) row[field] = FIELD_SANITIZERS[field](value);
      });
      return row;
    })
    .filter((row) => row.name || row.first_surname || row.dni || row.email);
}

const REQUIRED_FIELDS: (keyof CourseRequestStudentInput)[] = ["name", "first_surname", "dni", "email"];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ERROR_MESSAGES: Partial<Record<keyof CourseRequestStudentInput, string>> = {
  name: "Falta el nombre",
  first_surname: "Falta el apellido 1",
  dni: "Falta el DNI",
  email: "Falta el correo",
};

/** Campo -> Set de motivos (para mostrar en rojo y en el tooltip de la celda). */
function rowErrors(row: Row): Map<keyof CourseRequestStudentInput, string> {
  const errors = new Map<keyof CourseRequestStudentInput, string>();
  for (const field of REQUIRED_FIELDS) {
    if (!row[field]?.trim()) errors.set(field, ERROR_MESSAGES[field]!);
  }
  if (row.email && !errors.has("email") && !EMAIL_REGEX.test(row.email)) {
    errors.set("email", "Correo con formato no válido");
  }
  if (row.dni && !errors.has("dni") && !detectDocumentType(row.dni)) {
    errors.set("dni", "DNI/NIE no válido (letra de control incorrecta)");
  }
  return errors;
}

type Props = {
  students: CourseRequestStudent[];
  readOnly: boolean;
  saving: boolean;
  uploading: boolean;
  onSave: (rows: CourseRequestStudentInput[]) => Promise<void>;
  onUploadExcel: (file: Blob) => Promise<{ inserted: number }>;
  scrollToStudentId?: number;
  // Solo se pasa si el usuario puede editar (ADMIN/MANAGER); si falta, la
  // columna "Grupo" se sigue mostrando (es informativa) pero sin botón. A
  // diferencia del resto de acciones, funciona aunque `readOnly` sea true
  // (petición cerrada) — liberar a un alumno no requiere reabrirla.
  onReleaseGroup?: (studentId: number) => Promise<void>;
  // Reabrir la petición (mismo botón que ya existe en la ficha). Solo hace
  // falta si `onReleaseGroup` también está presente: tras liberar con la
  // petición cerrada, se ofrece reabrirla — si no, el alumno liberado no
  // aparecerá en el modal de importación de otro grupo (que solo lista
  // peticiones ABIERTA), y liberarlo habría sido inútil sin recordarlo.
  onReopen?: () => Promise<void>;
};

export function CourseRequestStudentsGrid({ students, readOnly, saving, uploading, onSave, onUploadExcel, scrollToStudentId, onReleaseGroup, onReopen }: Props) {
  const { message: messageApi, modal } = App.useApp();
  const [rows, setRows] = useState<Row[]>(() => toRows(students));
  const [pasteModalOpen, setPasteModalOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [releasingId, setReleasingId] = useState<number | null>(null);
  const scrolledRef = useRef(false);

  useEffect(() => {
    if (!scrollToStudentId || scrolledRef.current || rows.length === 0) return;
    const key = `id-${scrollToStudentId}`;
    if (!rows.some((r) => r.key === key)) return;
    scrolledRef.current = true;
    const id = window.setTimeout(() => {
      document.querySelector(`tr[data-row-key="${key}"]`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 300);
    return () => window.clearTimeout(id);
  }, [scrollToStudentId, rows]);

  // Resincroniza cuando cambia el conjunto de filas guardadas (carga inicial o alta por Excel).
  const studentsSignature = students.map((s) => s.id).join(",");
  useEffect(() => {
    setRows(toRows(students));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentsSignature]);

  const errorsByKey = useMemo(() => {
    const map = new Map<string, Map<keyof CourseRequestStudentInput, string>>();
    for (const row of rows) map.set(row.key, rowErrors(row));
    return map;
  }, [rows]);

  const invalidCount = useMemo(
    () => Array.from(errorsByKey.values()).filter((s) => s.size > 0).length,
    [errorsByKey],
  );

  const updateCell = (key: string, field: keyof CourseRequestStudentInput, value: string) => {
    setRows((prev) => prev.map((row) => (row.key === key ? { ...row, [field]: value } : row)));
  };

  // Asea el valor (espacios, mayúsculas de DNI, minúsculas de email...) al salir de la celda.
  const sanitizeCell = (key: string, field: keyof CourseRequestStudentInput) => {
    setRows((prev) =>
      prev.map((row) => (row.key === key ? { ...row, [field]: FIELD_SANITIZERS[field](row[field] ?? "") } : row)),
    );
  };

  const removeRow = (key: string) => setRows((prev) => prev.filter((row) => row.key !== key));

  const addRow = () => setRows((prev) => [...prev, EMPTY_ROW()]);

  const handlePasteConfirm = () => {
    const parsed = parsePasteBlock(pasteText);
    if (!parsed.length) {
      messageApi.warning("No se ha reconocido ninguna fila en el texto pegado");
      return;
    }
    setRows((prev) => [...prev, ...parsed]);
    setPasteText("");
    setPasteModalOpen(false);
    messageApi.success(`${parsed.length} fila(s) añadidas`);
  };

  const handleUploadRequest = async (options: UploadRequestOption) => {
    const { file, onSuccess, onError } = options;
    try {
      const result = await onUploadExcel(file as Blob);
      messageApi.success(`${result.inserted} alumno(s) añadidos desde el Excel`);
      onSuccess?.(null, file as File);
    } catch (err) {
      messageApi.error("No se pudo procesar el Excel");
      onError?.(err as Error);
    }
  };

  const handleSave = async () => {
    // No se bloquea el guardado por datos incompletos/inválidos (nombre, DNI,
    // correo...): solo se avisa. Las filas en rojo se pueden corregir después.
    if (invalidCount > 0) {
      messageApi.warning(`Guardado con ${invalidCount} fila(s) con datos incompletos o no válidos (revisa los campos en rojo)`);
    }
    const payload = rows.map(({ key: _key, id: _id, id_group: _id_group, currently_in_group: _cig, ...rest }) => rest);
    await onSave(payload);
  };

  const handleReleaseGroup = async (studentId: number) => {
    if (!onReleaseGroup) return;
    setReleasingId(studentId);
    try {
      await onReleaseGroup(studentId);
      // El efecto que resincroniza `rows` desde `students` solo se dispara si
      // cambia el CONJUNTO de ids (alta/baja de filas, ver studentsSignature)
      // — liberar no añade ni quita filas, así que hay que actualizar el
      // estado local a mano o la grid se queda con el estado "asignado" viejo.
      setRows((prev) =>
        prev.map((row) => (row.id === studentId ? { ...row, id_group: null, currently_in_group: false } : row)),
      );
      messageApi.success("Alumno liberado");
      // La petición cerrada no se reabre sola al liberar (ver docs): si no se
      // recuerda ahora, es fácil olvidar que hace falta reabrirla para poder
      // usar de verdad al alumno liberado en otro grupo.
      if (readOnly && onReopen) {
        modal.confirm({
          title: "¿Reabrir esta petición?",
          content: "El alumno liberado (y cualquier otro que quede libre) solo se puede volver a matricular desde otro grupo si la petición está ABIERTA. Se puede reabrir más tarde igualmente desde el botón de la ficha.",
          okText: "Reabrir ahora",
          cancelText: "Dejarla cerrada",
          onOk: onReopen,
        });
      }
    } catch {
      messageApi.error("No se pudo liberar al alumno (¿sigue en el grupo?)");
    } finally {
      setReleasingId(null);
    }
  };

  const cellColumn = (
    title: string,
    field: keyof CourseRequestStudentInput,
    width?: number,
  ): ColumnsType<Row>[number] => ({
    title,
    dataIndex: field,
    width,
    render: (_: string, row: Row) => {
      const errorMessage = errorsByKey.get(row.key)?.get(field);
      const input = (
        <Input
          size="small"
          value={row[field] ?? ""}
          status={errorMessage ? "error" : undefined}
          disabled={readOnly}
          onChange={(e) => updateCell(row.key, field, e.target.value)}
          onBlur={() => sanitizeCell(row.key, field)}
        />
      );
      return errorMessage ? <Tooltip title={errorMessage}>{input}</Tooltip> : input;
    },
  });

  const columns: ColumnsType<Row> = [
    cellColumn("Nombre*", "name"),
    cellColumn("Apellido 1*", "first_surname"),
    cellColumn("Apellido 2", "second_surname"),
    cellColumn("DNI*", "dni", 140),
    cellColumn("Correo*", "email"),
    cellColumn("Teléfono móvil", "phone_mobile", 140),
    {
      title: "Grupo",
      key: "group_status",
      width: 150,
      render: (_: unknown, row: Row) => {
        if (row.id_group == null) return null;
        if (row.currently_in_group) return <Tag color="green">En grupo</Tag>;
        return (
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <Tag color="orange">Dado de baja</Tag>
            {onReleaseGroup && (
              <Popconfirm
                title="¿Liberar a este alumno?"
                description="Volverá a estar seleccionable en el modal de importación de otro grupo."
                okText="Liberar"
                cancelText="Cancelar"
                onConfirm={() => handleReleaseGroup(row.id)}
              >
                <Button size="small" icon={<UnlockOutlined />} loading={releasingId === row.id} title="Liberar alumno" />
              </Popconfirm>
            )}
          </span>
        );
      },
    },
    ...(readOnly
      ? []
      : [
          {
            title: "",
            key: "actions",
            width: 48,
            render: (_: unknown, row: Row) => (
              <Button size="small" danger icon={<DeleteOutlined />} onClick={() => removeRow(row.key)} />
            ),
          },
        ]),
  ];

  return (
    <div>
      {!readOnly && (
        <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
          <Button icon={<PlusOutlined />} onClick={addRow}>Añadir fila</Button>
          <Button icon={<SnippetsOutlined />} onClick={() => setPasteModalOpen(true)}>Pegar desde Excel</Button>
          <Upload customRequest={handleUploadRequest} showUploadList={false} accept=".xlsx,.xls">
            <Button icon={<InboxOutlined />} loading={uploading}>Subir Excel</Button>
          </Upload>
          <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSave}>
            Guardar cambios
          </Button>
        </div>
      )}
      <Table<Row>
        id="course-request-students-table"
        size="small"
        rowKey="key"
        columns={columns}
        dataSource={rows}
        pagination={false}
        scroll={{ x: "max-content" }}
        rowClassName={(row) => row.key === `id-${scrollToStudentId}` ? 'student-row-highlight' : ''}
      />
      <Modal
        title="Pegar alumnos desde Excel"
        open={pasteModalOpen}
        onOk={handlePasteConfirm}
        onCancel={() => setPasteModalOpen(false)}
        okText="Añadir filas"
      >
        <p>Copia el bloque de celdas en Excel (Ctrl+C) y pégalo aquí (Ctrl+V).</p>
        <Input.TextArea
          rows={8}
          value={pasteText}
          onChange={(e) => setPasteText(e.target.value)}
          placeholder="Pega aquí el bloque copiado de Excel"
        />
      </Modal>
    </div>
  );
}
