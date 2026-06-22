import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsInt, IsOptional, ValidateNested } from 'class-validator';

/** Override del tema modelo a duplicar para un foro concreto. */
export class ForumModelSelection {
    @ApiProperty({ description: 'id de la instancia del foro' })
    @IsInt()
    forumId: number;

    @ApiProperty({ description: 'id del tema (discussion) que se usará como modelo' })
    @IsInt()
    discussionId: number;
}

/** Tutor elegido para un grupo (resuelve la ambigüedad en grupos multi-tutor). */
export class GroupTutorSelection {
    @ApiProperty({ description: 'id del grupo local' })
    @IsInt()
    id_group: number;

    @ApiProperty({ description: 'id_user del tutor elegido para publicar en ese grupo' })
    @IsInt()
    id_user: number;
}

/**
 * Entrada del preview/execute de Duplicado de Foros. El curso se identifica por
 * su id LOCAL; los foros por su id de Moodle; los grupos por su id LOCAL.
 */
export class DuplicateForumDto {
    @ApiProperty({ description: 'id LOCAL del curso' })
    @IsInt()
    courseId: number;

    @ApiProperty({ description: 'ids de las instancias de foro seleccionadas', type: [Number] })
    @IsArray()
    @ArrayNotEmpty()
    @IsInt({ each: true })
    forumIds: number[];

    @ApiProperty({ description: 'ids LOCALES de los grupos destino', type: [Number] })
    @IsArray()
    @ArrayNotEmpty()
    @IsInt({ each: true })
    groupIds: number[];

    @ApiPropertyOptional({ description: 'Tema modelo elegido por foro (si no se indica y el foro tiene 1 solo tema, se usa ese)', type: [ForumModelSelection] })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => ForumModelSelection)
    models?: ForumModelSelection[];

    @ApiPropertyOptional({ description: 'Tutor elegido por grupo (para grupos con varios tutores)', type: [GroupTutorSelection] })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => GroupTutorSelection)
    tutorByGroup?: GroupTutorSelection[];
}
