import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsDateString, IsDecimal, IsOptional, IsNotEmpty } from 'class-validator';

export class UpdateUserGroupDTO {
  @ApiProperty()
  @IsInt()
  @IsNotEmpty()
  id_user: number;

  @ApiProperty()
  @IsInt()
  @IsNotEmpty()
  id_group: number;

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
}
