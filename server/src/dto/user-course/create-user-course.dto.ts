import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsDecimal, IsNotEmpty, IsEnum, IsOptional, IsIn, IsDate } from 'class-validator';
// import { EnrollmentStatus } from 'src/types/user-course/enrollment-status.enum';

export class CreateUserCourseDTO {
  @ApiProperty()
  @IsInt()
  @IsNotEmpty()
  id_user: number;

  @ApiProperty()
  @IsInt()
  @IsNotEmpty()
  id_course: number;

  @ApiPropertyOptional()
  @IsInt()
  @IsOptional()
  id_moodle_user?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  enrollment_date: Date;

  // @ApiPropertyOptional()
  // @IsOptional()
  // @IsIn(Object.values(EnrollmentStatus))
  // status: EnrollmentStatus;

  @ApiPropertyOptional()
  @IsDecimal()
  @IsOptional()
  completion_percentage: string; //TODO: Cambiar a decimal

  @ApiPropertyOptional()
  @IsInt()
  @IsOptional()
  time_spent: number;
}
