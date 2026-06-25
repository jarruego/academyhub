import { Tag, Tooltip } from "antd";
import { User } from "../../../shared/types/user/user";
import { FLAG_COLORS } from "../../../theme/semantic-colors";

/**
 * Indica si el usuario tiene fecha de baja en su centro activo (centro principal).
 * Para listados que devuelven el array `centers` (lista principal, centros) se mira
 * el centro `is_main_center`; para listados de grupo, que solo traen el dato del
 * centro principal, se usa `main_center_end_date`. Sin centro principal o sin fecha
 * de baja → false.
 */
function userHasCenterBaja(
  user: Pick<User, "centers" | "main_center_end_date">,
): boolean {
  const mainCenter = user.centers?.find((c) => c.is_main_center);
  if (mainCenter) return mainCenter.end_date != null;
  return user.main_center_end_date != null;
}

/** Etiqueta roja "B" para usuarios dados de baja en su centro/empresa activo. */
export function BajaTag({ user }: { user: Pick<User, "centers" | "main_center_end_date"> }) {
  if (!userHasCenterBaja(user)) return null;
  return (
    <Tooltip title="Dado de baja en el centro/empresa activo">
      <Tag
        color={FLAG_COLORS.baja}
        style={{ marginInlineStart: 6, marginInlineEnd: 0, fontWeight: 700, paddingInline: 5 }}
      >
        B
      </Tag>
    </Tooltip>
  );
}
