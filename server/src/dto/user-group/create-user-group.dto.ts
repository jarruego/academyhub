import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsDateString, IsDecimal, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateUserGroupDTO {
  @ApiProperty()
  @IsInt()
  @IsNotEmpty()
  id_user: number;

  @IsInt()
  @IsNotEmpty()
  id_group: number;

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