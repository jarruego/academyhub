import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsDecimal, IsOptional, IsIn, IsDate } from 'class-validator';
// import { EnrollmentStatus } from 'src/types/user-course/enrollment-status.enum';

export class UpdateUserCourseDTO {
  @ApiPropertyOptional()
  @IsInt()
  @IsOptional()
  id_user?: number;

  @ApiPropertyOptional()
  @IsInt()
  @IsOptional()
  id_course?: number;

  @ApiPropertyOptional()
  @IsInt()
  @IsOptional()
  id_moodle_user?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  enrollment_date?: Date;

  // @ApiPropertyOptional()
  // @IsOptional()
  // @IsIn(Object.values(EnrollmentStatus))
  // status?: EnrollmentStatus;

  @ApiPropertyOptional()
  @IsDecimal()
  @IsOptional()
  completion_percentage?: string; //TODO: Cambiar a decimal

  @ApiPropertyOptional()
  @IsInt()
  @IsOptional()
  time_spent?: number;
}
