import { Segmented } from "antd";
import { ColumnHeightOutlined, CompressOutlined, MoonOutlined, SunOutlined } from "@ant-design/icons";
import { useUiPreferences } from "../../theme/ui-preferences";

/**
 * Control de preferencias de interfaz para el pie del sidebar: tema y densidad
 * en una sola línea. Deliberadamente pequeño — no es un configurador de marca
 * (colores, tipografías): eso lo fija `theme/tokens.ts` y no se toca desde la UI.
 *
 * Sin `<Tooltip>`: cada opción lleva su propio `title` nativo, que basta como
 * pista y no interfiere con el reparto flex de las dos mitades.
 */
export function UiPreferencesControl() {
  const { mode, density, setMode, setDensity } = useUiPreferences();

  return (
    <div style={{ display: "flex", gap: 8 }}>
      <Segmented
        block
        size="small"
        style={{ flex: 1 }}
        value={mode}
        onChange={(value) => setMode(value as typeof mode)}
        options={[
          { value: "light", icon: <SunOutlined />, title: "Tema claro" },
          { value: "dark", icon: <MoonOutlined />, title: "Tema oscuro" },
        ]}
      />
      <Segmented
        block
        size="small"
        style={{ flex: 1 }}
        value={density}
        onChange={(value) => setDensity(value as typeof density)}
        options={[
          { value: "comfortable", icon: <ColumnHeightOutlined />, title: "Densidad normal" },
          { value: "compact", icon: <CompressOutlined />, title: "Densidad compacta" },
        ]}
      />
    </div>
  );
}
