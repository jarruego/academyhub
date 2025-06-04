import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsDate } from 'class-validator';

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
  @IsNotEmpty()
  @IsDate()
  @Type(() => Date)
  start_date: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  end_date: Date;

  @ApiPropertyOptional()
  @IsOptional()
  is_main_center?: boolean = false;
}
