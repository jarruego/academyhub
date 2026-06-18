# Client architecture (React + Vite)

Read before frontend work under `client/`.

## API communication
- `getApiHost()` (`client/src/utils/api/get-api-host.util.ts`) — returns `VITE_API_URL` in dev, or the hardcoded Render URL in production
- Vite proxies `/api` → `http://localhost:3000` in dev (configured in `vite.config.ts`)
- `useAuthenticatedAxios()` — hook that returns an Axios caller pre-configured with `Authorization: Bearer <token>`
- All data-fetching hooks live under `client/src/hooks/api/` and use TanStack Query

## Hooks pattern
Each domain under `client/src/hooks/api/` has separate `.query.ts` and `.mutation.ts` files. Queries use `useSuspenseQuery` or `useQuery`; mutations use `useMutation` with `onSuccess` invalidating related queries. Query keys follow a hierarchical array pattern: `["resource", ...filters]` (e.g., `["moodle-links", authUserId]`). Errors are typed as `AxiosError<ApiErrorDto>`.

## Auth flow
`AuthProvider` (`client/src/providers/auth/auth.provider.tsx`) persists `{ token, user }` to `localStorage` under the key `"userInfo"`. On mount it reads it back via `readUserInfo()`. `useAuthInfo()` exposes the context; `useRole()` extracts the role. Routes check role to show/hide menu items. All protected routes are guarded on the server side by the global `AuthGuard`. Use `<AuthzHide roles={[Role.ADMIN]}>` (`client/src/components/permissions/authz-hide.tsx`) to conditionally render UI elements based on role.

## Routing
`client/src/router.tsx` defines all routes and the top-level layout. The sidebar is role-aware: Reports is visible to `admin`, `manager`, and `viewer`; the Administración sub-menu (Organization, SMTP, Tools) is only visible to `admin`. Admin tools live under `/tools/*` and are listed in `components/tools/ToolList.tsx` (e.g. audit log, email log, SAGE/Moodle/Velneo imports, data cross-reference, user management).

**Responsive sidebar:** breakpoint is `md` (768 px). On `md+` a persistent `<Sider>` is rendered. Below `md` the Sider is replaced by a `<Header>` with a hamburger button that opens a `<Drawer>`. Use `screens.md === false` (not `!screens.md`) to detect mobile — avoids a flash on first render when `useBreakpoint` hasn't resolved yet. Drawer closes when any leaf `<Link>` is clicked; the Administración sub-menu can expand/collapse without closing the drawer because `onClick={onClose}` is placed on the `<Link>` nodes, not on the `<Menu>`.

## Responsive design conventions
**Form layouts:** replace `<div style={{ display: 'flex', gap: 16 }}>` with `<Row gutter={[16, 0]}>` + `<Col xs={24} sm={X} md={Y}>`. Never use hardcoded pixel widths on `<Form.Item>` — let the `<Col>` control the width. `<DatePicker>` and `<Select>` inside a Col need `style={{ width: '100%' }}` to fill their column.

**Wide tables:** add `scroll={{ x: 'max-content', y: N }}` and pin key columns with `fixed: 'left'`. Fixed columns must be contiguous from the left edge.

**Table navigation:** main list tables (`users`, `groups`, `courses`, `companies`, `centers`) use `onClick` on `onRow` for single-click navigation. Tables inside detail pages keep `onDoubleClick` to avoid conflicts with row selection.

## Course typology (modality / origin / funding)
Three **orthogonal** axes on a course, each its own enum (mirrored server↔client):
- **Modality** (`course-modality.enum`): `Online` / `Presencial` / `Mixta` — how it's delivered.
- **Origin** (`course-origin.enum`): `PRIVADA` / `INAEM` — who commissions it. Empresa-vs-particular is derived from whether the student has a `company`, not stored here.
- **Funding** (`course-funding.enum`): `PRIVADA` / `FUNDAE` / `PUBLICA` — how it's paid. INAEM courses are always `PUBLICA`.

`utils/course-profile.ts` (`getCourseProfile({ modality, origin, funding })`) is the **single source of truth** for type-driven UI: it returns capability flags (`showMoodleSync`, `showProgressColumn`, `showFinalizedColumn`, `showBonificationButton`, `showExpediente`, `showPreinscripciones`). Consume it instead of scattering `modality === 'presencial'` checks. `showBonificationButton` is permissive (hidden only for explicit non-FUNDAE funding, matching the server bonification guard). `GroupUsersManager` consumes it (Moodle/progress/finalized columns, Moodle + Bonificar buttons).

**Courses list** (`courses.route.tsx`): a `Segmented` control gives tabs **Todos / FUNDAE / INAEM / Privada / Sin clasificar** (predicates over the already-loaded list; filtering is client-side, consistent with the search and active-state computation — the server-side `FilterCourseDTO` filters exist for API use). Active tab persists in the URL (`?tab=`). Columns adapt per tab (Origen/Financiación/Nº Exp. hidden where redundant).

**Course form** (create + detail): fields grouped by axis; Origen + Financiación selects; **Nº Expediente** shown only for INAEM origin, **FUNDAE ID** only for FUNDAE funding (detail also shows them when a value already exists, so unclassified courses don't hide data).

## Type sharing
Shared types between components and hooks live in `client/src/shared/types/`. Component-level types stay in `client/src/types/`. Zod schemas for form validation are in `client/src/schemas/` (currently only Spanish DNI and CIF validators; form schemas are co-located with their route components).

## Tests
Vitest with `happy-dom` environment. Test files are co-located with routes/components as `*.spec.tsx`. Type-check the whole client with `npx tsc -b --noEmit`.
