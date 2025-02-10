import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsDecimal, IsOptional, IsIn, IsDate } from 'class-validator';
// import { EnrollmentStatus } from 'src/types/user-course/enrollment-status.enum';

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
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  enrollment_date?: Date;

  // @ApiProperty()
  // @IsOptional()
  // @IsIn(Object.values(EnrollmentStatus))
  // status?: EnrollmentStatus;

  @ApiProperty()
  @IsDecimal()
  @IsOptional()
  completion_percentage?: string; //TODO: Cambiar a decimal

  @ApiProperty()
  @IsInt()
  @IsOptional()
  time_spent?: number;
}
