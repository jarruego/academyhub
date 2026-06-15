import { BadRequestException } from '@nestjs/common';
import { SmtpSettingsService } from './smtp-settings.service';
import { SmtpSettingsRepository } from '../../database/repository/mail/smtp-settings.repository';
import { encryptSecretToString, decryptSecretFromString } from '../../utils/crypto/secrets.util';
import type { SmtpSettings } from '../../database/schema/tables/smtp_settings.table';

const TEST_KEY = Buffer.alloc(32, 7).toString('base64');

const baseRow = (password: string): SmtpSettings => ({
  id: 1,
  host: 'smtp.test',
  port: 465,
  user: 'user@test',
  password,
  secure: true,
  from_email: 'from@test',
  from_name: 'Test',
} as SmtpSettings);

describe('SmtpSettingsService (cifrado SMTP)', () => {
  let service: SmtpSettingsService;
  let getSpy: jest.SpiedFunction<SmtpSettingsRepository['getSettings']>;
  let saveSpy: jest.SpiedFunction<SmtpSettingsRepository['saveSettings']>;
  let prevKey: string | undefined;

  beforeAll(() => {
    prevKey = process.env.APP_MASTER_KEY;
    process.env.APP_MASTER_KEY = TEST_KEY;
  });
  afterAll(() => {
    if (prevKey === undefined) delete process.env.APP_MASTER_KEY;
    else process.env.APP_MASTER_KEY = prevKey;
  });

  beforeEach(() => {
    // El servicio crea internamente un SmtpSettingsRepository; espiamos su prototipo.
    getSpy = jest.spyOn(SmtpSettingsRepository.prototype, 'getSettings');
    // saveSettings devuelve la fila persistida (eco del argumento recibido).
    saveSpy = jest
      .spyOn(SmtpSettingsRepository.prototype, 'saveSettings')
      .mockImplementation(async (data) => ({ id: 1, ...data } as SmtpSettings));
    service = new SmtpSettingsService({ db: {} } as any);
  });

  afterEach(() => jest.restoreAllMocks());

  describe('saveSettings', () => {
    it('cifra una contraseña nueva antes de persistir y la devuelve descifrada', async () => {
      getSpy.mockResolvedValue(null);

      const result = await service.saveSettings({
        host: 'smtp.test', port: 465, user: 'u', password: 'nuevaClave', secure: true, from_email: 'a@b.c',
      } as any);

      const persisted = saveSpy.mock.calls[0][0];
      expect(persisted.password).not.toBe('nuevaClave'); // se guarda cifrada
      expect(decryptSecretFromString(persisted.password)).toBe('nuevaClave');
      expect(result.password).toBe('nuevaClave'); // se devuelve descifrada
    });

    it('preserva la contraseña existente si llega vacía (no la pierde ni la re-cifra)', async () => {
      const storedBlob = encryptSecretToString('claveGuardada') as string;
      getSpy.mockResolvedValue(baseRow(storedBlob));

      const result = await service.saveSettings({
        host: 'smtp.test', port: 587, user: 'u', password: '', secure: false, from_email: 'a@b.c',
      } as any);

      const persisted = saveSpy.mock.calls[0][0];
      expect(persisted.password).toBe(storedBlob); // se reutiliza el blob tal cual
      expect(persisted.port).toBe(587); // los demás campos sí se actualizan
      expect(result.password).toBe('claveGuardada');
    });

    it('rechaza guardar sin contraseña cuando no hay ninguna almacenada', async () => {
      getSpy.mockResolvedValue(null);

      await expect(
        service.saveSettings({
          host: 'smtp.test', port: 465, user: 'u', password: '', secure: true, from_email: 'a@b.c',
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(saveSpy).not.toHaveBeenCalled();
    });
  });

  describe('getSettings', () => {
    it('descifra la contraseña almacenada', async () => {
      getSpy.mockResolvedValue(baseRow(encryptSecretToString('secreta') as string));
      const result = await service.getSettings();
      expect(result?.password).toBe('secreta');
    });

    it('es retro-compatible con contraseñas en claro legacy', async () => {
      getSpy.mockResolvedValue(baseRow('claroLegacy'));
      const result = await service.getSettings();
      expect(result?.password).toBe('claroLegacy');
    });

    it('devuelve null cuando no hay configuración', async () => {
      getSpy.mockResolvedValue(null);
      expect(await service.getSettings()).toBeNull();
    });
  });
});
