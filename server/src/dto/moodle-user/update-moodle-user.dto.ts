import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString } from 'class-validator';

export class UpdateMoodleUserDTO {
  @ApiPropertyOptional()
  @IsInt()
  @IsOptional()
  id_user?: number;

  @ApiPropertyOptional()
  @IsInt()
  @IsOptional()
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