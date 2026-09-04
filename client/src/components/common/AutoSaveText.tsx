import { useEffect, useState } from "react";
import { Input } from "antd";

/**
 * Celda de texto tipo Excel: editable, muestra el valor del servidor mientras
 * no se edita y guarda al perder el foco. `validate` es opcional y puramente
 * visual (cajetín en rojo si no pasa) — no bloquea el guardado.
 */
export function AutoSaveText({ value, onSave, disabled, textarea, validate }: { value: string; onSave: (v: string) => void; disabled?: boolean; textarea?: boolean; validate?: (v: string) => boolean }) {
  const [local, setLocal] = useState(value);
  useEffect(() => setLocal(value), [value]);
  const commit = () => { if (local !== (value ?? "")) onSave(local); };
  const status = validate && local.trim() && !validate(local.trim()) ? "error" as const : undefined;
  return textarea
    ? <Input.TextArea size="small" status={status} autoSize={{ minRows: 2, maxRows: 6 }} value={local} disabled={disabled} onChange={e => setLocal(e.target.value)} onBlur={commit} />
    : <Input size="small" status={status} value={local} disabled={disabled} onChange={e => setLocal(e.target.value)} onBlur={commit} onPressEnter={e => e.currentTarget.blur()} />;
}
