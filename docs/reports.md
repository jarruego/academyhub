# Reports system

Read before touching `api/reports/`.

PDF generation uses `ReportsPdfService` backed by `ReportRenderer` (`src/api/reports/report-renderer.service.ts`). Templates are JSON files in `src/api/reports/templates/*.json` that declare pages, element types (`title`, `paragraph`, `table`, `image`), styles, and `{{variable}}` placeholders filled at render time. `renderTemplate()` streams a PDF to a response; `renderTemplateIntoDocument()` writes into an existing PDFKit doc for multi-template composition. `PdfService` (`src/common/pdf/pdf.service.ts`) is the shared PDFKit wrapper.

Report rows are built in `ReportsRepository.getReportRows` (`src/database/repository/reports/reports.repository.ts`): parameterized Drizzle SQL (no injection), with sortable columns whitelisted. `time_spent` is only populated when `plugins.itop_training` is enabled (see `docs/mail-moodle.md`). The `moodle_password` column shown in some templates (e.g. `dedication-v1.json`) is read plaintext (intentionally — see `docs/security.md`).
