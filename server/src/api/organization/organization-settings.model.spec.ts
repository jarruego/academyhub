import {
  buildIssuerLine,
  normalizeOrganizationSettings,
  readLegacyFileTransferPassword,
  readOrgSecret,
  DEFAULT_ORGANIZATION_SETTINGS,
  ORG_SECRET_KEYS,
} from './organization-settings.model';
import { tryEncryptSecret } from 'src/utils/crypto/secrets.util';

const TEST_KEY = Buffer.alloc(32, 7).toString('base64');

describe('normalizeOrganizationSettings', () => {
  it('devuelve defaults con entrada vacía o inválida', () => {
    expect(normalizeOrganizationSettings(undefined)).toEqual(DEFAULT_ORGANIZATION_SETTINGS);
    expect(normalizeOrganizationSettings(null)).toEqual(DEFAULT_ORGANIZATION_SETTINGS);
    expect(normalizeOrganizationSettings('not-an-object')).toEqual(DEFAULT_ORGANIZATION_SETTINGS);
    expect(normalizeOrganizationSettings([])).toEqual(DEFAULT_ORGANIZATION_SETTINGS);
  });

  it('rellena campo a campo lo que falte, conservando lo presente', () => {
    const result = normalizeOrganizationSettings({
      site_name: 'Mi Academia',
      company: { cif: 'B12345678' },
    });
    expect(result.site_name).toBe('Mi Academia');
    expect(result.company.cif).toBe('B12345678');
    expect(result.company.razon_social).toBe('');
    expect(result.plugins.itop_training).toBe(false);
    expect(result.file_transfer.type).toBe('ftp');
    expect(result.file_transfer.port).toBe(21);
  });

  it('absorbe las formas legacy moodle_url / moodleUrl / moodle_customfields', () => {
    expect(normalizeOrganizationSettings({ moodle_url: 'https://legacy1.test' }).moodle.url).toBe('https://legacy1.test');
    expect(normalizeOrganizationSettings({ moodleUrl: 'https://legacy2.test' }).moodle.url).toBe('https://legacy2.test');
    const withFields = normalizeOrganizationSettings({
      moodle_customfields: [{ shortname: 'DNI', source: 'dni' }],
    });
    expect(withFields.moodle.customfields).toEqual([{ shortname: 'DNI', source: 'dni' }]);
    // La forma canónica gana sobre la legacy
    const both = normalizeOrganizationSettings({
      moodle: { url: 'https://canonica.test' },
      moodle_url: 'https://legacy.test',
    });
    expect(both.moodle.url).toBe('https://canonica.test');
  });

  it('filtra customfields incompletos y recorta espacios', () => {
    const result = normalizeOrganizationSettings({
      moodle: {
        customfields: [
          { shortname: ' DNI ', source: ' dni ' },
          { shortname: 'sinSource' },
          'no-objeto',
          { shortname: '', source: 'x' },
        ],
      },
    });
    expect(result.moodle.customfields).toEqual([{ shortname: 'DNI', source: 'dni' }]);
  });

  it('coerciona el puerto y aplica el default según el tipo', () => {
    expect(normalizeOrganizationSettings({ file_transfer: { port: '2222' } }).file_transfer.port).toBe(2222);
    expect(normalizeOrganizationSettings({ file_transfer: { type: 'sftp' } }).file_transfer.port).toBe(22);
    expect(normalizeOrganizationSettings({ file_transfer: { type: 'ftp', port: 'abc' } }).file_transfer.port).toBe(21);
    expect(normalizeOrganizationSettings({ file_transfer: { type: 'desconocido' } }).file_transfer.type).toBe('ftp');
  });

  it('no incluye la contraseña en el modelo normalizado', () => {
    const result = normalizeOrganizationSettings({
      file_transfer: { host: 'h', user: 'u', password: 'superSecreta', path: '/f' },
    });
    expect(JSON.stringify(result)).not.toContain('superSecreta');
  });
});

describe('readLegacyFileTransferPassword', () => {
  it('lee file_transfer.password y sftp.password', () => {
    expect(readLegacyFileTransferPassword({ file_transfer: { password: 'p1' } })).toBe('p1');
    expect(readLegacyFileTransferPassword({ sftp: { password: 'p2' } })).toBe('p2');
  });
  it('devuelve undefined si no hay contraseña', () => {
    expect(readLegacyFileTransferPassword({ file_transfer: { password: '' } })).toBeUndefined();
    expect(readLegacyFileTransferPassword({})).toBeUndefined();
    expect(readLegacyFileTransferPassword(undefined)).toBeUndefined();
  });
});

describe('readOrgSecret', () => {
  let prevKey: string | undefined;
  beforeAll(() => {
    prevKey = process.env.APP_MASTER_KEY;
    process.env.APP_MASTER_KEY = TEST_KEY;
  });
  afterAll(() => {
    if (prevKey === undefined) delete process.env.APP_MASTER_KEY;
    else process.env.APP_MASTER_KEY = prevKey;
  });

  it('descifra un secreto cifrado', () => {
    const enc = tryEncryptSecret('miClave');
    expect(readOrgSecret({ [ORG_SECRET_KEYS.fileTransferPassword]: enc }, ORG_SECRET_KEYS.fileTransferPassword)).toBe('miClave');
  });

  it('acepta un string en claro legacy', () => {
    expect(readOrgSecret({ x: 'plano' }, 'x')).toBe('plano');
  });

  it('devuelve undefined si falta o no se puede descifrar', () => {
    expect(readOrgSecret({}, 'x')).toBeUndefined();
    expect(readOrgSecret(undefined, 'x')).toBeUndefined();
    expect(readOrgSecret({ x: { ct: 'AAA', iv: 'AAA', tag: 'AAA' } }, 'x')).toBeUndefined();
  });
});

describe('buildIssuerLine', () => {
  it('construye la línea del emisor con los datos fiscales', () => {
    const line = buildIssuerLine({
      cif: 'B12345678',
      razon_social: 'Academia SL',
      direccion: 'Calle Mayor 1',
      ciudad: 'Zaragoza',
      responsable_nombre: 'Ana Pérez',
      responsable_dni: '12345678Z',
    });
    expect(line).toBe('D. Ana Pérez, administrador de Academia SL, con CIF B12345678 y domicilio en Calle Mayor 1.');
  });

  it("devuelve '' cuando no hay datos", () => {
    expect(buildIssuerLine({ ...DEFAULT_ORGANIZATION_SETTINGS.company })).toBe('');
  });
});
