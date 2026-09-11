import { IsString, IsOptional, IsNotEmpty } from 'class-validator';

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
}
