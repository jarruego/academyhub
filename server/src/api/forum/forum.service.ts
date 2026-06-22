import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { MoodleService } from '../moodle/moodle.service';
import { CourseRepository } from 'src/database/repository/course/course.repository';
import { GroupRepository } from 'src/database/repository/group/group.repository';
import { UserGroupRepository } from 'src/database/repository/group/user-group.repository';
import { MoodleUserRepository } from 'src/database/repository/moodle-user/moodle-user.repository';
import { AuthUserRepository } from 'src/database/repository/auth/auth_user.repository';
import {
    ForumSummaryDto,
    DiscussionSummaryDto,
    GroupWithTutorsDto,
    GroupTutorDto,
    PreviewDuplicationResultDto,
    PreviewGroupDto,
    PreviewForumDto,
    PreviewCellDto,
    DuplicationCellStatus,
    ForumCreateTask,
    ExecuteCellResultDto,
    ExecuteDuplicationResultDto,
    ModelPostDto,
    ModelFileDto,
} from 'src/dto/forum/forum.dto';
import { DuplicateForumDto } from 'src/dto/forum/duplicate-forum.dto';

/**
 * Orquestación de la herramienta de "Duplicado de Foros".
 *
 * El curso se selecciona por su id LOCAL (donde viven grupos y tutores con sus
 * tokens); el `moodle_id` del curso se resuelve aquí para llamar a Moodle.
 * Fase 2: solo lectura (foros, temas y grupos con tutores) para alimentar el
 * asistente y la previsualización.
 */
@Injectable()
export class ForumService {
    constructor(
        private readonly moodleService: MoodleService,
        private readonly courseRepository: CourseRepository,
        private readonly groupRepository: GroupRepository,
        private readonly userGroupRepository: UserGroupRepository,
        private readonly moodleUserRepository: MoodleUserRepository,
        private readonly authUserRepository: AuthUserRepository,
    ) {}

    /** Lista los foros de un curso local (resuelve su moodle_id). */
    async getCourseForums(localCourseId: number): Promise<ForumSummaryDto[]> {
        const course = await this.courseRepository.findById(localCourseId);
        if (!course) throw new NotFoundException(`Curso local ${localCourseId} no encontrado`);
        if (course.moodle_id == null) {
            throw new BadRequestException(`El curso "${course.course_name}" no está enlazado con Moodle (sin moodle_id)`);
        }

        const forums = await this.moodleService.getCourseForums(course.moodle_id);
        return forums.map((f) => ({
            id: f.id,
            name: f.name,
            type: f.type,
            intro: f.intro ?? '',
            numDiscussions: typeof f.numdiscussions === 'number' ? f.numdiscussions : null,
        }));
    }

    /** Lista los temas de un foro (para elegir el tema modelo a duplicar). */
    async getForumDiscussions(forumId: number): Promise<DiscussionSummaryDto[]> {
        const discussions = await this.moodleService.getForumDiscussions(forumId);
        return discussions.map((d) => ({
            id: d.id,
            discussionId: typeof d.discussion === 'number' ? d.discussion : d.id,
            subject: d.subject ?? d.name ?? '',
            groupid: typeof d.groupid === 'number' ? d.groupid : -1,
            authorName: d.userfullname ?? null,
            timemodified: typeof d.timemodified === 'number' ? d.timemodified : null,
            numreplies: typeof d.numreplies === 'number' ? d.numreplies : null,
        }));
    }

    /**
     * Grupos del curso local con sus tutores y si cada uno tiene token WS.
     * Alimenta la selección de grupos y la resolución del autor por grupo.
     */
    async getCourseGroupsWithTutors(localCourseId: number): Promise<GroupWithTutorsDto[]> {
        const course = await this.courseRepository.findById(localCourseId);
        if (!course) throw new NotFoundException(`Curso local ${localCourseId} no encontrado`);

        const groups = await this.groupRepository.findGroupsByCourseId(localCourseId);
        const result: GroupWithTutorsDto[] = [];
        for (const g of groups) {
            const tutors = await this.userGroupRepository.findGroupTutors(g.id_group);
            result.push({
                id_group: g.id_group,
                group_name: g.group_name,
                moodle_id: g.moodle_id ?? null,
                tutors,
            });
        }
        return result;
    }

