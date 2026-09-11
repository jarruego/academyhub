import { useMemo, useState } from "react";
import { App, Input, Modal, Select, Space, theme } from "antd";
import { normalizeLoose } from "../../utils/normalize-search";
import { detectDocumentType } from "../../utils/detect-document-type";
import type { PersonLookup } from "../common/PersonSearchOrCreateModal";
import type { CourseRequestStudentInput } from "../../shared/types/course-request/course-request";

const sanitizeText = (v: string) => v.trim().replace(/\s+/g, " ");
const sanitizeDni = (v: string) => v.toUpperCase().replace(/[^A-Z0-9]/g, "");
const sanitizeEmail = (v: string) => v.trim().toLowerCase().replace(/\s+/g, "");
const sanitizePhone = (v: string) => {
  const s = v.trim();
  const hasPlus = s.startsWith("+");
  return (hasPlus ? "+" : "") + s.replace(/\D/g, "");
};

/**
 * Modal "buscar persona existente o escribir una nueva" para Peticiones —
 * mismo patrón de UX que PersonSearchOrCreateModal (Candidatos/Interesados),
 * pero sin vincular a `users`: `course_request_students` no tiene id_user a
 * propósito (ver docs/course-requests.md "Alcance de esta fase"), así que al
 * confirmar solo se añade una fila de texto a la grid. Elegir a alguien del
 * buscador copia sus datos como punto de partida, pero a diferencia de
 * Candidatos/Interesados los campos quedan editables tras seleccionar: no hay
 * una ficha real detrás que proteger de la edición.
 */
export function AddCourseRequestStudentModal({ open, onClose, availableUsers, existingDnis, onAdd }: {
  open: boolean;
  onClose: () => void;
  availableUsers: PersonLookup[];
  existingDnis: Set<string>;
  onAdd: (row: CourseRequestStudentInput) => void;
}) {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const [search, setSearch] = useState("");
  const [name, setName] = useState("");
  const [firstSurname, setFirstSurname] = useState("");
  const [secondSurname, setSecondSurname] = useState("");
  const [dni, setDni] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  const options = useMemo(() => {
    const words = normalizeLoose(search).split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    return availableUsers
      .filter(u => {
        const haystack = normalizeLoose([u.name, u.first_surname, u.second_surname, u.dni, u.email, u.phone].filter(Boolean).join(" "));
        return words.every(w => haystack.includes(w));
      })
      .slice(0, 50)
      .map(u => ({ value: u.id_user, label: `${[u.name, u.first_surname, u.second_surname].filter(Boolean).join(" ")} · ${u.dni || "sin DNI"}` }));
  }, [search, availableUsers]);

  const reset = () => {
    setSearch(""); setName(""); setFirstSurname(""); setSecondSurname(""); setDni(""); setPhone(""); setEmail("");
  };

  const selectExisting = (id_user: number) => {
    const u = availableUsers.find(x => x.id_user === id_user);
    if (!u) return;
    setName(u.name); setFirstSurname(u.first_surname ?? ""); setSecondSurname(u.second_surname ?? "");
    setDni(u.dni ?? ""); setPhone(u.phone ?? ""); setEmail(u.email ?? "");
  };

  const canSubmit = Boolean(name.trim());

  const handleOk = () => {
    if (!canSubmit) return;
    const row: CourseRequestStudentInput = {
      name: sanitizeText(name),
      first_surname: sanitizeText(firstSurname),
      second_surname: sanitizeText(secondSurname),
      dni: sanitizeDni(dni),
      email: sanitizeEmail(email),
      phone_mobile: sanitizePhone(phone),
    };
    if (row.dni && existingDnis.has(row.dni)) {
      message.warning("Ya hay un alumno con ese DNI en esta petición — se ha añadido igualmente, revísalo antes de guardar.");
    }
    onAdd(row);
    reset();
    onClose();
  };

  return <Modal title="Añadir alumno" open={open} onCancel={() => { reset(); onClose(); }} onOk={handleOk}
    okButtonProps={{ disabled: !canSubmit }} okText="Añadir a la petición" destroyOnClose>
    <Select showSearch allowClear style={{ width: "100%", marginBottom: 12 }}
      placeholder="Buscar por nombre, apellidos, DNI, email o teléfono"
      searchValue={search} onSearch={setSearch} filterOption={false} options={options}
      notFoundContent={search.trim() ? "Sin coincidencias: escribe los datos abajo para añadir a alguien nuevo" : null}
      onChange={value => { if (value != null) selectExisting(value as number); }}
      onClear={reset} />
    <div style={{ marginBottom: 8, fontSize: 12, color: token.colorTextSecondary }}>
      Elegir a alguien del buscador solo copia sus datos como punto de partida — esta fila no queda vinculada a su ficha, se guarda como texto igual que el resto de la petición.
    </div>
    <Space direction="vertical" style={{ width: "100%" }}>
      <Input placeholder="Nombre (obligatorio)" value={name} onChange={e => setName(e.target.value)} />
      <Space.Compact style={{ width: "100%" }}>
        <Input placeholder="Primer apellido" value={firstSurname} onChange={e => setFirstSurname(e.target.value)} />
        <Input placeholder="Segundo apellido" value={secondSurname} onChange={e => setSecondSurname(e.target.value)} />
      </Space.Compact>
      <Input placeholder="DNI/NIE" value={dni} status={dni && !detectDocumentType(dni) ? "error" : undefined} onChange={e => setDni(e.target.value)} />
      <Input placeholder="Teléfono" value={phone} onChange={e => setPhone(e.target.value)} />
      <Input placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
    </Space>
  </Modal>;
}
