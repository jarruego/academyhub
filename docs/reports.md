# Reports system

Read before touching `api/reports/`.

PDF generation uses `ReportsPdfService` backed by `ReportRenderer` (`src/api/reports/report-renderer.service.ts`). Templates are JSON files in `src/api/reports/templates/*.json` that declare pages, element types (`title`, `paragraph`, `table`, `image`), styles, and `{{variable}}` placeholders filled at render time. `renderTemplate()` streams a PDF to a response; `renderTemplateIntoDocument()` writes into an existing PDFKit doc for multi-template composition. `PdfService` (`src/common/pdf/pdf.service.ts`) is the shared PDFKit wrapper.

Report rows are built in `ReportsRepository.getReportRows` (`src/database/repository/reports/reports.repository.ts`): parameterized Drizzle SQL (no injection), with sortable columns whitelisted. `time_spent` is only populated when `plugins.itop_training` is enabled (see `docs/mail-moodle.md`). The `moodle_password` column shown in some templates (e.g. `dedication-v1.json`) is read plaintext (intentionally — see `docs/security.md`).

Filters are declared in `ReportFilterDTO` (`src/dto/reports/report-filter.dto.ts`). The WHERE clauses are built in `ReportsRepository.buildWhereConditions(filter, exclude?)` — a **pure** method (no DB access, unit-tested in `reports.repository.spec.ts`) shared by both the row listing and the facets. Among the filters, `bonified?: boolean` (UI checkbox "Solo bonificados" in `reports.route.tsx`) restricts rows to enrolments with `user_group.bonified = true` (the FUNDAE bonification flag — see `docs/user-merge.md`/`group-bonification.service`). Like the other filters, it is carried inside the export payload's nested filter, so it also constrains the generated PDF/Excel.

## Faceted filters (interdependent dropdowns)

The report dropdowns (Company, Center, Course, Group, Role, plus the course axes Modality, Client, Funding) are a **faceted search**: each one only offers values that still have a matching report row given the *other* active filters. Backed by `GET /reports/facets` → `ReportsService.getFacets` → `ReportsRepository.getReportFacets`, which runs 8 `SELECT DISTINCT` over the **same JOINs** as the listing (so e.g. a course "belongs to" a company only through that join chain). Modality/Client/Funding are multi-select enum filters (`courses.modality|client|funding`, `inArray` in `buildWhereConditions`) and their facets return the distinct enum values present (`{ value }` columns flattened to `string[]`).

- **Standard facets**: each dimension's options are computed with all filters *except its own* (`buildWhereConditions(filter, exclude)` with `exclude` ∈ `FacetDimension`), so a multi-select doesn't restrict itself and can still be widened. Global filters (dates, search, completion %, `bonified`) never get excluded.
- **Group** is only computed when a course is selected (otherwise an empty list), mirroring the client's `disabled={!selectedCourse}`.
- Client: `useReportFacetsQuery` (`client/src/hooks/api/reports/use-report-facets.query.ts`) is called with the filter params minus pagination/sort (`ReportFacetsParams`), uses `placeholderData: keepPreviousData`, and feeds every dropdown's `options`. On each recompute an effect in `reports.route.tsx` **auto-prunes** any selection no longer present in its facet (keeps filters/table coherent). `useReportRolesQuery` is kept only to apply the default "student" role on load.
- Note: the internal facet query builder is typed `any` and re-asserted per facet because a wide generic on `selectDistinct` breaks drizzle's join-chain inference.
