import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsDateString } from 'class-validator';

export class CreateUserGroupDTO {
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
  id_center: number;

  @ApiPropertyOptional()
  @IsOptional()
  join_date: string;

  @ApiPropertyOptional()
  @IsOptional()
  completion_percentage: string; //TODO: Change to number

  @ApiPropertyOptional()
  @IsInt()
  @IsOptional()
  time_spent: number;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  last_access: Date;
}