    /**
     * Devuelve los posts de un tema con su cuerpo HTML y la lista de ficheros
     * embebidos/adjuntos. Sirve para previsualizar el tema modelo y para inspeccionar
     * cómo referencia Moodle las imágenes (clave para la Fase 4 de re-subida).
     */
    async getModelPosts(discussionId: number): Promise<ModelPostDto[]> {
        const posts = await this.moodleService.getDiscussionPosts(discussionId);
        const toFile = (f: { filename?: string; fileurl?: string; filesize?: number; mimetype?: string }): ModelFileDto => ({
            filename: f.filename ?? '',
            fileurl: f.fileurl ?? '',
            filesize: typeof f.filesize === 'number' ? f.filesize : null,
            mimetype: f.mimetype ?? null,
        });
        return posts.map((p) => {
            const parentRaw = p.parentid ?? p.parent ?? 0;
            return {
                id: p.id,
                parentId: typeof parentRaw === 'number' ? parentRaw : 0,
                subject: p.subject ?? '',
                message: p.message ?? '',
                inlineFiles: Array.isArray(p.messageinlinefiles) ? p.messageinlinefiles.map(toFile) : [],
                attachments: Array.isArray(p.attachments) ? p.attachments.map(toFile) : [],
            };
        });
    }

    /** Normaliza un asunto para comparar idempotencia (trim + colapsa espacios). */
    private normalizeSubject(s: string): string {
        return (s ?? '').replace(/\s+/g, ' ').trim();
    }

    /**
     * Resuelve el tutor que firmaría los temas de un grupo: si hay override lo
     * respeta; si no, prefiere el primer tutor CON token; si ninguno tiene token,
     * devuelve el primero (para poder reportar "bloqueado por falta de token").
     */
    private resolveSelectedTutor(tutors: GroupTutorDto[], overrideUserId: number | undefined): GroupTutorDto | null {
        if (tutors.length === 0) return null;
        if (overrideUserId != null) {
            return tutors.find((t) => t.id_user === overrideUserId) ?? null;
        }
        return tutors.find((t) => t.has_token) ?? tutors[0] ?? null;
    }

