import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsDateString, IsOptional } from 'class-validator';

export class UpdateUserCenterDTO {
  @ApiProperty()
  @IsInt()
  @IsOptional()
  id_user?: number;

  @ApiProperty()
  @IsInt()
  @IsOptional()
  id_center?: number;

  @ApiProperty()
  @IsDateString()
  @IsOptional()
  start_date?: Date;

  @ApiProperty()
  @IsDateString()
  @IsOptional()
  end_date?: Date;
}
