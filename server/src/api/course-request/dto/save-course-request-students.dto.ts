import { Type } from "class-transformer";
import { IsArray, ValidateNested } from "class-validator";
import { CourseRequestStudentDto } from "./course-request-student.dto";

export class SaveCourseRequestStudentsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CourseRequestStudentDto)
  students: CourseRequestStudentDto[];
}