    /**
     * Calcula el plan de duplicación (matriz foro × grupo) SIN escribir nada.
     * Devuelve la vista para el preview y la lista de tareas `create` resueltas
     * (modelo + grupo destino + tutor) que el execute consumirá. Así preview y
     * execute comparten exactamente la misma lógica de idempotencia/bloqueos.
     */
    private async buildPlan(dto: DuplicateForumDto): Promise<{ preview: PreviewDuplicationResultDto; createTasks: ForumCreateTask[] }> {
        const createTasks: ForumCreateTask[] = [];
        const course = await this.courseRepository.findById(dto.courseId);
        if (!course) throw new NotFoundException(`Curso local ${dto.courseId} no encontrado`);

        // Grupos seleccionados del curso, con sus tutores.
        const allGroups = await this.getCourseGroupsWithTutors(dto.courseId);
        const wantedGroupIds = new Set(dto.groupIds);
        const selectedGroups = allGroups.filter((g) => wantedGroupIds.has(g.id_group));

        const tutorOverride = new Map<number, number>((dto.tutorByGroup ?? []).map((s) => [s.id_group, s.id_user]));
        const modelOverride = new Map<number, number>((dto.models ?? []).map((m) => [m.forumId, m.discussionId]));

        // Nombres/tipos de los foros del curso (1 llamada) para enriquecer la respuesta.
        const courseForums = course.moodle_id != null ? await this.getCourseForums(dto.courseId) : [];
        const forumMeta = new Map(courseForums.map((f) => [f.id, { name: f.name, type: f.type }]));

        // Construir la vista de grupos con su tutor resuelto.
        const groups: PreviewGroupDto[] = selectedGroups.map((g) => {
            const selectedTutor = this.resolveSelectedTutor(g.tutors, tutorOverride.get(g.id_group));
            return {
                id_group: g.id_group,
                group_name: g.group_name,
                moodle_id: g.moodle_id,
                tutors: g.tutors,
                selectedTutor,
                tutorAmbiguous: g.tutors.length > 1,
            };
        });
        let toCreate = 0;
        let toSkip = 0;
        let blocked = 0;

        const forums: PreviewForumDto[] = [];
        for (const forumId of dto.forumIds) {
            const discussions = await this.getForumDiscussions(forumId);

            const availableModels = discussions.map((d) => ({ discussionId: d.discussionId, subject: d.subject, groupid: d.groupid }));

            // Resolver el tema modelo del foro.
            let model: { discussionId: number; subject: string } | null = null;
            let modelNeedsSelection = false;
            const overrideDiscussionId = modelOverride.get(forumId);
            if (overrideDiscussionId != null) {
                const d = discussions.find((x) => x.discussionId === overrideDiscussionId);
                if (d) model = { discussionId: d.discussionId, subject: d.subject };
            } else if (discussions.length === 1) {
                model = { discussionId: discussions[0].discussionId, subject: discussions[0].subject };
            } else if (discussions.length > 1) {
                modelNeedsSelection = true;
            }

            // Conjunto de temas existentes (groupid + asunto normalizado) para idempotencia.
            const existing = new Set(discussions.map((d) => `${d.groupid}::${this.normalizeSubject(d.subject)}`));
            const modelSubjectNorm = model ? this.normalizeSubject(model.subject) : null;

            const cells: PreviewCellDto[] = groups.map((g) => {
                const tutor = g.selectedTutor;
                let status: DuplicationCellStatus;
                let reason: string | undefined;

                if (!model) {
                    status = 'blocked_no_model';
                    reason = modelNeedsSelection ? 'El foro tiene varios temas; elige cuál es el modelo' : 'El foro no tiene ningún tema para usar como modelo';
                } else if (g.moodle_id == null) {
                    status = 'blocked_no_group_moodle_id';
                    reason = 'El grupo no está sincronizado con Moodle';
                } else if (g.tutors.length === 0) {
                    status = 'blocked_no_tutor';
                    reason = 'El grupo no tiene tutor asignado';
                } else if (!tutor || !tutor.has_token) {
                    status = 'blocked_no_token';
                    reason = 'El tutor del grupo no tiene token de Moodle';
                } else if (existing.has(`${g.moodle_id}::${modelSubjectNorm}`)) {
                    status = 'skip_exists';
                    reason = 'El grupo ya tiene un tema con ese asunto';
                } else {
                    status = 'create';
                }

                if (status === 'create') {
                    toCreate++;
                    // Registrar la tarea de creación (todos los campos están garantizados aquí).
                    createTasks.push({
                        forumId,
                        forumName: forumMeta.get(forumId)?.name ?? '',
                        modelDiscussionId: model!.discussionId,
                        subject: model!.subject,
                        id_group: g.id_group,
                        group_name: g.group_name,
                        groupMoodleId: g.moodle_id!,
                        tutorUserId: tutor!.id_user,
                        tutorName: tutor!.full_name,
                    });
                } else if (status === 'skip_exists') toSkip++;
                else blocked++;

                return { id_group: g.id_group, group_name: g.group_name, status, tutor, reason };
            });

            const meta = forumMeta.get(forumId);
            forums.push({
                forumId,
                forumName: meta?.name ?? '',
                forumType: meta?.type ?? '',
                model,
                modelNeedsSelection,
                availableModels,
                cells,
            });
        }

        return { preview: { groups, forums, summary: { toCreate, toSkip, blocked } }, createTasks };
    }

