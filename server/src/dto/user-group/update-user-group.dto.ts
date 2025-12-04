import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsDateString, IsDecimal, IsOptional } from 'class-validator';

export class UpdateUserGroupDTO {
  @ApiPropertyOptional()
  @IsInt()
  @IsOptional()
  id_user?: number;

  @ApiPropertyOptional()
  @IsInt()
  @IsOptional()
  id_group?: number;

  @ApiPropertyOptional()
  @IsInt()
  @IsOptional()
  id_role?: number;

  @ApiPropertyOptional()
  @IsInt()
  @IsOptional()
  id_center?: number;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  join_date?: Date;

  @ApiPropertyOptional()
  @IsDecimal()
  @IsOptional()
  completion_percentage?: string; //TODO: Change to number

  @ApiPropertyOptional()
  @IsInt()
  @IsOptional()
  time_spent?: number;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  last_access?: Date;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  moodle_synced_at?: Date;
}
