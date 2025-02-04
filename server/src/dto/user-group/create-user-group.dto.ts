import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsDateString, IsDecimal } from 'class-validator';

export class CreateUserGroupDTO {
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
  id_center: number;

  @IsDateString()
  @IsOptional()
  join_date: string;

  @IsDecimal()
  @IsOptional()
  completion_percentage: number;

  @IsInt()
  @IsOptional()
  time_spent: number;

  @IsDateString()
  @IsOptional()
  last_access: Date;
}