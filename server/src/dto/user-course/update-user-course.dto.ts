import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsDateString, IsDecimal, IsOptional, IsIn } from 'class-validator';
import { EnrollmentStatus } from 'src/types/course/enrollment-status.enum';

export class UpdateUserCourseDTO {
  @ApiProperty()
  @IsInt()
  @IsOptional()
  id_user?: number;

  @ApiProperty()
  @IsInt()
  @IsOptional()
  id_course?: number;

  @ApiProperty()
  @IsDateString()
  @IsOptional()
  enrollment_date?: Date;

  @ApiProperty()
  @IsOptional()
  @IsIn(Object.values(EnrollmentStatus))
  status?: EnrollmentStatus;

  @ApiProperty()
  @IsDecimal()
  @IsOptional()
  completion_percentage?: number;

  @ApiProperty()
  @IsInt()
  @IsOptional()
  time_spent?: number;
}
