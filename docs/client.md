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
`client/src/router.tsx` defines all routes and the top-level layout. The sidebar is role-aware: Reports is visible to `admin`, `manager`, and `viewer`; the Administración sub-menu is only visible to `admin`. Administración has Organization plus four category entries that each open a card page (no nested sub-menus): **Importaciones** (`/tools/importaciones`), **Gestión y acceso** (`/tools/gestion-acceso`), **Correo** (`/tools/correo`) and **Herramientas** (`/tools/herramientas`). Each page renders `components/tools/ToolList.tsx` with a `categoryKey` prop, filtering `toolCategories` to that group's tool cards; `/tools` with no key still shows every category. Tool definitions and their grouping live in `toolCategories` (Importaciones: Moodle, data cross-reference, SAGE, INAEM · Gestión y acceso: user management, audit log · Correo: SMTP settings `/organization/smtp`, email log · Herramientas: forum duplicator).

**Responsive sidebar:** breakpoint is `md` (768 px). On `md+` a persistent `<Sider>` is rendered. Below `md` the Sider is replaced by a `<Header>` with a hamburger button that opens a `<Drawer>`. Use `screens.md === false` (not `!screens.md`) to detect mobile — avoids a flash on first render when `useBreakpoint` hasn't resolved yet. Drawer closes when any leaf `<Link>` is clicked; the Administración sub-menu can expand/collapse without closing the drawer because `onClick={onClose}` is placed on the `<Link>` nodes, not on the `<Menu>`.

## Responsive design conventions
**Form layouts:** replace `<div style={{ display: 'flex', gap: 16 }}>` with `<Row gutter={[16, 0]}>` + `<Col xs={24} sm={X} md={Y}>`. Never use hardcoded pixel widths on `<Form.Item>` — let the `<Col>` control the width. `<DatePicker>` and `<Select>` inside a Col need `style={{ width: '100%' }}` to fill their column.

**Wide tables:** add `scroll={{ x: 'max-content', y: N }}` and pin key columns with `fixed: 'left'`. Fixed columns must be contiguous from the left edge.

**Table navigation:** main list tables (`users`, `groups`, `courses`, `companies`, `centers`) use `onClick` on `onRow` for single-click navigation. Tables inside detail pages keep `onDoubleClick` to avoid conflicts with row selection.

**Cross-page preselection via URL params:** double-clicking a course row in the user detail "Cursos" tab (`user-courses-section.tsx`) opens `/courses/:id?groupId=&userId=` in a new tab (`window.open`, no shared React Query cache between tabs). `course-detail.route.tsx` reads `groupId`/`userId` via `useSearchParams` once on mount to preselect the group (falls back to the default first group if not found) and highlight the user (`GroupUsersManager`'s `highlightUserId` prop, applied as a selected checkbox + scroll-into-view, not a CSS highlight).

**Gotcha — refs inside `setState` updaters:** never mutate a `ref` inside a functional `setState` updater (`setX((prev) => { ref.current = ...; return ...; })`). React 18 `<StrictMode>` invokes updater functions twice to detect impurities; the second call sees the ref already mutated and silently produces the wrong result. Consume/mutate the ref in the effect body instead, guarded by a dedicated "applied" boolean ref (refs are safe across StrictMode's double-invocation since they persist between calls).

## Course typology (UI)
Data model / enums → `docs/architecture.md`. UI consumption of the three axes (modality/origin/funding):

`utils/course-profile.ts` (`getCourseProfile({ modality, origin, funding })`) is the **single source of truth** for type-driven UI — returns capability flags (`showMoodleSync`, `showProgressColumn`, `showFinalizedColumn`, `showBonificationButton`, `showExpediente`, `showPreinscripciones`). Use it instead of scattering `modality === 'presencial'` checks. `showBonificationButton` is permissive (hidden only for explicit non-FUNDAE funding, matching the server guard).

- **Group members table** (`GroupUsersManager`, the main `getCourseProfile` consumer): columns adapt to the course type.
  - `showFinalizedColumn` = presencial **or** INAEM (any modality). Presencial: the **Finalizado** column (tag green/red from `user_group.finalized`) *replaces* **Porcentaje** and drops Moodle/Tiempo (no Moodle progress). INAEM online/mixta: **Finalizado** is *appended* while keeping the online columns (Moodle sync + progreso).
  - **Porcentaje, Tiempo usado y Finalizado** only render a value for students (`isStudentUser`); other roles (tutores, etc.) show an empty cell. Applies to every course type.

- **Courses list** (`courses.route.tsx`): `Segmented` tabs **Todos / FUNDAE / INAEM / Privada / Sin clasificar** — client-side predicates over the loaded list (consistent with search/active-state; server-side `FilterCourseDTO` exists for API use). Active tab in URL (`?tab=`); columns adapt per tab.
- **Course form** (create + detail): fields grouped by axis; **Nº Expediente** only for INAEM origin, **FUNDAE ID** only for FUNDAE funding (detail keeps them visible if a value already exists).
- **Users list** (`users.route.tsx`): **Tipo de formación** select (`fundae`/`inaem`/`privada`) — *derived* filter (no type column on `user`); server-side `FilterUserDTO.formation_type` via `EXISTS` over `user_group → groups → courses`. `privada` = PRIVADA-origin non-FUNDAE.

## Type sharing
Shared types between components and hooks live in `client/src/shared/types/`. Component-level types stay in `client/src/types/`. Zod schemas for form validation are in `client/src/schemas/` (currently only Spanish DNI and CIF validators; form schemas are co-located with their route components).

## Tests
Vitest with `happy-dom` environment. Test files are co-located with routes/components as `*.spec.tsx`. Type-check the whole client with `npx tsc -b --noEmit`.
