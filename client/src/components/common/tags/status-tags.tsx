import { Tag } from "antd";
import { originColor, fundingColor, modalityColor, STATUS_COLORS, FLAG_COLORS } from "../../../theme/semantic-colors";

/**
 * Tags semánticos compartidos. Centralizan el render `<Tag color=...>` para que
 * el color venga siempre de la paleta (theme/semantic-colors), no de literales
 * sueltos repartidos por las rutas.
 */

const DASH = "-";

/** Tag de origen del curso (INAEM / PRIVADA). Render `-` si no hay valor. */
export function OriginTag({ origin }: { origin?: string | null }) {
  if (!origin) return <>{DASH}</>;
  return <Tag color={originColor(origin)}>{origin}</Tag>;
}

/** Tag de financiación del curso (FUNDAE / PUBLICA / PRIVADA). Render `-` si no hay valor. */
export function FundingTag({ funding }: { funding?: string | null }) {
  if (!funding) return <>{DASH}</>;
  return <Tag color={fundingColor(funding)}>{funding}</Tag>;
}

/** Tag de modalidad del curso (Online / Presencial / Mixta). Render `-` si no hay valor. */
export function ModalityTag({ modality }: { modality?: string | null }) {
  if (!modality) return <>{DASH}</>;
  return <Tag color={modalityColor(modality)}>{modality}</Tag>;
}

/** Tag de estado activo/inactivo genérico (cursos, grupos…). */
export function ActiveTag({
  active,
  activeLabel = "Activo",
  inactiveLabel = "Inactivo",
  title,
}: {
  active: boolean;
  activeLabel?: string;
  inactiveLabel?: string;
  /** Tooltip nativo opcional (p. ej. explicar un estado derivado). */
  title?: string;
}) {
  return (
    <Tag color={active ? STATUS_COLORS.active : STATUS_COLORS.inactive} title={title}>
      {active ? activeLabel : inactiveLabel}
    </Tag>
  );
}

/** Tag "Provisional" para cursos autocreados pendientes de datos. */
export function ProvisionalTag({ style }: { style?: React.CSSProperties }) {
  return <Tag color={FLAG_COLORS.provisional} style={style}>Provisional</Tag>;
}

/**
 * Tag de finalización de un alumno en un curso/grupo (presencial / INAEM).
 * Etiqueta y color unificados: verde "Finalizado" / rojo "No finalizado".
 */
export function FinalizedTag({ finalized }: { finalized: boolean }) {
  return (
    <Tag color={finalized ? STATUS_COLORS.active : STATUS_COLORS.inactive}>
      {finalized ? "Finalizado" : "No finalizado"}
    </Tag>
  );
}
