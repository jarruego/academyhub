import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ReportsService, ReportRowsSelection } from './reports.service';
import { ReportsPdfService } from './reports-pdf.service';
import { MailService, EmailActor, SendMailAttachment } from '../mail/mail.service';
import { MailTemplatesService } from '../mail/mail-templates.service';
import { CourseRequestRepository, CourseRequestStudentRepository } from 'src/database/repository/course-request/course-request.repository';
import { normalizeDni } from '../course-request/course-request-normalize.util';
import type { ReportRowDTO } from 'src/dto/reports/report-row.dto';
import type { ReportSendDTO } from 'src/dto/reports/report-send.dto';

export type ReportSendStatus = 'sent' | 'skipped' | 'failed';
export type ReportSendGroupKind = 'request' | 'center' | 'unassignable';

export interface ReportSendResult {
  group_key: string;
  kind: ReportSendGroupKind;
  center_name: string;
  course_name?: string | null;
  status: ReportSendStatus;
  recipients?: string[];
  note?: string;
  error?: string;
}

/** Vista previa de un grupo de envío (sin filas completas, para la UI). */
export interface ReportSendGroupPreview {
  group_key: string;
  kind: 'request' | 'center';
  center_name: string;
  course_name: string | null;
  student_count: number;
  eligible_count: number;
  suggested_email: string | null;
  row_keys: string[];
  eligible_row_keys: string[];
}

export interface ReportSendGroupsPreview {
  groups: ReportSendGroupPreview[];
  unassignable_count: number;
}

/** Grupo de envío con las filas completas (uso interno: construir adjuntos/variables). */
interface SendGroup {
  group_key: string;
  kind: 'request' | 'center';
  center_name: string;
  course_name: string | null;
  suggested_email: string | null;
  rows: ReportRowDTO[];
}

const getRowKey = (r: ReportRowDTO) => (r.id_user != null && r.id_group != null) ? `${r.id_user}-${r.id_group}` : `${r.dni ?? ''}-${r.moodle_id ?? ''}`;

@Injectable()
export class ReportsMailService {
  private readonly logger = new Logger(ReportsMailService.name);

  constructor(
    private readonly reportsService: ReportsService,
    private readonly reportsPdfService: ReportsPdfService,
    private readonly mailService: MailService,
    private readonly mailTemplatesService: MailTemplatesService,
    private readonly courseRequestRepository: CourseRequestRepository,
    private readonly courseRequestStudentRepository: CourseRequestStudentRepository,
  ) {}