    /**
     * Previsualiza la duplicación SIN escribir nada en Moodle (matriz foro × grupo
     * con estado y tutor que firmaría cada tema).
     */
    async previewDuplication(dto: DuplicateForumDto): Promise<PreviewDuplicationResultDto> {
        return (await this.buildPlan(dto)).preview;
    }

    /**
     * Resuelve el token WS del tutor (por id_user local), replicando la cadena de
     * `MailService.resolveToken('tutor')`: cuenta Moodle principal → enlace
     * moodle_user_auth_user → moodle_token (en plano).
     */
    private async resolveTutorToken(tutorUserId: number): Promise<string | undefined> {
        const moodleUsers = await this.moodleUserRepository.findByUserId(tutorUserId);
        if (moodleUsers.length === 0) return undefined;
        const moodleUser = moodleUsers.find((mu) => mu.is_main_user) ?? moodleUsers[0];
        const link = await this.authUserRepository.findTopMoodleLinkByMoodleUserId(moodleUser.id_moodle_user);
        return link?.moodle_token ?? undefined;
    }

    /** HTML del post inicial (sin padre) del tema modelo. */
    private extractRootMessage(posts: Array<{ parentid?: number | null; parent?: number | null; message?: string }>): string {
        const root = posts.find((p) => (p.parentid == null || p.parentid === 0) && (p.parent == null || p.parent === 0)) ?? posts[0];
        return root?.message ?? '';
    }

    /**
     * Analiza el HTML del tema modelo: localiza los ficheros embebidos buscando
     * URLs `pluginfile.php` (Moodle NO los lista en `messageinlinefiles` para los
     * posts de foro), los **descarga una vez** (con el token de la org) y construye
     * la plantilla de mensaje con los marcadores `@@PLUGINFILE@@/fichero` que Moodle
     * re-vincula al crear el tema. Los enlaces/iframes (vídeos embebidos) no son
     * pluginfile, así que viajan intactos como HTML.
     */
    private async buildForumContent(message: string): Promise<ForumContent> {
        const urlRegex = /(?:src|href)\s*=\s*"([^"]*\/pluginfile\.php\/[^"]+)"/gi;
        const matches = [...message.matchAll(urlRegex)];
        if (matches.length === 0) {
            return { templateMessage: message, files: [], downloadErrors: [] };
        }

        const orgToken = await this.moodleService.resolveMoodleToken();
        let templateMessage = message;
        const files: Array<{ filename: string; buffer: Buffer }> = [];
        const downloadErrors: string[] = [];
        const seen = new Set<string>();

        for (const m of matches) {
            const original = m[1]; // tal cual aparece en el HTML (puede llevar &amp;)
            if (seen.has(original)) continue;
            seen.add(original);

            const rawUrl = original.replace(/&amp;/g, '&');
            const lastSeg = (rawUrl.split('?')[0].split('/').pop()) || 'file';
            const filename = decodeURIComponent(lastSeg);
            try {
                const buffer = await this.moodleService.downloadFile(rawUrl, orgToken);
                files.push({ filename, buffer });
                // Reescribir la URL original por el marcador (mismo nombre URL-encoded).
                templateMessage = templateMessage.split(original).join(`@@PLUGINFILE@@/${lastSeg}`);
            } catch (e) {
                downloadErrors.push(`${filename}: ${e instanceof Error ? e.message : String(e)}`);
            }
        }
        return { templateMessage, files, downloadErrors };
    }

