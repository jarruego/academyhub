import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsString } from 'class-validator';

export class CreateUserCourseRoleDTO {
  @ApiProperty()
  @IsInt()
  @IsNotEmpty()
  id_user: number;

  @ApiProperty()
  @IsInt()
  @IsNotEmpty()
  id_course: number;

  @ApiProperty()
  @IsInt()
  @IsNotEmpty()
  id_role: number;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  role_shortname: string;
}