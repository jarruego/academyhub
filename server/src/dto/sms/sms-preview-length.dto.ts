import { IsString, IsOptional, IsInt } from 'class-validator';

export class SmsPreviewLengthDto {
  @IsInt()
  templateId!: number;

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