    /**
     * Ejecuta la duplicación. Recalcula el plan en servidor (no se fía del cliente),
     * lee el cuerpo de cada tema modelo y sus imágenes (1 vez por foro) y crea un
     * tema por grupo destino firmado con el token del tutor de ese grupo. Las
     * imágenes embebidas se re-suben al draft del tutor (área per-usuario, draft
     * nuevo por tema) y se referencian con `inlineattachmentsid`. Errores aislados
     * por celda.
     */
    async executeDuplication(dto: DuplicateForumDto): Promise<ExecuteDuplicationResultDto> {
        const { preview, createTasks } = await this.buildPlan(dto);

        // Cache por foro: plantilla de mensaje + ficheros descargados (1 vez).
        const contentCache = new Map<number, ForumContent>();
        // Cache de token por tutor.
        const tokenCache = new Map<number, string | undefined>();

        const results: ExecuteCellResultDto[] = [];
        let created = 0;
        let failed = 0;

        for (const task of createTasks) {
            const base = {
                forumId: task.forumId,
                forumName: task.forumName,
                id_group: task.id_group,
                group_name: task.group_name,
                tutorName: task.tutorName,
            };
            try {
                // Token del tutor (cacheado).
                if (!tokenCache.has(task.tutorUserId)) {
                    tokenCache.set(task.tutorUserId, await this.resolveTutorToken(task.tutorUserId));
                }
                const token = tokenCache.get(task.tutorUserId);
                if (!token) {
                    failed++;
                    results.push({ ...base, status: 'error', error: 'No se pudo resolver el token del tutor' });
                    continue;
                }

                // Contenido del tema modelo (cacheado por foro): mensaje + imágenes.
                if (!contentCache.has(task.forumId)) {
                    const posts = await this.moodleService.getDiscussionPosts(task.modelDiscussionId);
                    contentCache.set(task.forumId, await this.buildForumContent(this.extractRootMessage(posts)));
                }
                const content = contentCache.get(task.forumId)!;

                // Si hay imágenes, subirlas a un draft NUEVO del tutor (el draft es
                // per-usuario y se consume al crear el tema) y referenciarlas.
                let message = content.templateMessage;
                let options: Array<{ name: string; value: string | number | boolean }> | undefined;
                if (content.files.length > 0) {
                    let draftId: number | undefined;
                    try {
                        for (const f of content.files) {
                            const up = await this.moodleService.uploadToDraftArea(f.buffer, f.filename, token, draftId);
                            draftId = up.itemid;
                        }
                    } catch (e) {
                        // Etiquetar el paso: el fallo aquí casi siempre es que el servicio
                        // del token del tutor no tiene activado "Can upload files".
                        throw new Error(`[subida de imagen al draft del tutor / upload.php] ${e instanceof Error ? e.message : String(e)}`);
                    }
                    options = [{ name: 'inlineattachmentsid', value: draftId! }];
                } else {
                    // Sin imágenes copiables: el mensaje plantilla es el original.
                    message = content.templateMessage;
                }

                const res = options
                    ? await this.moodleService.addForumDiscussion(task.forumId, task.subject, message, task.groupMoodleId, token, options)
                    : await this.moodleService.addForumDiscussion(task.forumId, task.subject, message, task.groupMoodleId, token);

                created++;
                results.push({
                    ...base,
                    status: 'created',
                    discussionId: res?.discussionid ?? null,
                    mediaWarning: content.downloadErrors.length > 0
                        ? `No se pudieron copiar ${content.downloadErrors.length} fichero(s): ${content.downloadErrors.join('; ')}`
                        : undefined,
                });
            } catch (err) {
                failed++;
                results.push({ ...base, status: 'error', error: err instanceof Error ? err.message : String(err) });
            }
        }

        return {
            preview,
            results,
            summary: {
                created,
                failed,
                skipped: preview.summary.toSkip,
                blocked: preview.summary.blocked,
            },
        };
    }
}

/** Plantilla de mensaje + imágenes descargadas de un tema modelo (cache por foro). */
interface ForumContent {
    templateMessage: string;
    files: Array<{ filename: string; buffer: Buffer }>;
    downloadErrors: string[];
}
