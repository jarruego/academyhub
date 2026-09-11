import { IsString, IsOptional, IsInt } from 'class-validator';

export class SmsPreviewLengthDto {
  // Exactamente uno de los dos: templateId (plantilla guardada) o message
  // (texto editado ad-hoc, aún sin guardar como plantilla).
  @IsOptional()
  @IsInt()
  templateId?: number;

  @IsOptional()
  @IsString()
  message?: string;

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
