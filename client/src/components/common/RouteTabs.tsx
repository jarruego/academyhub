import { useState } from "react";
import { Tabs } from "antd";
import type { TabsProps } from "antd";
import { useSearchParams } from "react-router-dom";

interface RouteTabsProps extends Omit<TabsProps, "activeKey" | "onChange" | "defaultActiveKey"> {
  items: NonNullable<TabsProps["items"]>;
  /** Search param que persiste la pestaña activa (por defecto "tab"). */
  paramName?: string;
  /**
   * Clave por defecto cuando la URL no trae una válida. Si se omite, la primera
   * pestaña. La pestaña por defecto se representa **sin** el parámetro en la URL
   * (URLs limpias), igual que el patrón de `courses.route`.
   */
  defaultTabKey?: string;
  /**
   * Si es `false`, el estado de la pestaña es interno (no toca la URL). Úsalo
   * cuando el componente se renderiza **embebido** dentro de otra página que ya
   * usa `?tab=` (p. ej. `UserDetail` dentro del modal de `course-detail`), para
   * evitar que dos juegos de pestañas se peleen por el mismo parámetro.
   */
  syncUrl?: boolean;
}

/**
 * Pestañas de página sincronizadas con la URL (`?tab=`). Único patrón de
 * pestañas de la app: claves **semánticas** (`datos`, `usuarios`, `centros`…),
 * sincronización con `useSearchParams({ replace })` y soporte de pestañas
 * condicionales (las claves válidas se derivan de `items` en cada render).
 *
 * Sustituye a los `<Tabs>` con claves numéricas `"1"/"2"` y al sync manual con
 * `navigate()` que había en los detalles.
 */
export function RouteTabs({ items, paramName = "tab", defaultTabKey, syncUrl = true, ...rest }: RouteTabsProps) {
  const [searchParams, setSearchParams] = useSearchParams();

  const validKeys = items.map((item) => String(item.key));
  const fallback =
    defaultTabKey && validKeys.includes(defaultTabKey) ? defaultTabKey : (validKeys[0] ?? "");

  // Estado interno para el modo embebido (syncUrl=false).
  const [internalKey, setInternalKey] = useState(fallback);

  const urlKey = searchParams.get(paramName);
  const activeKey = syncUrl
    ? urlKey && validKeys.includes(urlKey) ? urlKey : fallback
    : validKeys.includes(internalKey) ? internalKey : fallback;

  const onChange = (key: string) => {
    if (!syncUrl) {
      setInternalKey(key);
      return;
    }
    const next = new URLSearchParams(searchParams);
    if (key === fallback) next.delete(paramName);
    else next.set(paramName, key);
    setSearchParams(next, { replace: true });
  };

  return <Tabs activeKey={activeKey} onChange={onChange} items={items} {...rest} />;
}
