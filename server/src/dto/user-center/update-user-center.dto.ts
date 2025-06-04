import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsDateString, IsOptional } from 'class-validator';

export class UpdateUserCenterDTO {
  @ApiPropertyOptional()
  @IsInt()
  @IsOptional()
  id_user?: number;

  @ApiPropertyOptional()
  @IsInt()
  @IsOptional()
  id_center?: number;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  start_date?: Date;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  end_date?: Date;

  @ApiPropertyOptional()
  @IsOptional()
  is_main_center?: boolean;
}
