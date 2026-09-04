import { Course } from "../course/course";
import { CourseModality } from "../course/course-modality.enum";

export type CatalogCourse = {
  id_catalog_course: number;
  name: string;
  normalized_name: string;
  internal_code?: string | null;
  description?: string | null;
  objectives?: string | null;
  base_contents?: string | null;
  default_modality?: CourseModality | null;
  default_hours?: number | null;
  sepe_specialty_code?: string | null;
  sepe_specialty_name?: string | null;
  professional_family?: string | null;
  professional_area?: string | null;
  editions_count?: number;
  editions?: Course[];
};

export type CatalogCourseInput = Omit<CatalogCourse, "id_catalog_course" | "normalized_name" | "editions_count" | "editions">;
