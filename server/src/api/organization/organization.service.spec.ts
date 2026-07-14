import { OrganizationService } from './organization.service';
import { ORG_SECRET_KEYS } from './organization-settings.model';
import { decryptSecret } from 'src/utils/crypto/secrets.util';
import type { OrganizationSettingsSelectModel } from 'src/database/schema/tables/organization_settings.table';

const TEST_KEY = Buffer.alloc(32, 7).toString('base64');

const baseRow = (overrides: Partial<OrganizationSettingsSelectModel> = {}): OrganizationSettingsSelectModel => ({
  id: 1,
  center_id: 5,
  settings: {},
  logo_path: null,
  signature_path: null,
  encrypted_secrets: null,
  version: 1,
  created_at: new Date('2026-01-01T00:00:00Z'),
  updated_at: new Date('2026-01-01T00:00:00Z'),
  ...overrides,
});

describe('OrganizationService', () => {
  let prevKey: string | undefined;
  let repo: {
    findFirst: jest.Mock;
    findByCenterId: jest.Mock;
    upsertForCenter: jest.Mock;
    setAssetPathById: jest.Mock;
  };
  let service: OrganizationService;

  beforeAll(() => {
    prevKey = process.env.APP_MASTER_KEY;
    process.env.APP_MASTER_KEY = TEST_KEY;
  });
  afterAll(() => {
    if (prevKey === undefined) delete process.env.APP_MASTER_KEY;
    else process.env.APP_MASTER_KEY = prevKey;
  });

  beforeEach(() => {
    repo = {
      findFirst: jest.fn(),
      findByCenterId: jest.fn(),
      upsertForCenter: jest.fn().mockResolvedValue({ id: 1 }),
      setAssetPathById: jest.fn(),
    };
    // La transacción solo delega en el callback; el select de centros no se
    // usa cuando ya existe una fila.
    const db = {
      transaction: async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({ select: () => ({ from: () => ({ limit: async () => [] }) }) }),
    };
    service = new OrganizationService(repo as any, { db } as any);
  });

  describe('getSettings', () => {
    it('devuelve settings normalizados sin exponer contraseñas legacy', async () => {
      repo.findFirst.mockResolvedValue(baseRow({
        settings: {
          site_name: 'Academia',
          file_transfer: { host: 'ftp.test', user: 'u', password: 'enClaroLegacy', path: '/f' },
        },
      }));

      const result = await service.getSettings();

      expect(result?.settings.site_name).toBe('Academia');
      expect(result?.settings.file_transfer.host).toBe('ftp.test');
      // La contraseña legacy no viaja en ninguna parte de la respuesta
      expect(JSON.stringify(result)).not.toContain('enClaroLegacy');
      // …pero el flag indica que existe
      expect(result?.secrets.has_file_transfer_password).toBe(true);
      expect(result?.secrets.has_moodle_token).toBe(false);
    });

    it('devuelve null cuando no hay fila', async () => {
      repo.findFirst.mockResolvedValue(null);
      expect(await service.getSettings()).toBeNull();
    });

    it('marca has_moodle_token cuando hay token en encrypted_secrets', async () => {
      repo.findFirst.mockResolvedValue(baseRow({
        encrypted_secrets: { moodle_token: { ct: 'x', iv: 'y', tag: 'z' } },
      }));
      const result = await service.getSettings();
      expect(result?.secrets.has_moodle_token).toBe(true);
    });
  });

  describe('upsertSettings', () => {
    const settingsPayload = {
      site_name: 'Academia',
      company: {
        cif: 'B12345678', razon_social: 'SL', direccion: 'C/ Mayor 1',
        responsable_nombre: 'Ana', responsable_dni: '12345678Z',
      },
    };

    it('extrae y cifra file_transfer.password; nunca la persiste en settings', async () => {
      repo.findFirst.mockResolvedValue(baseRow());
      repo.findByCenterId.mockResolvedValue(baseRow());

      await service.upsertSettings({
        settings: {
          ...settingsPayload,
          file_transfer: { type: 'ftp', host: 'h', user: 'u', password: 'nuevaClave', path: '/f' },
        },
      } as any);

      const persisted = repo.upsertForCenter.mock.calls[0][1];
      expect(JSON.stringify(persisted.settings)).not.toContain('nuevaClave');
      const secret = persisted.encrypted_secrets[ORG_SECRET_KEYS.fileTransferPassword];
      expect(decryptSecret(secret)).toBe('nuevaClave');
    });

    it('contraseña vacía = conserva el secreto existente (merge, no clobber)', async () => {
      const existingSecret = { ct: 'a', iv: 'b', tag: 'c' };
      repo.findFirst.mockResolvedValue(baseRow({
        encrypted_secrets: { [ORG_SECRET_KEYS.fileTransferPassword]: existingSecret },
      }));
      repo.findByCenterId.mockResolvedValue(baseRow());

      await service.upsertSettings({
        settings: {
          ...settingsPayload,
          file_transfer: { type: 'ftp', host: 'h', user: 'u', password: '', path: '/f' },
        },
      } as any);

      const persisted = repo.upsertForCenter.mock.calls[0][1];
      // No se tocan los secretos: o no se envían, o conservan el existente
      const sentSecrets = persisted.encrypted_secrets;
      if (sentSecrets !== undefined) {
        expect(sentSecrets[ORG_SECRET_KEYS.fileTransferPassword]).toEqual(existingSecret);
      }
    });

    it('guardar el token de Moodle no borra otros secretos (merge)', async () => {
      const ftpSecret = { ct: 'a', iv: 'b', tag: 'c' };
      repo.findFirst.mockResolvedValue(baseRow({
        encrypted_secrets: { [ORG_SECRET_KEYS.fileTransferPassword]: ftpSecret },
      }));
      repo.findByCenterId.mockResolvedValue(baseRow());

      await service.upsertSettings({ encrypted_secrets: { moodle_token_plain: 'tok123' } });

      const persisted = repo.upsertForCenter.mock.calls[0][1];
      expect(persisted.encrypted_secrets[ORG_SECRET_KEYS.fileTransferPassword]).toEqual(ftpSecret);
      expect(decryptSecret(persisted.encrypted_secrets[ORG_SECRET_KEYS.moodleToken])).toBe('tok123');
      // No se ha reenviado el plain
      expect(persisted.encrypted_secrets['moodle_token_plain']).toBeUndefined();
    });

    it('migra la contraseña legacy en claro a encrypted_secrets al guardar', async () => {
      repo.findFirst.mockResolvedValue(baseRow({
        settings: { file_transfer: { host: 'h', user: 'u', password: 'legacyClara', path: '/f' } },
      }));
      repo.findByCenterId.mockResolvedValue(baseRow());

      await service.upsertSettings({
        settings: {
          ...settingsPayload,
          file_transfer: { type: 'ftp', host: 'h', user: 'u', password: '', path: '/f' },
        },
      } as any);

      const persisted = repo.upsertForCenter.mock.calls[0][1];
      expect(JSON.stringify(persisted.settings)).not.toContain('legacyClara');
      expect(decryptSecret(persisted.encrypted_secrets[ORG_SECRET_KEYS.fileTransferPassword])).toBe('legacyClara');
    });
  });
});
