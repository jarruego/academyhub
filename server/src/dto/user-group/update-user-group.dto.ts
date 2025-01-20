import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsDateString, IsDecimal, IsOptional } from 'class-validator';

export class UpdateUserGroupDTO {
  @ApiProperty()
  @IsInt()
  @IsOptional()
  id_user?: number;

  @ApiProperty()
  @IsInt()
  @IsOptional()
  id_group?: number;

  @ApiProperty()
  @IsDateString()
  @IsOptional()
  join_date?: Date;

  @ApiProperty()
  @IsDecimal()
  @IsOptional()
  completion_percentage?: number;

  @ApiProperty()
  @IsInt()
  @IsOptional()
  time_spent?: number;

  @ApiProperty()
  @IsDateString()
  @IsOptional()
  last_access?: Date;
}
