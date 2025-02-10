import { ApiProperty } from '@nestjs/swagger';
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

  @ApiProperty()
  @IsInt()
  @IsOptional()
  id_center?: number;

  @ApiProperty()
  @IsDateString()
  @IsOptional()
  join_date?: Date;

  @ApiProperty()
  @IsDecimal()
  @IsOptional()
  completion_percentage?: string; //TODO: Change to number

  @ApiProperty()
  @IsInt()
  @IsOptional()
  time_spent?: number;

  @ApiProperty()
  @IsDateString()
  @IsOptional()
  last_access?: Date;
}
