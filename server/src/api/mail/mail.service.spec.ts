import { MailService } from './mail.service';

// MailService tiene muchas dependencias; para probar SOLO la lógica de registro
// (sendMail envolviendo deliverMail + recordEmailLog) las pasamos como dummies y
// espiamos los métodos privados implicados.
const makeService = (db?: any) =>
  new MailService(
    {} as any, // smtpSettingsService
    {} as any, // mailTemplatesService
    {} as any, // moodleUserRepository
    {} as any, // moodleMessageService
    {} as any, // authUserRepository
    {} as any, // moodleService
    (db ?? { db: {} }) as any, // databaseService
  );

describe('MailService — registro en email_log', () => {
  it('registra el envío como "sent" con los metadatos (sin cuerpo) y NO falla', async () => {
    const svc = makeService();
    // deliverMail devuelve el remitente real resuelto (lo que ve el destinatario)
    jest.spyOn(svc as any, 'deliverMail').mockResolvedValue({ fromEmail: 'notif@centro.com', fromName: 'Centro X' });
    const recSpy = jest.spyOn(svc as any, 'recordEmailLog').mockResolvedValue(undefined);

    await svc.sendMail({
      to: 'alumno@test.com',
      subject: 'Bienvenida',
      html: '<b>tu clave es 1234</b>', // el cuerpo NO debe registrarse
      moodleSenderChoice: 'tutor',
      from_name: 'Centro X',
      sendViaMoodle: true,
      templateId: 3,
      templateName: 'Bienvenida',
      actor: { id: 5, username: 'admin', role: 'admin' },
    });

    expect(recSpy).toHaveBeenCalledTimes(1);
    const entry = recSpy.mock.calls[0][0];
    expect(entry).toMatchObject({
      status: 'sent',
      recipient: 'alumno@test.com',
      subject: 'Bienvenida',
      senderMode: 'tutor',
      fromName: 'Centro X',
      fromEmail: 'notif@centro.com',
      viaMoodle: true,
      templateId: 3,
      templateName: 'Bienvenida',
      actor: { id: 5, username: 'admin', role: 'admin' },
    });
    // El contenido del correo nunca llega al registro
    expect(JSON.stringify(entry)).not.toContain('1234');
  });

  it('une múltiples destinatarios y, si el envío falla, registra "failed" + motivo y relanza', async () => {
    const svc = makeService();
    jest.spyOn(svc as any, 'deliverMail').mockRejectedValue(new Error('SMTP caído'));
    const recSpy = jest.spyOn(svc as any, 'recordEmailLog').mockResolvedValue(undefined);

    await expect(
      svc.sendMail({ to: ['a@b.c', 'd@e.f'], subject: 'Aviso' }),
    ).rejects.toThrow('SMTP caído');

    const entry = recSpy.mock.calls[0][0];
    expect(entry).toMatchObject({
      status: 'failed',
      error: 'SMTP caído',
      recipient: 'a@b.c, d@e.f',
      senderMode: 'default',
    });
  });

  it('recordEmailLog es best-effort: si la BD falla, NO lanza', async () => {
    const db = { db: { insert: () => ({ values: () => Promise.reject(new Error('db down')) }) } };
    const svc = makeService(db);
    await expect((svc as any).recordEmailLog({ status: 'sent', recipient: 'a@b.c' })).resolves.toBeUndefined();
  });
});
