import { Body, Controller, Get, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { ForumService } from './forum.service';
import { RoleGuard } from 'src/guards/role.guard';
import { Role } from 'src/guards/role.enum';
import { ForumSummaryDto, DiscussionSummaryDto, GroupWithTutorsDto, PreviewDuplicationResultDto, ExecuteDuplicationResultDto, ModelPostDto } from 'src/dto/forum/forum.dto';
import { DuplicateForumDto } from 'src/dto/forum/duplicate-forum.dto';

/**
 * Herramienta de Duplicado de Foros. Fase 2: endpoints de lectura que alimentan
 * el asistente (curso → foros → tema modelo → grupos+tutores).
 * Todos restringidos a ADMIN/MANAGER.
 */
@UseGuards(RoleGuard([Role.ADMIN, Role.MANAGER]))
@Controller('api/forum')
export class ForumController {
    constructor(private readonly forumService: ForumService) {}

    /** Foros de un curso (id LOCAL del curso). */
    @Get('courses/:courseId/forums')
    async getCourseForums(@Param('courseId', ParseIntPipe) courseId: number): Promise<ForumSummaryDto[]> {
        return this.forumService.getCourseForums(courseId);
    }

    /** Temas de un foro (para elegir el tema modelo a duplicar). */
    @Get('forums/:forumId/discussions')
    async getForumDiscussions(@Param('forumId', ParseIntPipe) forumId: number): Promise<DiscussionSummaryDto[]> {
        return this.forumService.getForumDiscussions(forumId);
    }

    /** Posts de un tema (cuerpo HTML + ficheros embebidos/adjuntos) para previsualizar el modelo. */
    @Get('discussions/:discussionId/posts')
    async getModelPosts(@Param('discussionId', ParseIntPipe) discussionId: number): Promise<ModelPostDto[]> {
        return this.forumService.getModelPosts(discussionId);
    }

    /** Grupos del curso (id LOCAL) con sus tutores y disponibilidad de token. */
    @Get('courses/:courseId/groups-with-tutors')
    async getCourseGroupsWithTutors(@Param('courseId', ParseIntPipe) courseId: number): Promise<GroupWithTutorsDto[]> {
        return this.forumService.getCourseGroupsWithTutors(courseId);
    }

    /**
     * Previsualiza la duplicación SIN escribir en Moodle: matriz foro × grupo con
     * estado (crear / omitir-ya-existe / bloqueado) y el tutor que firmaría.
     */
    @Post('duplicate/preview')
    async previewDuplication(@Body() dto: DuplicateForumDto): Promise<PreviewDuplicationResultDto> {
        return this.forumService.previewDuplication(dto);
    }

    /**
     * Ejecuta la duplicación: crea un tema por grupo destino firmado con el token
     * del tutor de cada grupo. Recalcula el plan en servidor (idempotente) y
     * devuelve el informe por celda. ESCRIBE en Moodle.
     */
    @Post('duplicate/execute')
    async executeDuplication(@Body() dto: DuplicateForumDto): Promise<ExecuteDuplicationResultDto> {
        return this.forumService.executeDuplication(dto);
    }
}
