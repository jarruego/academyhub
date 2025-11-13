import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, IsDateString } from 'class-validator';
import { MoodleCourse } from "src/types/moodle/course";
import { MoodleGroup } from "src/types/moodle/group";

export class MoodleCourseWithImportStatus {
  @ApiProperty({ description: 'ID del curso en Moodle', example: 123 })
  @IsInt()
  id: number;

  @ApiProperty({ description: 'Nombre completo del curso', example: 'Curso de JavaScript Avanzado' })
  @IsString()
  fullname: string;

  @ApiProperty({ description: 'Nombre corto del curso', example: 'JS-ADV-2024' })
  @IsString()
  shortname: string;

  @ApiProperty({ description: 'Fecha de inicio del curso (timestamp)', example: 1672531200 })
  @IsInt()
  startdate: number;

  @ApiPropertyOptional({ description: 'Fecha de fin del curso (timestamp)', example: 1680307200 })
  @IsOptional()
  @IsInt()
  enddate?: number;

  @ApiProperty({ description: 'Indica si el curso ya está importado en la base de datos local', example: true })
  @IsBoolean()
  isImported: boolean;

  @ApiPropertyOptional({ description: 'Fecha de la última importación', example: '2024-01-15T10:30:00Z' })
  @IsOptional()
  @IsDateString()
  lastImportDate?: Date;

  @ApiPropertyOptional({ description: 'ID del curso en la base de datos local', example: 456 })
  @IsOptional()
  @IsInt()
  localCourseId?: number;
}

export class MoodleGroupWithImportStatus {
  @ApiProperty({ description: 'ID del grupo en Moodle', example: 789 })
  @IsInt()
  id: number;

  @ApiProperty({ description: 'Nombre del grupo', example: 'Grupo A - Mañana' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'Descripción del grupo', example: 'Grupo de estudiantes del turno matutino' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'ID del curso al que pertenece el grupo', example: 123 })
  @IsInt()
  courseid: number;

  @ApiProperty({ description: 'Indica si el grupo ya está importado en la base de datos local', example: false })
  @IsBoolean()
  isImported: boolean;

  @ApiPropertyOptional({ description: 'Fecha de la última importación', example: '2024-01-15T10:30:00Z' })
  @IsOptional()
  @IsDateString()
  lastImportDate?: Date;

  @ApiPropertyOptional({ description: 'ID del grupo en la base de datos local', example: 321 })
  @IsOptional()
  @IsInt()
  localGroupId?: number;
}

export class MoodleCourseListResponse {
  @ApiProperty({ 
    description: 'Lista de cursos de Moodle con estado de importación',
    type: [MoodleCourseWithImportStatus]
  })
  courses: MoodleCourseWithImportStatus[];
}

export class MoodleGroupListResponse {
  @ApiProperty({ 
    description: 'Lista de grupos de Moodle con estado de importación',
    type: [MoodleGroupWithImportStatus]
  })
  groups: MoodleGroupWithImportStatus[];
}

export class ImportResult {
  @ApiProperty({ description: 'Indica si la importación fue exitosa', example: true })
  @IsBoolean()
  success: boolean;

  @ApiProperty({ description: 'Mensaje descriptivo del resultado', example: 'Curso "JavaScript Avanzado" importado correctamente' })
  @IsString()
  message: string;

  @ApiPropertyOptional({ 
    description: 'Datos adicionales sobre la importación realizada',
    example: { courseId: 456, usersImported: 25 }
  })
  @IsOptional()
  importedData?: {
    courseId?: number;
    groupId?: number;
    usersImported?: number;
  };

  @ApiPropertyOptional({ description: 'Detalles por usuario procesado en operaciones por lote' })
  @IsOptional()
  details?: Array<{
    userId?: number;
    username?: string;
    error: string;
  }>;

  @ApiPropertyOptional({ description: 'Mensaje de error en caso de fallo', example: 'No se pudo conectar con Moodle' })
  @IsOptional()
  @IsString()
  error?: string;
}