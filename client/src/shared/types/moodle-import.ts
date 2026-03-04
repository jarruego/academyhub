export interface MoodleCourseWithImportStatus {
  id: number;
  fullname: string;
  shortname: string;
  startdate: number;
  enddate?: number;
  isImported: boolean;
  moodle_synced_at?: string;
  localCourseId?: number;
}

export interface MoodleGroupWithImportStatus {
  id: number;
  name: string;
  description?: string;
  courseid: number;
  isImported: boolean;
  moodle_synced_at?: string;
  localGroupId?: number;
}

export interface MoodleCourseListResponse {
  courses: MoodleCourseWithImportStatus[];
}

export interface MoodleGroupListResponse {
  groups: MoodleGroupWithImportStatus[];
}

export interface ImportResult {
  success: boolean;
  message: string;
  importedData?: {
    courseId?: number;
    groupId?: number;
    usersImported?: number;
  };
  error?: string;
  details?: Array<{
    userId?: number;
    username?: string;
    error: string;
  }>;
}

export interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  type: 'course' | 'group';
  itemName: string;
  isLoading?: boolean;
}