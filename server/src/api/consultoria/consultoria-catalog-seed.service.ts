import { Injectable } from "@nestjs/common";
import { ConsultingCompetencyRepository } from "src/database/repository/consultoria/consulting-competency.repository";
import { ConsultingJobPositionRepository } from "src/database/repository/consultoria/consulting-job-position.repository";
import { ConsultingJobPositionGroupRepository } from "src/database/repository/consultoria/consulting-job-position-group.repository";
import { ConsultingJobPositionAliasRepository } from "src/database/repository/consultoria/consulting-job-position-alias.repository";
import { ConsultingPositionCompetencyTemplateRepository } from "src/database/repository/consultoria/consulting-position-competency-template.repository";
import {
  DRAFT_COMPETENCIES,
  DRAFT_JOB_POSITIONS,
  POSITION_COMPETENCY_TEMPLATE,
  JOB_POSITION_MAPPING_RULES,
  normalizeJobPositionText,
  looksLikeGarbageJobPosition,
} from "./consultoria-catalog-seed.data";

// TEMPORAL — ver cabecera de consultoria-catalog-seed.data.ts. Borrar este
// servicio junto con el controlador, los endpoints, el botón del frontend y
// el script standalone cuando el usuario avise de que ya no hace falta.
@Injectable()
export class ConsultingCatalogSeedService {
  constructor(
    private readonly consultingCompetencyRepository: ConsultingCompetencyRepository,
    private readonly consultingJobPositionRepository: ConsultingJobPositionRepository,
    private readonly consultingJobPositionGroupRepository: ConsultingJobPositionGroupRepository,
    private readonly consultingJobPositionAliasRepository: ConsultingJobPositionAliasRepository,
    private readonly consultingPositionCompetencyTemplateRepository: ConsultingPositionCompetencyTemplateRepository,
  ) {}

  /**
   * Da de alta las competencias/puestos que todavía no existan (por
   * nombre) y aplica la plantilla real puesto↔competencia del Excel —
   * `default_value: true` para cada par marcado, sin pisar valores que el
   * usuario ya haya editado a mano (solo rellena los que no tengan fila
   * todavía).
   */
  async fillCatalog() {
    const existingCompetencies = await this.consultingCompetencyRepository.findAll();
    const existingCompetencyNames = new Set(existingCompetencies.map((c) => c.name));
    let competenciesCreated = 0;
    for (let i = 0; i < DRAFT_COMPETENCIES.length; i++) {
      const name = DRAFT_COMPETENCIES[i];
      if (existingCompetencyNames.has(name)) continue;
      await this.consultingCompetencyRepository.create({ name, display_order: i + 1 });
      competenciesCreated++;
    }

    const existingGroups = await this.consultingJobPositionGroupRepository.findAll();
    const groupIdByName = new Map(existingGroups.map((g) => [g.name, g.id_job_position_group]));
    for (const jp of DRAFT_JOB_POSITIONS) {
      if (groupIdByName.has(jp.group_label)) continue;
      const created = await this.consultingJobPositionGroupRepository.create({ name: jp.group_label });
      groupIdByName.set(jp.group_label, created.id_job_position_group);
    }

    const existingJobPositions = await this.consultingJobPositionRepository.findAll();
    const existingJobPositionNames = new Set(existingJobPositions.map((p) => p.name));
    let jobPositionsCreated = 0;
    for (let i = 0; i < DRAFT_JOB_POSITIONS.length; i++) {
      const jp = DRAFT_JOB_POSITIONS[i];
      if (existingJobPositionNames.has(jp.name)) continue;
      await this.consultingJobPositionRepository.create({ name: jp.name, id_job_position_group: groupIdByName.get(jp.group_label), display_order: i + 1 });
      jobPositionsCreated++;
    }

    const allCompetencies = await this.consultingCompetencyRepository.findAll();
    const competencyIdByName = new Map(allCompetencies.map((c) => [c.name, c.id_competency]));
    const allJobPositions = await this.consultingJobPositionRepository.findAll();
    const jobPositionIdByName = new Map(allJobPositions.map((p) => [p.name, p.id_job_position]));

    let templateValuesSet = 0;
    for (const row of POSITION_COMPETENCY_TEMPLATE) {
      const id_job_position = jobPositionIdByName.get(row.jobPosition);
      if (!id_job_position) continue;
      const existingTemplate = await this.consultingPositionCompetencyTemplateRepository.findByJobPosition(id_job_position);
      const alreadySet = new Set(existingTemplate.map((t) => t.id_competency));
      for (const competencyName of row.competencies) {
        const id_competency = competencyIdByName.get(competencyName);
        if (!id_competency || alreadySet.has(id_competency)) continue;
        await this.consultingPositionCompetencyTemplateRepository.upsert(id_job_position, id_competency, true);
        templateValuesSet++;
      }
    }

    return { competenciesCreated, jobPositionsCreated, templateValuesSet };
  }

  /** Automapea job_position reales sin alias todavía, por coincidencia de palabra clave — conservador, deja sin tocar lo que no encaja con nada. */
  async autoMapJobPositions() {
    const [pending, allJobPositions] = await Promise.all([
      this.consultingJobPositionAliasRepository.findUnmapped(),
      this.consultingJobPositionRepository.findAll(),
    ]);
    const idByName = new Map(allJobPositions.map((p) => [p.name, p.id_job_position]));

    let mapped = 0;
    const unresolved: string[] = [];
    const garbage: string[] = [];
    for (const raw of pending) {
      if (looksLikeGarbageJobPosition(raw)) {
        garbage.push(raw);
        continue;
      }
      const normalized = normalizeJobPositionText(raw);
      const rule = JOB_POSITION_MAPPING_RULES.find((r) => r.fragments.some((f) => normalized.includes(f)));
      const id_job_position = rule ? idByName.get(rule.jobPosition) : undefined;
      if (!id_job_position) {
        unresolved.push(raw);
        continue;
      }
      await this.consultingJobPositionAliasRepository.upsert(raw, id_job_position);
      mapped++;
    }

    return { mapped, unresolved, garbage };
  }
}
