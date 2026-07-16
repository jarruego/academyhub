# Fusión de usuarios duplicados

**Read before touching `api/user-merge/`.**

Herramienta admin para fusionar **fichas duplicadas de la misma persona** en `users`. Caso típico: la misma persona con dos registros (uno con NIE, otro con DNI) y/o NSS con/sin ceros a la izquierda. Como `dni` y `nss` son `UNIQUE`, esos duplicados rompen `import-sage` `update_and_link` (colisión 23505 → ver `docs/import.md`) y ensucian matrículas/preinscripciones/reports.

## Detección
Por **NSS normalizado**: `normalizeNss` quita no-dígitos y ceros a la izquierda (`081358086457` == `81358086457`). `getCandidates()` agrupa `users` por ese valor (`HAVING count(*)>1`, clave `<>''`) y devuelve, por miembro, datos clave + recuentos de relaciones (`user_course`/`user_group`/`user_center`/`user_preinscription`/`moodle_users`). Marca `nameMatch=false` si los nombres normalizados del grupo no coinciden (posible falso positivo — solo aviso visual; NSS puede colisionar por error de tecleo).

## Endpoints (`@Controller("api/user-merge")`, `RoleGuard([ADMIN])`)
El prefijo `api/` va **en el decorador** (no hay prefijo global; el cliente llama vía `getApiHost()` directo, saltándose el proxy de Vite — misma convención que `api/import`, `api/import-inaem`, `api/forum`).
- `GET /api/user-merge/candidates` — grupos de duplicados.
- `GET /api/user-merge/preview/:winnerId/:loserId` — diff escalar campo a campo (`{ field, winnerValue, loserValue, differ, winnerEmpty }`), colisiones de relación y `dualMoodle`. No modifica nada.
- `POST /api/user-merge/:winnerId/:loserId` — body `{ fieldsFromLoser: string[] }`. **IDs en la ruta a propósito**: así quedan registrados en `audit_log.target` (el interceptor NO guarda el body). No hay tabla de log propia: la trazabilidad (actor + IDs + fecha) la da `audit_log`. La operación es **irreversible** (no se conserva snapshot del perdedor).

## Algoritmo `UserMergeService.merge()` (una transacción)
1. Carga ganador y perdedor (snapshot del perdedor en memoria, para aplicar campos al final).
2. **Reasigna hijos** del perdedor al ganador gestionando colisión de PK compuesta (`reassignLinkTable`): si el ganador ya tiene la misma clave (`id_course`/`id_group`/`id_center`) se **fusionan** ambas filas y se borra la del perdedor; si no, se **mueve** (`UPDATE id_user`). Reglas de fusión por fila en `user-merge.util.ts`:
   - `user_course`: mayor `completion_percentage`/`time_spent`, `enrollment_date` más antigua, `id_moodle_user` si falta.
   - `user_group`: `finalized`/`is_tutor` = OR, `id_role`/`id_center` = coalesce, mayor progreso, `last_access` más reciente, `join_date` más antigua.
   - `user_preinscription`: estado más fuerte (MATRICULADO > PREINSCRITO > BAJA > DESCARTADO), `prioritaria` = OR, fecha más antigua.
   - `user_center`: sin merge de campos (se conserva la fila del ganador); luego `recalcMainCenter` deja **un solo** `is_main_center` (activo con `start_date` más antiguo; si no, `end_date` más reciente).
   - `moodle_users`: mueve los mapeos del perdedor al ganador (un solo `is_main_user`); marca `dualMoodle` si ambos tenían cuenta (aviso en UI — la fusión NO toca Moodle).
   - `import_decisions.selected_user_id`: repunta perdedor → ganador (coherente con el borrado de usuarios).
3. **Borra** la fila del perdedor en `users` (ya sin FKs entrantes; libera `dni`/`nss`).
4. **Aplica campos elegidos** del perdedor (whitelist `MERGEABLE_FIELDS`), incluido `dni` (ya liberado → sin colisión). El resto: el ganador es autoritativo.
5. **NSS (caso especial, no elegible campo a campo):** se conserva siempre el NSS **válido** (dígito de control correcto, `mod 97`), **sea del ganador o del perdedor**, en forma canónica de 12 dígitos. Lo resuelve `pickValidNss` (`src/utils/nss.util.ts`). Motivo: muchos NSS se guardaron sin el cero a la izquierda (11 díg → no validan); entre las dos variantes del mismo NSS gana la de 12 dígitos válida. La preview lo expone en `resolvedNss` (la UI lo muestra como informativo, sin checkbox).

## NSS canónico en TODOS los guardados
`src/utils/nss.util.ts` (`nssDigits`/`isValidNss`/`canonicalNss`/`pickValidNss`) se aplica en todos los puntos de escritura de `users.nss`, no solo en la fusión: alta/edición manual (`UserService.sanitizeUserData`) e importación SAGE (`buildUserUpdates` + `createNewUser`). `canonicalNss` rellena con ceros a la izquierda hasta 12 dígitos (no rechaza datos legacy; solo normaliza el formato). INAEM no importa NSS. El algoritmo de control (`primeros 10 dígitos mod 97 == últimos 2`) se validó empíricamente contra los datos reales (~86% de los de 12 dígitos lo cumplen; el resto son tecleos erróneos).

## Cliente
Tool **Fusión de duplicados** (`/tools/merge-duplicates`, admin) en categoría "Herramientas" (`ToolList.tsx`). Componente `MergeDuplicates.tsx` + hooks `hooks/api/user-merge/useMergeData.ts`. Flujo: lista de grupos → elegir **ganador** (radio) → "Fusionar →" en la ficha a absorber → modal de previsualización con **checkbox por campo** (por defecto solo trae el valor del perdedor donde el ganador está vacío) + avisos de colisiones/dual-Moodle → confirmar.

El `MergeModal` está **exportado** y lo reutiliza la Auditoría de Moodle (`docs/moodle-audit.md`) para fusionar vínculos incorrectos (ganador = usuario que casa por DNI, perdedor = duplicado vinculado); por eso `useMergeMutation` invalida también `["moodle-audit-report"]`. Los props `winnerId`/`loserId` son solo el punto de partida: el modal tiene un botón **"Intercambiar ganador ↔ perdedor"** (estado interno; la previsualización se recarga porque la query lleva ambos IDs en la clave).

## Tests / gotchas
- Tests Jest cubren los helpers puros (`user-merge.util.spec.ts`): `normalizeNss`, merges de fila, ranking de estado. La fusión completa necesita Postgres real (diferida, como el E2E de SAGE/INAEM).
- La whitelist `MERGEABLE_FIELDS` evita escribir columnas arbitrarias desde el body; el DTO valida con `@IsIn`.
- Para >2 fichas en un grupo, se fusiona por pares (repetir).
