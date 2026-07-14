import { AdminNotificationService } from './admin-notification.service';

// Construimos el servicio con mocks de MailService y AuthUserRepository y
// accedemos a los métodos privados vía cast, igual que en otros specs.
const makeService = (mail: any, authRepo: any) =>
  new AdminNotificationService(mail as any, authRepo as any);

describe('AdminNotificationService.notifyScheduledJobFailure', () => {
  it('envía un correo a todos los administradores con email', async () => {
    const sendMail = jest.fn().mockResolvedValue(undefined);
    const findAll = jest.fn().mockResolvedValue([
      { email: 'a@x.com' },
      { email: ' b@x.com ' }, // se recorta
      { email: '' }, // se descarta
      { email: null }, // se descarta
    ]);
    const svc = makeService({ sendMail }, { findAll });

    await svc.notifyScheduledJobFailure({ source: 'Importación SAGE', error: 'boom', jobId: 'job-1' });

    // Solo se consultan admins
    expect(findAll).toHaveBeenCalledWith({ role: 'admin' });
    expect(sendMail).toHaveBeenCalledTimes(1);
    const arg = sendMail.mock.calls[0][0];
    expect(arg.to).toEqual(['a@x.com', 'b@x.com']);
    expect(arg.subject).toContain('Importación SAGE');
    expect(arg.html).toContain('job-1');
    expect(arg.html).toContain('boom');
  });

  it('no envía correo si no hay administradores con email', async () => {
    const sendMail = jest.fn();
    const findAll = jest.fn().mockResolvedValue([{ email: '' }]);
    const svc = makeService({ sendMail }, { findAll });

    await svc.notifyScheduledJobFailure({ source: 'X', error: 'e' });

    expect(sendMail).not.toHaveBeenCalled();
  });

  it('es best-effort: nunca lanza aunque falle el envío', async () => {
    const sendMail = jest.fn().mockRejectedValue(new Error('SMTP caído'));
    const findAll = jest.fn().mockResolvedValue([{ email: 'a@x.com' }]);
    const svc = makeService({ sendMail }, { findAll });

    await expect(
      svc.notifyScheduledJobFailure({ source: 'X', error: 'e' }),
    ).resolves.toBeUndefined();
  });

  it('escapa el HTML del error para evitar inyección en el cuerpo', async () => {
    const sendMail = jest.fn().mockResolvedValue(undefined);
    const findAll = jest.fn().mockResolvedValue([{ email: 'a@x.com' }]);
    const svc = makeService({ sendMail }, { findAll });

    await svc.notifyScheduledJobFailure({ source: 'X', error: '<script>alert(1)</script>' });

    const arg = sendMail.mock.calls[0][0];
    expect(arg.html).not.toContain('<script>');
    expect(arg.html).toContain('&lt;script&gt;');
  });
});
