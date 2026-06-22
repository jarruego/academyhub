// Tipos del cliente para la herramienta de Duplicado de Foros (espejo de los DTOs
// del servidor en server/src/dto/forum/*).

export interface ForumSummary {
  id: number;
  name: string;
  type: string; // 'qanda' | 'general' | 'news' | ...
  intro: string;
  numDiscussions: number | null;
}

export interface GroupTutor {
  id_user: number;
  full_name: string;
  moodle_id: number | null;
  has_token: boolean;
}

export interface GroupWithTutors {
  id_group: number;
  group_name: string;
  moodle_id: number | null;
  tutors: GroupTutor[];
}

export type DuplicationCellStatus =
  | 'create'
  | 'skip_exists'
  | 'blocked_no_model'
  | 'blocked_no_group_moodle_id'
  | 'blocked_no_tutor'
  | 'blocked_no_token';

export interface PreviewCell {
  id_group: number;
  group_name: string;
  status: DuplicationCellStatus;
  tutor: GroupTutor | null;
  reason?: string;
}

export interface PreviewForum {
  forumId: number;
  forumName: string;
  forumType: string;
  model: { discussionId: number; subject: string } | null;
  modelNeedsSelection: boolean;
  availableModels: Array<{ discussionId: number; subject: string; groupid: number }>;
  cells: PreviewCell[];
}

export interface PreviewGroup {
  id_group: number;
  group_name: string;
  moodle_id: number | null;
  tutors: GroupTutor[];
  selectedTutor: GroupTutor | null;
  tutorAmbiguous: boolean;
}

export interface PreviewDuplicationResult {
  groups: PreviewGroup[];
  forums: PreviewForum[];
  summary: { toCreate: number; toSkip: number; blocked: number };
}

export interface ExecuteCellResult {
  forumId: number;
  forumName: string;
  id_group: number;
  group_name: string;
  tutorName: string;
  status: 'created' | 'error';
  discussionId?: number | null;
  mediaWarning?: string;
  error?: string;
}

export interface ExecuteDuplicationResult {
  preview: PreviewDuplicationResult;
  results: ExecuteCellResult[];
  summary: { created: number; failed: number; skipped: number; blocked: number };
}

export interface DuplicateForumRequest {
  courseId: number;
  forumIds: number[];
  groupIds: number[];
  models?: Array<{ forumId: number; discussionId: number }>;
  tutorByGroup?: Array<{ id_group: number; id_user: number }>;
}

/** Etiqueta + color (antd Tag) para cada estado de celda. */
export const CELL_STATUS_META: Record<DuplicationCellStatus, { label: string; color: string }> = {
  create: { label: 'Se creará', color: 'green' },
  skip_exists: { label: 'Ya existe', color: 'default' },
  blocked_no_model: { label: 'Sin tema modelo', color: 'orange' },
  blocked_no_group_moodle_id: { label: 'Grupo sin Moodle', color: 'red' },
  blocked_no_tutor: { label: 'Sin tutor', color: 'red' },
  blocked_no_token: { label: 'Tutor sin token', color: 'red' },
};
