import { IsString, IsOptional, IsNotEmpty, IsBoolean, IsInt } from 'class-validator';

export class SendSmsDto {
  // Teléfono destino (se normaliza a E.164 en el servicio antes de llamar a Mailrelay).
  @IsString()
  @IsNotEmpty()
  to!: string;

  @IsString()
  @IsNotEmpty()
  message!: string;

  // Si no llega, se usa el sender_name por defecto configurado en sms_settings.
  @IsOptional()
  @IsString()
  senderName?: string;

  // Sustituye variables tipo {NOMBRE_CURSO} en `message` antes de enviar
  // (mensaje personalizado/editado del envío a grupo).
  @IsOptional()
  @IsBoolean()
  applyVariables?: boolean;

  @IsOptional()
  @IsInt()
  userId?: number;

  @IsOptional()
  @IsString()
  courseName?: string;

  @IsOptional()
  @IsString()
  courseStart?: string;

  @IsOptional()
  @IsString()
  courseEnd?: string;
}