  /**
   * Agrupa las filas de informe por la **petición** que matriculó a cada
   * alumno (cruzando por DNI normalizado contra `course_request_students`,
   * filtrado por `id_group` — igual que `CourseRequestService` calcula
   * "en grupo/total"). El destinatario por defecto de cada grupo es el
   * `contact_email` de esa petición.
   *
   * Los alumnos que no se puedan asociar a ninguna petición (matriculados a
   * mano, por Excel o traídos de Moodle) caen en un grupo de **fallback por
   * centro** (su `id_center` actual), sin destinatario sugerido — hay que
   * escribirlo a mano. Los que ni siquiera tienen centro quedan fuera de
   * `groups` del todo (`unassignableCount`): no hay nada a lo que enviarles.
   */
  private async buildSendGroups(rows: ReportRowDTO[]): Promise<{ groups: SendGroup[]; unassignableCount: number }> {
    const idGroups = [...new Set(rows.map((r) => r.id_group).filter((v): v is number => v != null))];
    const assigned = idGroups.length ? await this.courseRequestStudentRepository.findAssignedByGroups(idGroups) : [];

    // Última asignación gana si dos peticiones distintas matricularon el mismo
    // DNI en el mismo grupo (caso raro, ver docs/course-requests.md) — las filas
    // vienen ordenadas ascendente por id_request, así que el último set() es la
    // petición más reciente.
    const requestByKey = new Map<string, number>();
    for (const a of assigned) {
      if (a.id_group == null) continue;
      requestByKey.set(`${a.id_group}:${normalizeDni(a.dni)}`, a.id_request);
    }

    const requestRows = new Map<number, ReportRowDTO[]>();
    const centerRows = new Map<number, ReportRowDTO[]>();
    let unassignableCount = 0;

    for (const row of rows) {
      const key = row.id_group != null ? `${row.id_group}:${normalizeDni(row.dni ?? '')}` : undefined;
      const idRequest = key ? requestByKey.get(key) : undefined;
      if (idRequest != null) {
        const arr = requestRows.get(idRequest) ?? [];
        arr.push(row);
        requestRows.set(idRequest, arr);
        continue;
      }
      if (row.id_center != null) {
        const arr = centerRows.get(row.id_center) ?? [];
        arr.push(row);
        centerRows.set(row.id_center, arr);
        continue;
      }
      unassignableCount += 1;
    }

    const requestIds = [...requestRows.keys()];
    const headers = requestIds.length ? await this.courseRequestRepository.findByIds(requestIds) : [];
    const headerById = new Map(headers.map((h) => [h.id_request, h]));

    const groups: SendGroup[] = [];
    for (const [idRequest, groupRows] of requestRows) {
      const header = headerById.get(idRequest);
      groups.push({
        group_key: `req:${idRequest}`,
        kind: 'request',
        center_name: header?.center_name ?? String(groupRows[0]?.center_name ?? 'Sin centro'),
        course_name: header?.course_name ?? groupRows[0]?.course_name ?? null,
        suggested_email: header?.contact_email ?? null,
        rows: groupRows,
      });
    }
    for (const [idCenter, groupRows] of centerRows) {
      groups.push({
        group_key: `ctr:${idCenter}`,
        kind: 'center',
        center_name: String(groupRows[0]?.center_name ?? 'Sin centro'),
        course_name: null,
        suggested_email: null,
        rows: groupRows,
      });
    }

    // Peticiones primero (ya traen destinatario sugerido); dentro de cada
    // bloque, orden alfabético por centro para que la UI sea estable.
    groups.sort((a, b) => (a.kind !== b.kind ? (a.kind === 'request' ? -1 : 1) : a.center_name.localeCompare(b.center_name)));

    return { groups, unassignableCount };
  }

  private toPreview(g: SendGroup): ReportSendGroupPreview {
    const eligibleRows = g.rows.filter((r) => Number(r.completion_percentage ?? 0) >= 75);
    return {
      group_key: g.group_key,
      kind: g.kind,
      center_name: g.center_name,
      course_name: g.course_name,
      student_count: g.rows.length,
      eligible_count: eligibleRows.length,
      suggested_email: g.suggested_email,
      row_keys: g.rows.map(getRowKey),
      eligible_row_keys: eligibleRows.map(getRowKey),
    };
  }

  /** Resuelve la selección a los grupos de envío (petición / centro de fallback), sin enviar nada. */
  async resolveSendGroups(selection: ReportRowsSelection): Promise<ReportSendGroupsPreview> {
    const rows = await this.reportsService.resolveRows(selection);
    const { groups, unassignableCount } = await this.buildSendGroups(rows);
    return { groups: groups.map((g) => this.toPreview(g)), unassignable_count: unassignableCount };
  }

  private buildVariables(group: SendGroup): Record<string, string> {
    const courseNames = [...new Set(group.rows.map((r) => r.course_name).filter((v): v is string => !!v))];

    // `group_start_date`/`group_end_date` llegan como `Date` (una instancia
    // distinta por fila, aunque representen el mismo día): deduplicar con
    // `Set` directamente sobre esos valores compara por referencia, no por
    // valor, así que con 2+ alumnos casi nunca detectaba "una sola fecha" y
    // {FECHA_INICIO}/{FECHA_FIN} salían siempre vacías. Se normaliza a una
    // clave de fecha (YYYY-MM-DD) antes de deduplicar.
    const toDateKey = (v: unknown): string | undefined => {
      if (!v) return undefined;
      const d = v instanceof Date ? v : new Date(String(v));
      return Number.isNaN(d.getTime()) ? undefined : d.toISOString().slice(0, 10);
    };
    const formatDateKey = (key: string) => new Date(`${key}T00:00:00Z`).toLocaleDateString('es-ES', { timeZone: 'UTC' });

    const startKeys = [...new Set(group.rows.map((r) => toDateKey(r.group_start_date)).filter((v): v is string => !!v))];
    const endKeys = [...new Set(group.rows.map((r) => toDateKey(r.group_end_date)).filter((v): v is string => !!v))];

    return {
      '{NOMBRE_CENTRO}': group.center_name,
      '{NOMBRE_CURSO}': courseNames.join(', '),
      '{FECHA_INICIO}': startKeys.length === 1 ? formatDateKey(startKeys[0]) : '',
      '{FECHA_FIN}': endKeys.length === 1 ? formatDateKey(endKeys[0]) : '',
      '{USUARIO_MOODLE}': '',
      '{CLAVE_MOODLE}': '',
    };
  }

