import { BadRequestException } from '@nestjs/common';
import { ReportsMailService } from './reports-mail.service';
import type { ReportSendDTO } from 'src/dto/reports/report-send.dto';
import type { ReportRowDTO } from 'src/dto/reports/report-row.dto';

function makeRow(overrides: Partial<ReportRowDTO> = {}): ReportRowDTO {
  return {
    id_user: 1,
    id_group: 10,
    id_center: 100,
    center_name: 'Centro A',
    id_course: 5,
    course_name: 'Curso X',
    name: 'Juan',
    first_surname: 'Perez',
    dni: '11111111A',
    completion_percentage: 50,
    ...overrides,
  };
}

function makeService(rows: ReportRowDTO[]) {
  const reportsService = { resolveRows: jest.fn().mockResolvedValue(rows) } as any;
  const reportsPdfService = {
    loadOrganizationAssets: jest.fn().mockResolvedValue({}),
    buildDedicationPdfBuffer: jest.fn().mockResolvedValue(Buffer.from('dedication-pdf')),
    buildCertificationPdfBuffer: jest.fn().mockResolvedValue(Buffer.from('certification-pdf')),
  } as any;
  const mailService = { sendMail: jest.fn().mockResolvedValue(undefined) } as any;
  const mailTemplatesService = { findById: jest.fn() } as any;
  const courseRequestRepository = { findByIds: jest.fn().mockResolvedValue([]) } as any;
  const courseRequestStudentRepository = { findAssignedByGroups: jest.fn().mockResolvedValue([]) } as any;

  const service = new ReportsMailService(
    reportsService,
    reportsPdfService,
    mailService,
    mailTemplatesService,
    courseRequestRepository,
    courseRequestStudentRepository,
  );
  return { service, reportsService, reportsPdfService, mailService, mailTemplatesService, courseRequestRepository, courseRequestStudentRepository };
}

const baseBody: ReportSendDTO = {
  attach: ['dedication'],
  send_mode: 'custom',
  subject: 'Informe',
  html: '<p>Hola {NOMBRE_CENTRO}</p>',
  recipients: [{ group_key: 'ctr:100', emails: ['centro@test.com'] }],
};

