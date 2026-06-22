// Tipos de respuesta de la herramienta de Duplicado de Foros (api/forum).
// Fase 2 (lectura): foros del curso, temas de un foro y grupos con sus tutores.

export interface ForumSummaryDto {
    /** id de la instancia del foro (forumid para add_discussion) */
    id: number;
    name: string;
    /** 'general' | 'qanda' | 'news' | 'single' | 'eachuser' | 'blog' */
    type: string;
    intro: string;
    numDiscussions: number | null;
}

export interface DiscussionSummaryDto {
    /** id del primer post del tema (devuelto por Moodle como `id`) */
    id: number;
    /** id del tema (discussion) — lo que se usa para leer sus posts */
    discussionId: number;
    subject: string;
    /** grupo destinatario del tema; -1 = todos los participantes */
    groupid: number;
    authorName: string | null;
    timemodified: number | null;
    numreplies: number | null;
}

export interface GroupTutorDto {
    id_user: number;
    full_name: string;
    /** moodle_id de la cuenta del tutor (autor del tema); null si no enlazada */
    moodle_id: number | null;
    /** true si el tutor tiene token WS asignado (necesario para publicar) */
    has_token: boolean;
}

export interface GroupWithTutorsDto {
    id_group: number;
    group_name: string;
    /** moodle_id del grupo (groupid destino en add_discussion); null si no sincronizado */
    moodle_id: number | null;
    tutors: GroupTutorDto[];
}

// ===== Inspección del tema modelo (cuerpo + ficheros) =====

export interface ModelFileDto {
    filename: string;
    fileurl: string;
    filesize: number | null;
    mimetype: string | null;
}

export interface ModelPostDto {
    id: number;
    /** id del post padre (0/null si es el post inicial del tema) */
    parentId: number | null;
    subject: string;
    /** HTML del mensaje, tal cual lo devuelve Moodle */
    message: string;
    inlineFiles: ModelFileDto[];
    attachments: ModelFileDto[];
}

// ===== Preview de duplicación (Fase 3) =====

/** Estado de cada celda (foro × grupo) en el preview. */
export type DuplicationCellStatus =
    | 'create'                    // se creará el tema
    | 'skip_exists'               // el grupo ya tiene un tema con ese asunto
    | 'blocked_no_model'          // el foro no tiene tema modelo resuelto
    | 'blocked_no_group_moodle_id'// el grupo no está sincronizado con Moodle
    | 'blocked_no_tutor'          // el grupo no tiene tutor asignado
    | 'blocked_no_token';         // el tutor del grupo no tiene token WS

export interface PreviewCellDto {
    id_group: number;
    group_name: string;
    status: DuplicationCellStatus;
    /** tutor que firmaría el tema (resuelto/elegido), si lo hay */
    tutor: GroupTutorDto | null;
    reason?: string;
}

export interface PreviewForumDto {
    forumId: number;
    forumName: string;
    forumType: string;
    /** tema modelo a duplicar (asunto + id); null si hay que elegirlo o no hay temas */
    model: { discussionId: number; subject: string } | null;
    /** true si el foro tiene varios temas y hay que elegir cuál es el modelo */
    modelNeedsSelection: boolean;
    /** temas disponibles como modelo (para que el usuario elija) */
    availableModels: Array<{ discussionId: number; subject: string; groupid: number }>;
    cells: PreviewCellDto[];
}

export interface PreviewGroupDto {
    id_group: number;
    group_name: string;
    moodle_id: number | null;
    tutors: GroupTutorDto[];
    /** tutor seleccionado/resuelto para el grupo (null si bloqueado) */
    selectedTutor: GroupTutorDto | null;
    /** true si hay >1 tutor y conviene que el usuario elija explícitamente */
    tutorAmbiguous: boolean;
}

export interface PreviewDuplicationResultDto {
    groups: PreviewGroupDto[];
    forums: PreviewForumDto[];
    summary: { toCreate: number; toSkip: number; blocked: number };
}

// ===== Execute (Fase 3) =====

/** Tarea de creación resuelta (interno): un tema a crear en un grupo. */
export interface ForumCreateTask {
    forumId: number;
    forumName: string;
    modelDiscussionId: number;
    subject: string;
    id_group: number;
    group_name: string;
    /** moodle_id del grupo destino (groupid en add_discussion) */
    groupMoodleId: number;
    /** id_user del tutor que firma (para resolver su token) */
    tutorUserId: number;
    tutorName: string;
}

export interface ExecuteCellResultDto {
    forumId: number;
    forumName: string;
    id_group: number;
    group_name: string;
    tutorName: string;
    status: 'created' | 'error';
    /** id del tema creado en Moodle (si status = created) */
    discussionId?: number | null;
    /** aviso si el modelo tenía imágenes/adjuntos no copiados (Fase 4) */
    mediaWarning?: string;
    error?: string;
}

export interface ExecuteDuplicationResultDto {
    /** plan recalculado en servidor (incluye lo omitido/bloqueado) */
    preview: PreviewDuplicationResultDto;
    /** resultado de cada tema que se intentó crear */
    results: ExecuteCellResultDto[];
    summary: { created: number; failed: number; skipped: number; blocked: number };
}
