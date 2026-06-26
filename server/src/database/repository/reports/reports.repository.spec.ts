import { ReportsRepository } from './reports.repository';
import { ReportFilterDTO } from 'src/dto/reports/report-filter.dto';
import { CourseModality } from 'src/types/course/course-modality.enum';
import { CourseClient } from 'src/types/course/course-client.enum';
import { CourseFunding } from 'src/types/course/course-funding.enum';

// buildWhereConditions es un método puro (no accede a la BD): basta con un repo
// construido con un dbService falso para ejercitar la lógica de exclusión de facetas.
function buildRepo() {
  return new ReportsRepository({} as any);
}

describe('ReportsRepository.buildWhereConditions — facetas estándar', () => {
  it('sin filtros no genera condiciones', () => {
    const repo = buildRepo();
    expect(repo.buildWhereConditions(undefined)).toHaveLength(0);
    expect(repo.buildWhereConditions({} as ReportFilterDTO)).toHaveLength(0);
  });

  it('combina los filtros de dimensión con los globales', () => {
    const repo = buildRepo();
    const filter: ReportFilterDTO = { id_company: [1, 2], bonified: true };
    // una condición por empresa (or) + una por bonified
    expect(repo.buildWhereConditions(filter)).toHaveLength(2);
  });

  it('excluye únicamente el filtro de la dimensión indicada', () => {
    const repo = buildRepo();
    const filter: ReportFilterDTO = { id_company: [1, 2], bonified: true };
    // al excluir "company" solo queda la condición global (bonified)
    expect(repo.buildWhereConditions(filter, 'company')).toHaveLength(1);
  });

  it('un filtro global no se excluye al pasar exclude', () => {
    const repo = buildRepo();
    const filter: ReportFilterDTO = { id_course: 5, bonified: true };
    expect(repo.buildWhereConditions(filter)).toHaveLength(2);
    // exclude del curso deja solo el global
    expect(repo.buildWhereConditions(filter, 'course')).toHaveLength(1);
    // exclude de otra dimensión no toca ni curso ni global
    expect(repo.buildWhereConditions(filter, 'company')).toHaveLength(2);
  });

  it('cada dimensión se excluye de forma independiente', () => {
    const repo = buildRepo();
    const filter: ReportFilterDTO = {
      id_company: [1],
      id_center: [2],
      id_course: 3,
      id_group: [4],
      id_role: [5],
      modality: [CourseModality.ONLINE],
      client: [CourseClient.VITALIA],
      funding: [CourseFunding.FUNDAE],
    };
    expect(repo.buildWhereConditions(filter)).toHaveLength(8);
    (['company', 'center', 'course', 'group', 'role', 'modality', 'client', 'funding'] as const).forEach((dim) => {
      expect(repo.buildWhereConditions(filter, dim)).toHaveLength(7);
    });
  });
});
