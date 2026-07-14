import { ValidationPipe, BadRequestException } from '@nestjs/common';
import { UpdateOrganizationSettingsDTO } from './update-organization.dto';

/**
 * Valida el comportamiento del DTO bajo el mismo ValidationPipe global de
 * main.ts (whitelist + transform): claves con typo se eliminan y los campos
 * obligatorios de company se rechazan si faltan.
 */
const pipe = new ValidationPipe({ whitelist: true, transform: true });
const metadata = { type: 'body' as const, metatype: UpdateOrganizationSettingsDTO };

const validCompany = {
  cif: 'B12345678',
  razon_social: 'Academia SL',
  direccion: 'C/ Mayor 1',
  responsable_nombre: 'Ana Pérez',
  responsable_dni: '12345678Z',
};

describe('UpdateOrganizationSettingsDTO (ValidationPipe)', () => {
  it('acepta un payload válido y elimina claves desconocidas (typos)', async () => {
    const result = await pipe.transform({
      settings: {
        site_name: 'Academia',
        company: validCompany,
        moodle: { url: 'https://moodle.test', customfieldz: 'typo' },
        una_clave_con_typo: { x: 1 },
      },
    }, metadata) as UpdateOrganizationSettingsDTO;

    expect(result.settings?.site_name).toBe('Academia');
    expect((result.settings as unknown as Record<string, unknown>)['una_clave_con_typo']).toBeUndefined();
    expect((result.settings?.moodle as unknown as Record<string, unknown>)['customfieldz']).toBeUndefined();
  });

  it('rechaza settings sin company', async () => {
    await expect(pipe.transform({ settings: { site_name: 'X' } }, metadata))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it('rechaza company con obligatorios vacíos', async () => {
    await expect(pipe.transform({
      settings: { company: { ...validCompany, cif: '   ' } },
    }, metadata)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rechaza un email de contacto inválido pero acepta el vacío', async () => {
    await expect(pipe.transform({
      settings: { company: validCompany, contact: { email: 'no-es-email' } },
    }, metadata)).rejects.toBeInstanceOf(BadRequestException);

    const ok = await pipe.transform({
      settings: { company: validCompany, contact: { email: '' } },
    }, metadata) as UpdateOrganizationSettingsDTO;
    expect(ok.settings?.contact?.email).toBe('');
  });

  it('valida file_transfer: tipo y puerto', async () => {
    await expect(pipe.transform({
      settings: { company: validCompany, file_transfer: { type: 'ssh' } },
    }, metadata)).rejects.toBeInstanceOf(BadRequestException);

    const ok = await pipe.transform({
      settings: { company: validCompany, file_transfer: { type: 'sftp', port: 22, password: 'x' } },
    }, metadata) as UpdateOrganizationSettingsDTO;
    expect(ok.settings?.file_transfer?.port).toBe(22);
    expect(ok.settings?.file_transfer?.password).toBe('x');
  });

  it('permite payload solo de secretos (sin settings)', async () => {
    const ok = await pipe.transform({
      encrypted_secrets: { moodle_token_plain: 'tok' },
    }, metadata) as UpdateOrganizationSettingsDTO;
    expect(ok.encrypted_secrets?.moodle_token_plain).toBe('tok');
    expect(ok.settings).toBeUndefined();
  });
});
