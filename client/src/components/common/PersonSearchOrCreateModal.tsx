import { useMemo, useState } from "react";
import { App, Input, Modal, Select, Space, theme } from "antd";
import { normalizeLoose } from "../../utils/normalize-search";
import { findPotentialDuplicate, type DuplicateMatch } from "../../utils/duplicate-match.util";
import { DuplicateMatchModal, type DuplicateResolution } from "./DuplicateMatchModal";
import { getApiHost } from "../../utils/api/get-api-host.util";
import { useAuthenticatedAxios } from "../../utils/api/use-authenticated-axios.util";

const errorMessage = (error: unknown, fallback: string) =>
  (error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback;

export type PersonLookup = {
  id_user: number;
  dni?: string | null;
  name: string;
  first_surname?: string | null;
  second_surname?: string | null;
  phone?: string | null;
  email?: string | null;
};

export type PersonSearchOrCreateInput =
  | { id_user: number }
  | { new_user: { name: string; first_surname?: string; second_surname?: string; dni?: string; phone?: string; email?: string } };

/**
 * Modal reutilizable "buscar persona existente o dar de alta una nueva" —
 * la usan Candidatos e Interesados. El estado del formulario vive aquí, no en
 * el padre, para que teclear no re-renderice listados grandes fuera de esta
 * modal (en Candidatos, cada tecla re-renderizaba toda la tabla).
 *
 * Búsqueda y alta unificadas, sin modos separados: el buscador de arriba
 * busca por nombre/apellidos/DNI/email/teléfono (por palabras sueltas, no la
 * frase completa en un único campo — "Juan García" encuentra a alguien con
 * nombre "Juan" y apellido "García" aunque no estén juntos en ningún campo).
 * Si eliges un resultado, los campos de abajo se autorellenan y se bloquean
 * (esa persona se edita desde su ficha, no aquí); si no eliges nada, esos
 * mismos campos sirven para dar de alta a alguien nuevo.
 */
export function PersonSearchOrCreateModal({ title, open, onClose, availableUsers, submitting, onSubmit }: {
  title: string;
  open: boolean;
  onClose: () => void;
  availableUsers: PersonLookup[];
  submitting: boolean;
  onSubmit: (input: PersonSearchOrCreateInput) => void;
}) {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const request = useAuthenticatedAxios();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<PersonLookup | null>(null);
  const [name, setName] = useState("");
  const [firstSurname, setFirstSurname] = useState("");
  const [secondSurname, setSecondSurname] = useState("");
  const [dni, setDni] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [duplicate, setDuplicate] = useState<DuplicateMatch | null>(null);
  const [merging, setMerging] = useState(false);

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

  const selectExisting = (id_user: number) => {
    const u = availableUsers.find(x => x.id_user === id_user);
    if (!u) return;
    setSelected(u);
    setName(u.name); setFirstSurname(u.first_surname ?? ""); setSecondSurname(u.second_surname ?? "");
    setDni(u.dni ?? ""); setPhone(u.phone ?? ""); setEmail(u.email ?? "");
  };

  const clearSelection = () => {
    setSelected(null); setSearch("");
    setName(""); setFirstSurname(""); setSecondSurname(""); setDni(""); setPhone(""); setEmail("");
  };

  const createOk = !selected && Boolean(name.trim()) && (Boolean(phone.trim()) || Boolean(email.trim()));
  const canSubmit = Boolean(selected) || createOk;

  const buildNewUser = () => ({
    name: name.trim(),
    first_surname: firstSurname.trim() || undefined,
    second_surname: secondSurname.trim() || undefined,
    dni: dni.trim() || undefined,
    phone: phone.trim() || undefined,
    email: email.trim() || undefined,
  });

  const handleOk = () => {
    if (selected) return onSubmit({ id_user: selected.id_user });
    if (!createOk) return;
    const newUser = buildNewUser();
    const match = findPotentialDuplicate(newUser, availableUsers);
    if (match) setDuplicate(match);
    else onSubmit({ new_user: newUser });
  };

  const resolveDuplicate = async (resolution: DuplicateResolution) => {
    if (!duplicate) return;
    if (resolution.action === "use_existing") {
      onSubmit({ id_user: duplicate.person.id_user });
    } else if (resolution.action === "create_new") {
      onSubmit({ new_user: buildNewUser() });
    } else {
      setMerging(true);
      try {
        await request({ method: "PUT", url: `${getApiHost()}/user/${duplicate.person.id_user}`, data: resolution.values });
        onSubmit({ id_user: duplicate.person.id_user });
      } catch (error) {
        message.error(errorMessage(error, "No se pudieron combinar los datos."));
        return;
      } finally {
        setMerging(false);
      }
    }
    setDuplicate(null);
  };

  return <Modal title={title} open={open} onCancel={onClose} onOk={handleOk} okButtonProps={{ disabled: !canSubmit, loading: submitting }} destroyOnClose>
    <Select showSearch allowClear style={{ width: "100%", marginBottom: 12 }}
      placeholder="Buscar por nombre, apellidos, DNI, email o teléfono"
      value={selected ? selected.id_user : undefined}
      searchValue={search} onSearch={setSearch} filterOption={false} options={options}
      notFoundContent={search.trim() ? "Sin coincidencias: se creará una persona nueva" : null}
      onChange={value => { if (value != null) selectExisting(value); }}
      onClear={clearSelection} />
    {selected && <div style={{ marginBottom: 8, fontSize: 12, color: token.colorTextSecondary }}>Persona existente seleccionada — estos datos no se editan aquí (usa su ficha). Pulsa la X del buscador para dar de alta a alguien nuevo en su lugar.</div>}
    {duplicate && <DuplicateMatchModal open={Boolean(duplicate)} onClose={() => setDuplicate(null)} submitting={merging} newData={buildNewUser()} match={duplicate} onResolve={resolveDuplicate} />}
    <Space direction="vertical" style={{ width: "100%" }}>
      <Input placeholder="Nombre (obligatorio)" value={name} disabled={!!selected} onChange={e => setName(e.target.value)} />
      <Space.Compact style={{ width: "100%" }}>
        <Input placeholder="Primer apellido" value={firstSurname} disabled={!!selected} onChange={e => setFirstSurname(e.target.value)} />
        <Input placeholder="Segundo apellido" value={secondSurname} disabled={!!selected} onChange={e => setSecondSurname(e.target.value)} />
      </Space.Compact>
      <Input placeholder="DNI/NIE" value={dni} disabled={!!selected} onChange={e => setDni(e.target.value)} />
      <Input placeholder="Teléfono" value={phone} disabled={!!selected} onChange={e => setPhone(e.target.value)} />
      <Input placeholder="Email" value={email} disabled={!!selected} onChange={e => setEmail(e.target.value)} />
      {!selected && <span style={{ fontSize: 12, color: token.colorTextSecondary }}>Indica al menos un teléfono o un email para poder contactar.</span>}
    </Space>
  </Modal>;
}