describe('ReportsMailService', () => {
  it('lanza BadRequestException si la selección no devuelve filas', async () => {
    const { service } = makeService([]);
    await expect(service.sendReportMail(baseBody)).rejects.toThrow(BadRequestException);
  });

  it('agrupa por CENTRO (fallback) cuando el alumno no viene de ninguna petición, sin destinatario sugerido', async () => {
    const { service, mailService, courseRequestStudentRepository } = makeService([makeRow()]);
    courseRequestStudentRepository.findAssignedByGroups.mockResolvedValue([]); // nadie matriculado desde peticiones

    const results = await service.sendReportMail(baseBody);

    expect(results).toEqual([
      expect.objectContaining({ group_key: 'ctr:100', kind: 'center', center_name: 'Centro A', status: 'sent', recipients: ['centro@test.com'] }),
    ]);
    const call = mailService.sendMail.mock.calls[0][0];
    expect(call.html).toBe('<p>Hola Centro A</p>');
  });

  it('agrupa por PETICIÓN cuando el DNI del alumno matchea course_request_students para ese id_group, usando su contact_email como sugerencia', async () => {
    const { service, courseRequestStudentRepository, courseRequestRepository } = makeService([makeRow({ dni: '11111111A', id_group: 10 })]);
    courseRequestStudentRepository.findAssignedByGroups.mockResolvedValue([{ id_request: 7, id_group: 10, dni: '11111111a' }]); // DNI en minúsculas: debe normalizar igual
    courseRequestRepository.findByIds.mockResolvedValue([{ id_request: 7, center_name: 'Centro Petición', course_name: 'Curso Petición', contact_email: 'peticion@centro.com' }]);

    const preview = await service.resolveSendGroups({ selected_keys: ['1-10'] });

    expect(preview.groups).toEqual([
      expect.objectContaining({ group_key: 'req:7', kind: 'request', center_name: 'Centro Petición', course_name: 'Curso Petición', suggested_email: 'peticion@centro.com', student_count: 1 }),
    ]);
    expect(preview.unassignable_count).toBe(0);
  });

  it('sendReportMail respeta el group_key "req:<id>" al enviar, usando el contact_email como destinatario si el cliente lo confirma', async () => {
    const { service, mailService, courseRequestStudentRepository, courseRequestRepository } = makeService([makeRow({ dni: '11111111A', id_group: 10 })]);
    courseRequestStudentRepository.findAssignedByGroups.mockResolvedValue([{ id_request: 7, id_group: 10, dni: '11111111a' }]);
    courseRequestRepository.findByIds.mockResolvedValue([{ id_request: 7, center_name: 'Centro Petición', course_name: 'Curso Petición', contact_email: 'peticion@centro.com' }]);

    const results = await service.sendReportMail({ ...baseBody, recipients: [{ group_key: 'req:7', emails: ['peticion@centro.com'] }] });

    expect(results).toEqual([
      expect.objectContaining({ group_key: 'req:7', kind: 'request', status: 'sent', recipients: ['peticion@centro.com'] }),
    ]);
    expect(mailService.sendMail).toHaveBeenCalledTimes(1);
  });

  it('los alumnos sin petición NI centro no forman grupo enviable: se agregan en un resultado "unassignable"', async () => {
    const { service, mailService } = makeService([makeRow({ id_center: null })]);

    const results = await service.sendReportMail(baseBody);

    expect(results).toEqual([
      expect.objectContaining({ group_key: 'none', kind: 'unassignable', status: 'skipped', note: expect.stringContaining('1 alumno') }),
    ]);
    expect(mailService.sendMail).not.toHaveBeenCalled();
  });

  it('omite (status skipped) un grupo sin destinatarios indicados', async () => {
    const { service, mailService } = makeService([makeRow({ id_center: 200, center_name: 'Centro B' })]);
    const results = await service.sendReportMail({ ...baseBody, recipients: [] });

    expect(results).toEqual([
      expect.objectContaining({ group_key: 'ctr:200', status: 'skipped', note: expect.stringContaining('destinatarios') }),
    ]);
    expect(mailService.sendMail).not.toHaveBeenCalled();
  });

  it('filtra el certificado a >=75% y avisa cuando nadie del grupo es elegible, sin bloquear la dedicación', async () => {
    const { service, mailService, reportsPdfService } = makeService([
      makeRow({ id_user: 1, dni: '11111111A', completion_percentage: 40 }),
      makeRow({ id_user: 2, dni: '22222222B', completion_percentage: 80 }),
    ]);

    await service.sendReportMail({ ...baseBody, attach: ['dedication', 'certification'] });

    expect(reportsPdfService.buildCertificationPdfBuffer).toHaveBeenCalledTimes(1);
    const [eligibleRows] = reportsPdfService.buildCertificationPdfBuffer.mock.calls[0];
    expect(eligibleRows).toHaveLength(1);
    expect(eligibleRows[0].id_user).toBe(2);

    const call = mailService.sendMail.mock.calls[0][0];
    expect(call.attachments).toHaveLength(2);
  });

  it('"dedication_passwords" es un adjunto aparte (independiente de "dedication"), con el PDF con contraseñas', async () => {
    const { service, mailService, reportsPdfService } = makeService([makeRow()]);

    await service.sendReportMail({ ...baseBody, attach: ['dedication', 'dedication_passwords'] });

    expect(reportsPdfService.buildDedicationPdfBuffer).toHaveBeenCalledTimes(2);
    expect(reportsPdfService.buildDedicationPdfBuffer).toHaveBeenNthCalledWith(1, expect.anything(), expect.objectContaining({ includePasswords: false }));
    expect(reportsPdfService.buildDedicationPdfBuffer).toHaveBeenNthCalledWith(2, expect.anything(), expect.objectContaining({ includePasswords: true }));

    const call = mailService.sendMail.mock.calls[0][0];
    expect(call.attachments.map((a: { filename: string }) => a.filename)).toEqual([
      'Centro A - Dedicacion.pdf',
      'Centro A - Dedicacion con claves.pdf',
    ]);
  });

  it('registra "failed" con el motivo si el envío de un grupo falla, sin abortar los demás', async () => {
    const { service, mailService } = makeService([
      makeRow({ id_center: 100, center_name: 'Centro A' }),
      makeRow({ id_user: 2, dni: '22222222B', id_center: 200, center_name: 'Centro B' }),
    ]);
    mailService.sendMail.mockRejectedValueOnce(new Error('SMTP caído')).mockResolvedValueOnce(undefined);

    const results = await service.sendReportMail({
      ...baseBody,
      recipients: [{ group_key: 'ctr:100', emails: ['a@test.com'] }, { group_key: 'ctr:200', emails: ['b@test.com'] }],
    });

    expect(results).toEqual([
      expect.objectContaining({ group_key: 'ctr:100', status: 'failed', error: 'SMTP caído' }),
      expect.objectContaining({ group_key: 'ctr:200', status: 'sent' }),
    ]);
  });

  it('resuelve asunto/contenido desde la plantilla cuando send_mode es "template"', async () => {
    const { service, mailTemplatesService, mailService } = makeService([makeRow()]);
    mailTemplatesService.findById.mockResolvedValue({ id: 7, name: 'Plantilla X', subject: 'Asunto {NOMBRE_CENTRO}', content: 'Cuerpo', is_html: false });

    await service.sendReportMail({ ...baseBody, send_mode: 'template', template_id: 7, subject: undefined, html: undefined });

    const call = mailService.sendMail.mock.calls[0][0];
    expect(call.subject).toBe('Asunto Centro A');
    expect(call.text).toBe('Cuerpo');
    expect(call.templateId).toBe(7);
    expect(call.templateName).toBe('Plantilla X');
  });

  it('{FECHA_INICIO}/{FECHA_FIN} se sustituyen aunque haya varios alumnos (instancias de Date distintas para el mismo día)', async () => {
    const { service, mailService } = makeService([
      makeRow({ id_user: 1, dni: '11111111A', group_start_date: new Date('2026-09-01T00:00:00Z'), group_end_date: new Date('2026-12-01T00:00:00Z') }),
      makeRow({ id_user: 2, dni: '22222222B', group_start_date: new Date('2026-09-01T00:00:00Z'), group_end_date: new Date('2026-12-01T00:00:00Z') }),
    ]);

    await service.sendReportMail({ ...baseBody, html: '<p>Del {FECHA_INICIO} al {FECHA_FIN}</p>' });

    const call = mailService.sendMail.mock.calls[0][0];
    expect(call.html).toBe('<p>Del 1/9/2026 al 1/12/2026</p>');
  });

  it('deja {FECHA_INICIO}/{FECHA_FIN} vacías cuando el grupo mezcla fechas distintas de verdad', async () => {
    const { service, mailService } = makeService([
      makeRow({ id_user: 1, dni: '11111111A', group_start_date: new Date('2026-09-01T00:00:00Z') }),
      makeRow({ id_user: 2, dni: '22222222B', group_start_date: new Date('2026-10-01T00:00:00Z') }),
    ]);

    await service.sendReportMail({ ...baseBody, html: '<p>Inicio: {FECHA_INICIO}</p>' });

    const call = mailService.sendMail.mock.calls[0][0];
    expect(call.html).toBe('<p>Inicio: </p>');
  });

  it('sendTestReportMail envía una única copia al email de prueba usando el primer grupo', async () => {
    const { service, mailService } = makeService([makeRow()]);
    const result = await service.sendTestReportMail({ ...baseBody, test_email: 'prueba@test.com' });

    expect(result).toEqual({ center_name: 'Centro A' });
    expect(mailService.sendMail).toHaveBeenCalledTimes(1);
    expect(mailService.sendMail.mock.calls[0][0].to).toBe('prueba@test.com');
  });
});
