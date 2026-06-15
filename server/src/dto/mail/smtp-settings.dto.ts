import { IsString, IsInt, IsBoolean, IsOptional, IsEmail } from 'class-validator';

export class SmtpSettingsDto {
  @IsString()
  host!: string;

  @IsInt()
  port!: number;

  @IsString()
  user!: string;

  // Opcional: si llega vacío/ausente al guardar o probar, se usa la contraseña
  // ya almacenada (el cliente nunca recibe la contraseña real, solo enmascarada).
  @IsOptional()
  @IsString()
  password?: string;

  @IsBoolean()
  secure!: boolean;

  @IsEmail()
  from_email!: string;

  @IsOptional()
  @IsString()
  from_name?: string;
}
