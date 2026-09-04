import { PartialType } from "@nestjs/swagger";
import { CreateCatalogCourseDto } from "./create-catalog-course.dto";

export class UpdateCatalogCourseDto extends PartialType(CreateCatalogCourseDto) {}
