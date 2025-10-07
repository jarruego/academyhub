import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString } from 'class-validator';

export class FilterMoodleUserDTO {
  @ApiPropertyOptional()
  @IsInt()
  @IsOptional()
  @Type(() => Number)
  id_moodle_user?: number;

  @ApiPropertyOptional()
  @IsInt()
  @IsOptional()
  @Type(() => Number)
  id_user?: number;

  @ApiPropertyOptional()
  @IsInt()
  @IsOptional()
  @Type(() => Number)
  moodle_id?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  moodle_username?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  moodle_password?: string;
}