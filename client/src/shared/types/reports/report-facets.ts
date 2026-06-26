// Opciones disponibles por cada desplegable del informe, calculadas como facetas
// estándar en el backend (cada dimensión se restringe por el resto de filtros,
// pero no por sí misma). Devuelto por GET /reports/facets.
export type ReportFacets = {
  companies: { id_company: number; company_name: string | null }[];
  centers: { id_center: number; center_name: string | null }[];
  courses: { id_course: number; course_name: string | null }[];
  groups: { id_group: number; group_name: string | null }[];
  roles: { id_role: number; role_shortname: string | null }[];
  // Ejes de clasificación del curso (valores de enum presentes en lo filtrado)
  modalities: string[];
  clients: string[];
  fundings: string[];
};
