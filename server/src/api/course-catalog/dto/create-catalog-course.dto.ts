import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsBoolean, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Min } from "class-validator";
import { CourseModality } from "src/types/course/course-modality.enum";

export class CreateCatalogCourseDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  internal_code?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  objectives?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  base_contents?: string;

  @ApiPropertyOptional({ description: 'Contenidos HTML de la formación (compartidos por todas las ediciones)', type: String })
  @IsOptional()
  @IsString()
  contents?: string;

  @ApiPropertyOptional({ enum: CourseModality })
  @IsOptional()
  @IsEnum(CourseModality)
  default_modality?: CourseModality;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  default_hours?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sepe_specialty_code?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sepe_specialty_name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  professional_family?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  professional_area?: string;

  @ApiPropertyOptional({ description: 'Oculta el curso de los selects de filtro/búsqueda (peticiones, interesados). No afecta a los listados ni a la asignación de curso al crear una edición.' })
  @IsOptional()
  @IsBoolean()
  hidden_from_filters?: boolean;
}
