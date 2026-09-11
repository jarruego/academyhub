import { IsString, IsOptional, IsInt, IsNotEmpty } from 'class-validator';

export class SendSmsFromTemplateDto {
  @IsOptional()
  @IsInt()
  userId?: number;

  @IsInt()
  templateId!: number;

  @IsOptional()
  @IsString()
  courseName?: string;

  @IsOptional()
  @IsString()
  courseStart?: string;

  @IsOptional()
  @IsString()
  courseEnd?: string;

  @IsString()
  @IsNotEmpty()
  toPhone!: string;

  // Si no llega, se usa el sender_name por defecto configurado en sms_settings.
  @IsOptional()
  @IsString()
  senderName?: string;
}
