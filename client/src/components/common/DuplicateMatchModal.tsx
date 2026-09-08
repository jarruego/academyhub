import { useEffect, useState } from "react";
import { Alert, Modal, Radio, Space, Tag, Typography, theme } from "antd";
import { CheckCircleOutlined } from "@ant-design/icons";
import type { PersonLookup } from "./PersonSearchOrCreateModal";
import type { DuplicateMatch, PersonIdentityInput } from "../../utils/duplicate-match.util";

const { Text } = Typography;

type FieldKey = "name" | "first_surname" | "second_surname" | "dni" | "phone" | "email";
type Side = "new" | "existing";

const FIELDS: { key: FieldKey; label: string }[] = [
  { key: "name", label: "Nombre" },
  { key: "first_surname", label: "Primer apellido" },
  { key: "second_surname", label: "Segundo apellido" },
  { key: "dni", label: "DNI/NIE" },
  { key: "phone", label: "Teléfono" },
  { key: "email", label: "Email" },
];

const isEmptyVal = (v: unknown): boolean => v === undefined || v === null || String(v).trim() === "";

const valueOf = (source: PersonIdentityInput | PersonLookup, key: FieldKey): string | null | undefined =>
  (source as Record<FieldKey, string | null | undefined>)[key];

export type DuplicateResolution =
  | { action: "use_existing" }
  | { action: "merge"; values: PersonIdentityInput }
  | { action: "create_new" };

/**
 * Se muestra cuando `findPotentialDuplicate` (duplicate-match.util.ts) encuentra a alguien
 * parecido al dar de alta una persona a mano en "Añadir candidato"/"Añadir interesado"
 * (PersonSearchOrCreateModal). Adaptación del patrón de grid clicable de `DecisionModal`
 * (client/src/components/import-sage/PendingDecisionsComponent.tsx) a este caso.
 */
export function DuplicateMatchModal({ open, onClose, submitting, newData, match, onResolve }: {
  open: boolean;
  onClose: () => void;
  submitting: boolean;
  newData: PersonIdentityInput;
  match: DuplicateMatch;
  onResolve: (resolution: DuplicateResolution) => void;
}) {
  const { token } = theme.useToken();
  const [action, setAction] = useState<"use_existing" | "merge" | "create_new">("use_existing");
  const [selections, setSelections] = useState<Partial<Record<FieldKey, Side>>>({});

  useEffect(() => {
    if (!open) return;
    setAction("use_existing");
    const defaults: Partial<Record<FieldKey, Side>> = {};
    for (const f of FIELDS) {
      const newEmpty = isEmptyVal(valueOf(newData, f.key));
      const existingEmpty = isEmptyVal(valueOf(match.person, f.key));
      if (newEmpty && existingEmpty) continue;
      defaults[f.key] = newEmpty ? "existing" : existingEmpty ? "new" : "existing";
    }
    setSelections(defaults);
  }, [open, match, newData]);

  const selectionEnabled = action === "merge";

  const handleOk = () => {
    if (action === "use_existing") return onResolve({ action: "use_existing" });
    if (action === "create_new") return onResolve({ action: "create_new" });
    const values: PersonIdentityInput = { name: "" };
    for (const f of FIELDS) {
      const side = selections[f.key];
      const value = side === "new" ? valueOf(newData, f.key) : side === "existing" ? valueOf(match.person, f.key) : undefined;
      if (value) (values as Record<FieldKey, string>)[f.key] = value;
    }
    onResolve({ action: "merge", values });
  };

  return <Modal
    title="Posible persona duplicada"
    open={open}
    onCancel={onClose}
    onOk={handleOk}
    okButtonProps={{ loading: submitting }}
    okText={action === "use_existing" ? "Usar existente" : action === "merge" ? "Combinar y continuar" : "Crear de todas formas"}
    width={640}
    destroyOnClose
  >
    <Space direction="vertical" size="middle" style={{ width: "100%" }}>
      <Alert
        type="warning"
        showIcon
        message={match.confidence === "exact"
          ? `Ya existe alguien con el mismo ${match.matchedOn === "dni" ? "DNI/NIE" : match.matchedOn === "email" ? "email" : "teléfono"}.`
          : "Ya existe alguien con un nombre muy parecido."}
      />

      <div style={{ display: "grid", gridTemplateColumns: "130px 1fr 1fr", gap: 8, alignItems: "center" }}>
        <div />
        <div><Tag color="blue">Nuevo</Tag></div>
        <div><Tag color="green">Existente</Tag></div>

        {FIELDS.map(f => {
          const newValue = valueOf(newData, f.key);
          const existingValue = valueOf(match.person, f.key);
          const renderCell = (side: Side) => {
            const value = side === "new" ? newValue : existingValue;
            const empty = isEmptyVal(value);
            const selected = selectionEnabled && selections[f.key] === side;
            const selectable = selectionEnabled && !empty;
            return (
              <div
                onClick={() => selectable && setSelections(prev => ({ ...prev, [f.key]: side }))}
                style={{
                  cursor: selectable ? "pointer" : "default",
                  border: `1px solid ${selected ? token.colorSuccess : token.colorBorderSecondary}`,
                  background: selected ? token.colorSuccessBg : token.colorBgContainer,
                  borderRadius: 6,
                  padding: "4px 8px",
                  minHeight: 30,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  opacity: empty ? 0.5 : 1,
                }}
              >
                {selected && <CheckCircleOutlined style={{ color: token.colorSuccess }} />}
                <span>{empty ? <Text type="secondary">Vacío</Text> : String(value)}</span>
              </div>
            );
          };
          return <div key={f.key} style={{ display: "contents" }}>
            <div><Text strong>{f.label}</Text></div>
            {renderCell("new")}
            {renderCell("existing")}
          </div>;
        })}
      </div>

      <Radio.Group value={action} onChange={e => setAction(e.target.value)}>
        <Space direction="vertical">
          <Radio value="use_existing">Usar los datos ya existentes (ignorar lo escrito)</Radio>
          <Radio value="merge">Combinar campo a campo (elige arriba)</Radio>
          <Radio value="create_new">Son personas distintas — crear de todas formas</Radio>
        </Space>
      </Radio.Group>
    </Space>
  </Modal>;
}
