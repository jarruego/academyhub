import { IsString, IsOptional, IsInt, IsArray, ArrayMinSize } from 'class-validator';

export class SmsPreviewBatchDto {
  // Exactamente uno de los dos: templateId (plantilla guardada) o message
  // (texto editado ad-hoc, aún sin guardar como plantilla).
  @IsOptional()
  @IsInt()
  templateId?: number;

  @IsOptional()
  @IsString()
  message?: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  userIds: number[];

  @IsOptional()
  @IsString()
  courseName?: string;

  @IsOptional()
  @IsString()
  courseShortName?: string;

  @IsOptional()
  @IsString()
  courseStart?: string;

  @IsOptional()
  @IsString()
  courseEnd?: string;
}
