import { SmsService } from './sms.service';

// SmsService tiene varias dependencias; para probar la lógica de envío/registro
// (sendSms envolviendo mailrelaySmsClient + recordSmsLog) las pasamos como
// dummies y espiamos los métodos implicados, igual que MailService.spec.ts.
const makeService = (overrides?: { smsSettingsService?: any; mailrelaySmsClient?: any; moodleUserRepository?: any; db?: any }) =>
  new SmsService(
    overrides?.smsSettingsService ?? {
      getSettings: jest.fn().mockResolvedValue({ account_url: 'cuenta.ipzmarketing.com', api_key: 'plain-key', sender_name: 'MECOHISA' }),
    },
    {} as any, // smsTemplatesService
    overrides?.mailrelaySmsClient ?? { sendSms: jest.fn().mockResolvedValue([{ id: 999, phone: '+34600000000' }]), getSentMessage: jest.fn(), ping: jest.fn() },
    overrides?.moodleUserRepository ?? { findByUserId: jest.fn().mockResolvedValue([]) },
    (overrides?.db ?? { db: {} }) as any,
  );

describe('SmsService — registro en sms_log', () => {
  it('normaliza el teléfono a E.164, envía con el sender_name por defecto y registra "sent" con el mailrelay_id (sin el mensaje)', async () => {
    const svc = makeService();
    const client = (svc as any).mailrelaySmsClient;
    const recSpy = jest.spyOn(svc as any, 'recordSmsLog').mockResolvedValue(undefined);

    await svc.sendSms({
      to: '600000000',
      message: 'Tu clave es 1234',
      actor: { id: 5, username: 'admin', role: 'admin' },
      templateId: 3,
      templateName: 'Bienvenida',
    });

    // Mailrelay exige un enlace de baja en cada SMS (422 si no lo lleva): se añade automáticamente.
    expect(client.sendSms).toHaveBeenCalledWith(
      { accountUrl: 'cuenta.ipzmarketing.com', apiKey: 'plain-key' },
      { to: ['+34600000000'], sender_name: 'MECOHISA', message: 'Tu clave es 1234\n{{ unsubscribe_url }}' },
    );

    expect(recSpy).toHaveBeenCalledTimes(1);
    const entry = recSpy.mock.calls[0][0];
    expect(entry).toMatchObject({
      status: 'sent',
      recipient: '+34600000000',
      senderName: 'MECOHISA',
      mailrelayId: 999,
      templateId: 3,
      templateName: 'Bienvenida',
      actor: { id: 5, username: 'admin', role: 'admin' },
    });
    // El texto del SMS nunca llega al registro
    expect(JSON.stringify(entry)).not.toContain('1234');
  });

  it('respeta un sender_name explícito en vez del de sms_settings', async () => {
    const svc = makeService();
    const client = (svc as any).mailrelaySmsClient;
    jest.spyOn(svc as any, 'recordSmsLog').mockResolvedValue(undefined);

    await svc.sendSms({ to: '+34611111111', message: 'Aviso', senderName: 'CENTRO' });

    expect(client.sendSms).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ sender_name: 'CENTRO' }),
    );
  });

  it('si Mailrelay falla, registra "failed" + motivo y relanza', async () => {
    const svc = makeService({
      mailrelaySmsClient: { sendSms: jest.fn().mockRejectedValue(new Error('Mailrelay caído')), getSentMessage: jest.fn(), ping: jest.fn() },
    });
    const recSpy = jest.spyOn(svc as any, 'recordSmsLog').mockResolvedValue(undefined);

    await expect(svc.sendSms({ to: '600000000', message: 'Aviso' })).rejects.toThrow('Mailrelay caído');

    const entry = recSpy.mock.calls[0][0];
    expect(entry).toMatchObject({ status: 'failed', error: 'Mailrelay caído' });
  });

  it('recordSmsLog es best-effort: si la BD falla, NO lanza', async () => {
    const db = { db: { insert: () => ({ values: () => ({ returning: () => Promise.reject(new Error('db down')) }) }) } };
    const svc = makeService({ db });
    await expect((svc as any).recordSmsLog({ status: 'sent', recipient: '+34600000000' })).resolves.toBeUndefined();
  });

  it('no duplica {{ unsubscribe_url }} si el mensaje/plantilla ya lo incluye', async () => {
    const svc = makeService();
    const client = (svc as any).mailrelaySmsClient;
    jest.spyOn(svc as any, 'recordSmsLog').mockResolvedValue(undefined);

    await svc.sendSms({ to: '600000000', message: 'Aviso importante.\n{{ unsubscribe_url }}' });

    expect(client.sendSms).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ message: 'Aviso importante.\n{{ unsubscribe_url }}' }),
    );
  });

  it('teléfono inválido: lanza antes de llamar a Mailrelay', async () => {
    const svc = makeService();
    const client = (svc as any).mailrelaySmsClient;
    await expect(svc.sendSms({ to: '123', message: 'Aviso' })).rejects.toThrow('Teléfono inválido');
    expect(client.sendSms).not.toHaveBeenCalled();
  });
});

describe('SmsService.sendSmsFromTemplate', () => {
  it('sustituye {NOMBRE_CURSO}/{FECHA_INICIO} de la plantilla antes de enviar', async () => {
    const svc = makeService();
    const templatesService = { findById: jest.fn().mockResolvedValue({ id: 7, name: 'Recordatorio', message: 'Tu curso {NOMBRE_CURSO} empieza el {FECHA_INICIO}' }) };
    (svc as any).smsTemplatesService = templatesService;
    const sendSpy = jest.spyOn(svc, 'sendSms').mockResolvedValue(undefined);

    await svc.sendSmsFromTemplate({
      to: '600000000',
      templateId: 7,
      courseName: 'Excel Avanzado',
      courseStart: '01/09/2026',
    });

    expect(sendSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        to: '600000000',
        message: 'Tu curso Excel Avanzado empieza el 01/09/2026',
        templateId: 7,
        templateName: 'Recordatorio',
      }),
    );
  });
});