  private applyVariables(input: string, variables: Record<string, string>): string {
    return Object.entries(variables).reduce((acc, [key, value]) => acc.replaceAll(key, value ?? ''), input);
  }

  /** Resuelve asunto/contenido a partir de la plantilla elegida o del correo personalizado. */
  private async resolveContent(body: ReportSendDTO): Promise<{ subject: string; content: string; isHtml: boolean; templateName?: string }> {
    if (body.send_mode === 'template') {
      if (!body.template_id) throw new BadRequestException('Falta la plantilla de correo');
      const template = await this.mailTemplatesService.findById(body.template_id);
      if (!template) throw new BadRequestException('Plantilla de correo no encontrada');
      return {
        subject: template.subject || template.name,
        content: template.content,
        isHtml: !!template.is_html,
        templateName: template.name,
      };
    }

    if (!body.subject?.trim()) throw new BadRequestException('El asunto es obligatorio');
    const isHtml = !!body.html;
    const content = isHtml ? body.html! : (body.text ?? '');
    if (!content.trim()) throw new BadRequestException('El contenido del correo es obligatorio');
    return { subject: body.subject, content, isHtml };
  }

  private async buildAttachmentsForGroup(
    group: SendGroup,
    body: ReportSendDTO,
    assets: { logoBuffer?: Buffer; signatureBuffer?: Buffer; issuerName?: string; companyCity?: string },
  ): Promise<{ attachments: SendMailAttachment[]; notes: string[] }> {
    const attachments: SendMailAttachment[] = [];
    const notes: string[] = [];

    if (body.attach.includes('dedication')) {
      const buffer = await this.reportsPdfService.buildDedicationPdfBuffer(group.rows, {
        includePasswords: false,
        logoBuffer: assets.logoBuffer,
        signatureBuffer: assets.signatureBuffer,
        issuerName: assets.issuerName,
      });
      attachments.push({ filename: `${group.center_name} - Dedicacion.pdf`, content: buffer, contentType: 'application/pdf' });
    }

    if (body.attach.includes('dedication_passwords')) {
      const buffer = await this.reportsPdfService.buildDedicationPdfBuffer(group.rows, {
        includePasswords: true,
        logoBuffer: assets.logoBuffer,
        signatureBuffer: assets.signatureBuffer,
        issuerName: assets.issuerName,
      });
      attachments.push({ filename: `${group.center_name} - Dedicacion con claves.pdf`, content: buffer, contentType: 'application/pdf' });
    }

    if (body.attach.includes('certification')) {
      const eligible = group.rows.filter((r) => Number(r.completion_percentage ?? 0) >= 75);
      if (eligible.length) {
        const buffer = await this.reportsPdfService.buildCertificationPdfBuffer(eligible, {
          logoBuffer: assets.logoBuffer,
          signatureBuffer: assets.signatureBuffer,
          issuerName: assets.issuerName,
          companyCity: assets.companyCity,
        });
        attachments.push({ filename: `${group.center_name} - Certificado.pdf`, content: buffer, contentType: 'application/pdf' });
      } else {
        notes.push('Certificado omitido: ningún alumno seleccionado de este grupo alcanza el 75% de finalización.');
      }
    }

    return { attachments, notes };
  }

