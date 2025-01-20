import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsDateString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateUserCenterDTO {
  @ApiProperty()
  @IsInt()
  @IsNotEmpty()
  id_user: number;

  @ApiProperty()
  @IsInt()
  @IsNotEmpty()
  id_center: number;

  @ApiProperty()
  @IsDateString()
  @IsNotEmpty()
  start_date: string;

  @ApiProperty()
  @IsDateString()
  @IsOptional()
  end_date: string;
}
