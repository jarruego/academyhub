import { SmtpSettingsController } from './smtp-settings.controller';
import type { SmtpSettings } from '../../database/schema/tables/smtp_settings.table';

const row = (password: string): SmtpSettings => ({
  id: 1, host: 'smtp.test', port: 465, user: 'u', password, secure: true, from_email: 'a@b.c', from_name: 'T',
} as SmtpSettings);

describe('SmtpSettingsController (enmascarado de contraseña)', () => {
  const makeController = (svc: Partial<{ getSettings: jest.Mock; saveSettings: jest.Mock }>) =>
    new SmtpSettingsController(svc as any);

  it('GET nunca devuelve la contraseña: la enmascara y expone hasPassword', async () => {
    const controller = makeController({ getSettings: jest.fn().mockResolvedValue(row('secretoReal')) });
    const result: any = await controller.getSettings();
    expect(result.password).toBe('');
    expect(result.hasPassword).toBe(true);
    expect(result.host).toBe('smtp.test'); // resto de campos intactos
  });

  it('GET con hasPassword=false cuando no hay contraseña', async () => {
    const controller = makeController({ getSettings: jest.fn().mockResolvedValue(row('')) });
    const result: any = await controller.getSettings();
    expect(result.password).toBe('');
    expect(result.hasPassword).toBe(false);
  });

  it('GET devuelve null cuando no hay configuración', async () => {
    const controller = makeController({ getSettings: jest.fn().mockResolvedValue(null) });
    expect(await controller.getSettings()).toBeNull();
  });

  it('POST también enmascara la respuesta de guardado', async () => {
    const controller = makeController({ saveSettings: jest.fn().mockResolvedValue(row('reciénGuardada')) });
    const result: any = await controller.saveSettings({} as any);
    expect(result.password).toBe('');
    expect(result.hasPassword).toBe(true);
  });
});