  /**
   * Envía los informes seleccionados por correo, un email por **petición**
   * (con fallback por centro para quien no venga de ninguna petición).
   * Requiere `recipients` ya resueltos por el cliente, indexados por
   * `group_key` (formato `req:<id_request>` / `ctr:<id_center>`).
   */
  async sendReportMail(body: ReportSendDTO, actor?: EmailActor): Promise<ReportSendResult[]> {
    const rows = await this.reportsService.resolveRows({
      filter: body.filter,
      selected_keys: body.selected_keys,
      select_all_matching: body.select_all_matching,
      deselected_keys: body.deselected_keys,
    });
    if (!rows.length) throw new BadRequestException('No hay alumnos que coincidan con la selección');

    const { subject, content, isHtml, templateName } = await this.resolveContent(body);
    const assets = await this.reportsPdfService.loadOrganizationAssets();
    const { groups, unassignableCount } = await this.buildSendGroups(rows);
    const recipientsByKey = new Map((body.recipients ?? []).map((r) => [r.group_key, r.emails]));

    const results: ReportSendResult[] = [];
    for (const group of groups) {
      const emails = recipientsByKey.get(group.group_key);
      if (!emails?.length) {
        results.push({ group_key: group.group_key, kind: group.kind, center_name: group.center_name, course_name: group.course_name, status: 'skipped', note: 'No se indicaron destinatarios para este grupo.' });
        continue;
      }

      const { attachments, notes } = await this.buildAttachmentsForGroup(group, body, assets);
      if (!attachments.length) {
        results.push({ group_key: group.group_key, kind: group.kind, center_name: group.center_name, course_name: group.course_name, status: 'skipped', note: notes.join(' ') || 'Nada que adjuntar.' });
        continue;
      }

      const variables = this.buildVariables(group);
      const finalSubject = this.applyVariables(subject, variables);
      const finalContent = this.applyVariables(content, variables);

      try {
        await this.mailService.sendMail({
          to: emails,
          subject: finalSubject,
          html: isHtml ? finalContent : undefined,
          text: isHtml ? undefined : finalContent,
          from_email: body.from_email,
          from_name: body.from_name,
          reply_to: body.reply_to,
          attachments,
          actor,
          templateId: body.send_mode === 'template' ? body.template_id : undefined,
          templateName,
        });
        results.push({ group_key: group.group_key, kind: group.kind, center_name: group.center_name, course_name: group.course_name, status: 'sent', recipients: emails, note: notes.join(' ') || undefined });
      } catch (err) {
        this.logger.warn({ err, group_key: group.group_key }, 'Fallo al enviar informe por correo a un grupo de alumnos');
        results.push({ group_key: group.group_key, kind: group.kind, center_name: group.center_name, course_name: group.course_name, status: 'failed', recipients: emails, error: err instanceof Error ? err.message : String(err) });
      }
    }

    if (unassignableCount > 0) {
      results.push({
        group_key: 'none',
        kind: 'unassignable',
        center_name: 'Sin centro',
        status: 'skipped',
        note: `${unassignableCount} alumno(s) sin petición ni centro asociado; no se les puede enviar nada.`,
      });
    }

    return results;
  }

  /** Envía una única copia de prueba (el primer grupo de la selección) a una dirección indicada, sin tocar los destinatarios reales. */
  async sendTestReportMail(body: ReportSendDTO, actor?: EmailActor): Promise<{ center_name: string }> {
    if (!body.test_email) throw new BadRequestException('Falta el email de prueba');

    const rows = await this.reportsService.resolveRows({
      filter: body.filter,
      selected_keys: body.selected_keys,
      select_all_matching: body.select_all_matching,
      deselected_keys: body.deselected_keys,
    });
    if (!rows.length) throw new BadRequestException('No hay alumnos que coincidan con la selección');

    const { subject, content, isHtml, templateName } = await this.resolveContent(body);
    const assets = await this.reportsPdfService.loadOrganizationAssets();
    const { groups } = await this.buildSendGroups(rows);
    if (!groups.length) throw new BadRequestException('Los alumnos seleccionados no tienen petición ni centro asociado');
    const [group] = groups;

    const { attachments } = await this.buildAttachmentsForGroup(group, body, assets);
    const variables = this.buildVariables(group);

    await this.mailService.sendMail({
      to: body.test_email,
      subject: this.applyVariables(subject, variables),
      html: isHtml ? this.applyVariables(content, variables) : undefined,
      text: isHtml ? undefined : this.applyVariables(content, variables),
      from_email: body.from_email,
      from_name: body.from_name,
      attachments,
      actor,
      templateId: body.send_mode === 'template' ? body.template_id : undefined,
      templateName,
    });

    return { center_name: group.center_name };
  }
}
