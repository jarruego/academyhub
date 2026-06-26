# Sanitización de datos (`api/user-sanitization`)

Herramienta de administración que localiza usuarios con datos **presentes pero
inválidos** y permite corregir los auto-corregibles o abrir la ficha para
corrección manual. Solo `Role.ADMIN`.

## Criterio: "presente pero inválido"

Un campo vacío/nulo **no** es error (eso es un dato faltante, no incorrecto).
Solo se marca un campo que tiene valor y no supera su validador.

| Campo | Inválido cuando… | Auto-corregible (sugerencia) |
|---|---|---|
| `phone` | `sanitizePhone()` → `undefined` (p. ej. <9 dígitos) | si la forma saneada ≠ valor (quita separadores) |
| `email` | `sanitizeEmail()` → `undefined` (caracteres no permitidos) | si la forma saneada ≠ valor (minúsculas/espacios) |
| `dni` | `isValidDocument()` → false (formato o letra de control mal) | **nunca** (edición manual) |
| `nss` | `!isValidNss()` | si `canonicalNss()` pasa el dígito de control y ≠ valor (caso del cero a la izquierda perdido en Excel/SAGE) |

## Validadores reutilizados

- `server/src/utils/email.util.ts` → `sanitizeEmail`
- `server/src/utils/phone.util.ts` → `sanitizePhone`
- `server/src/utils/nss.util.ts` → `isValidNss`, `canonicalNss`
- `server/src/utils/dni.util.ts` → `isValidDocument` (nuevo; portado de
  `client/src/utils/detect-document-type.ts`, que el backend no podía importar)

La lógica de detección vive en una función pura testeable
`detectUserIssues(user)` (`user-sanitization.util.ts`); `suggestFix(field, value)`
es la **única** fuente de verdad del valor saneado y la usan tanto la detección
como el endpoint de corrección, para que coincidan exactamente.

## Endpoints

- `GET /api/user-sanitization/issues` → usuarios con ≥1 issue
  (`{ id_user, name, first_surname, second_surname, issues: UserIssue[] }`).
- `POST /api/user-sanitization/:id/fix` con `{ field: 'phone'|'email'|'nss' }`.
  El servidor **recalcula y revalida** el valor (no confía en el cliente) y lo
  guarda. `dni` no es auto-corregible, por eso no está en la whitelist del DTO.
- `POST /api/user-sanitization/:id/manual` con `{ field, value }` (field acepta
  los 4, incluido `dni`): corrección manual. El servidor valida/normaliza el valor
  con `normalizeValidValue()` y **rechaza** lo que no supere la validación del
  campo (no se guarda un valor que volvería a aparecer como error).
- `POST /api/user-sanitization/fix-all` con `{ field }` (mismo DTO/whitelist):
  corrige en bloque todos los valores auto-corregibles de ese campo. Devuelve
  `{ fixed, failed: [{ id_user, value, suggestion }] }`; las colisiones de
  unicidad no abortan el proceso, se saltan y se listan en `failed`.

`getIssues` añade `baja: boolean` por usuario (LEFT JOIN a `user_center` con
`is_main_center = true`: baja = `end_date` no nulo en el centro principal).

`dni` y `nss` son columnas `unique`: si el valor saneado choca con otro usuario,
`fix` captura el error `23505` y devuelve un `BadRequestException` con mensaje
claro (posible duplicado → resolver a mano, ver `docs/user-merge.md`).

## Cliente

- Hook: `client/src/hooks/api/user-sanitization/useSanitization.ts`.
- UI: `client/src/components/tools/UserSanitization.tsx` (tabla con filtro por tipo
  y buscador). Cada error es una etiqueta clicable: `✎` auto-corregible (modal con
  `valor → sugerencia` + "Aplicar corrección"), `⚠` manual (un `Input` para
  introducir el valor correcto → "Guardar valor", validado en el servidor; o abrir
  `/users/:id` en otra pestaña). Una barra de **corrección masiva** ofrece un botón
  por campo auto-corregible (teléfono/email/NSS) con el nº pendiente y `Popconfirm`.
  Los usuarios de baja en su centro principal llevan un tag rojo **"Baja"** y hay
  un switch **"Ocultar bajas"**. Registrada en `ToolList.tsx` (categoría
  "Herramientas") y en `router.tsx` (`/tools/user-sanitization`).
