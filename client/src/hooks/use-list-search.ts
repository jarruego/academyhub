import { useMemo, useState } from "react";
import { useDebounce } from "./use-debounce";
import { normalizeSearch } from "../utils/normalize-search";

/**
 * Estado de búsqueda para listados paginados en servidor: mantiene el texto del
 * input y expone su versión normalizada con debounce, lista para mandarla a la
 * query. Unifica el patrón searchText + useDebounce + normalizeSearch repetido
 * en users.route y center-detail.
 *
 * @param delay Debounce en ms (por defecto 500).
 */
export function useListSearch(delay = 500) {
  const [searchText, setSearchText] = useState("");
  const debounced = useDebounce(searchText, delay);
  const normalized = useMemo(() => normalizeSearch(debounced), [debounced]);
  return { searchText, setSearchText, normalized };
}
