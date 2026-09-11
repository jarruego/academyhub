import { IsString, IsOptional, MaxLength } from 'class-validator';

export class SmsSettingsDto {
  // Subdominio de la cuenta Mailrelay, sin protocolo (ej. "mecohisa1.ipzmarketing.com").
  @IsString()
  account_url!: string;

  // Opcional: si llega vacía/ausente al guardar o probar, se usa la ya
  // almacenada (el cliente nunca recibe la api_key real, solo enmascarada).
  @IsOptional()
  @IsString()
  api_key?: string;

  @IsString()
  @MaxLength(20)
  sender_name!: string;
}
