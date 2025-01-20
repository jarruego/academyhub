import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsDateString, IsDecimal, IsNotEmpty, IsEnum, IsOptional, IsIn } from 'class-validator';
import { EnrollmentStatus } from 'src/types/course/enrollment-status.enum';

export class CreateUserCourseDTO {
  @ApiProperty()
  @IsInt()
  @IsNotEmpty()
  id_user: number;

  @ApiProperty()
  @IsInt()
  @IsNotEmpty()
  id_course: number;

  @ApiProperty()
  @IsDateString()
  @IsOptional()
  enrollment_date: string;

  @ApiProperty()
  @IsOptional()
  @IsIn(Object.values(EnrollmentStatus))
  status: EnrollmentStatus;

  @ApiProperty()
  @IsDecimal()
  @IsOptional()
  completion_percentage: number;

  @ApiProperty()
  @IsInt()
  @IsOptional()
  time_spent: number;
}
