import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateMoodleUserDTO {
  @ApiProperty()
  @IsInt()
  @IsNotEmpty()
  id_user: number;

  @ApiProperty()
  @IsInt()
  @IsNotEmpty()
  moodle_id: number;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  moodle_username: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  moodle_password?: string;
}