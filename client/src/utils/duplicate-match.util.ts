import { normalizeLoose } from "./normalize-search";
import type { PersonLookup } from "../components/common/PersonSearchOrCreateModal";

export type PersonIdentityInput = {
  name: string;
  first_surname?: string;
  second_surname?: string;
  dni?: string;
  phone?: string;
  email?: string;
};

export type DuplicateMatch = {
  person: PersonLookup;
  confidence: "exact" | "similar";
  matchedOn?: "dni" | "email" | "phone";
};

// Umbral y longitud mínima idénticos a los del import de SAGE (server/src/types/import/sage-import.types.ts,
// SIMILARITY_CONFIG), para que "qué cuenta como parecido" sea consistente entre import masivo y alta manual.
const NAME_SIMILARITY_THRESHOLD = 0.9;
const MIN_NAME_LENGTH = 3;

const normalizeDni = (v?: string | null) => (v ?? "").toUpperCase().replace(/[^0-9A-Z]/g, "");
const normalizePhone = (v?: string | null) => (v ?? "").replace(/\D/g, "").slice(-9);
const normalizeEmail = (v?: string | null) => (v ?? "").trim().toLowerCase();

const buildSimilarityName = (p: { name?: string | null; first_surname?: string | null; second_surname?: string | null }) =>
  normalizeLoose(`${p.name ?? ""} ${p.first_surname ?? ""} ${p.second_surname ?? ""}`).replace(/\s+/g, " ").trim();

/** Distancia de Levenshtein — mirror del algoritmo del import de SAGE (fastest-levenshtein), reimplementado
 * aquí para no añadir esa dependencia al bundle del cliente por un cálculo tan pequeño. */
function levenshtein(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const dist = Array.from({ length: rows }, (_, i) => [i, ...Array(cols - 1).fill(0)]);
  for (let j = 1; j < cols; j++) dist[0][j] = j;
  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dist[i][j] = Math.min(dist[i - 1][j] + 1, dist[i][j - 1] + 1, dist[i - 1][j - 1] + cost);
    }
  }
  return dist[rows - 1][cols - 1];
}

/**
 * Red de seguridad al dar de alta una persona a mano (sin haberla seleccionado del buscador):
 * ¿hay ya alguien con el mismo DNI/email/teléfono (exacto, normalizado), o un nombre muy
 * parecido? Se ejecuta una sola vez al confirmar el alta, no en cada tecla — el buscador ya
 * cubre la búsqueda en vivo.
 */
export function findPotentialDuplicate(input: PersonIdentityInput, pool: PersonLookup[]): DuplicateMatch | null {
  const dni = normalizeDni(input.dni);
  const email = normalizeEmail(input.email);
  const phone = normalizePhone(input.phone);

  for (const person of pool) {
    if (dni && normalizeDni(person.dni) === dni) return { person, confidence: "exact", matchedOn: "dni" };
    if (email && normalizeEmail(person.email) === email) return { person, confidence: "exact", matchedOn: "email" };
    if (phone && normalizePhone(person.phone) === phone) return { person, confidence: "exact", matchedOn: "phone" };
  }

  const targetName = buildSimilarityName(input);
  if (targetName.length < MIN_NAME_LENGTH) return null;

  let best: { person: PersonLookup; similarity: number } | null = null;
  for (const person of pool) {
    const candidateName = buildSimilarityName(person);
    if (candidateName.length < MIN_NAME_LENGTH) continue;
    const maxLen = Math.max(targetName.length, candidateName.length);
    const similarity = 1 - levenshtein(targetName, candidateName) / maxLen;
    if (similarity >= NAME_SIMILARITY_THRESHOLD && (!best || similarity > best.similarity)) {
      best = { person, similarity };
    }
  }
  return best ? { person: best.person, confidence: "similar" } : null;
}
