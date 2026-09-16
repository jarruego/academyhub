import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ConsultingCompetencyRepository } from "src/database/repository/consultoria/consulting-competency.repository";
import { CreateConsultingCompetencyDto } from "./dto/create-consulting-competency.dto";
import { UpdateConsultingCompetencyDto } from "./dto/update-consulting-competency.dto";

// drizzle-orm envuelve el error de pg en un DrizzleQueryError — el código de
// postgres (23503 = violación de FK) va en `.cause.code`, no en `.code`
// directamente (comprobado: el helper equivalente de course.service.ts solo
// mira `.code` y por eso nunca dispara con Drizzle).
function isForeignKeyViolation(error: unknown): boolean {
  const err = error as { code?: string; cause?: { code?: string } };
  return err?.code === "23503" || err?.cause?.code === "23503";
}

@Injectable()
export class ConsultingCompetencyService {
  constructor(private readonly consultingCompetencyRepository: ConsultingCompetencyRepository) {}

  async create(dto: CreateConsultingCompetencyDto) {
    return this.consultingCompetencyRepository.create(dto);
  }

  async findAll() {
    return this.consultingCompetencyRepository.findAll();
  }

  async findById(id_competency: number) {
    const competency = await this.consultingCompetencyRepository.findById(id_competency);
    if (!competency) throw new NotFoundException("Competencia no encontrada");
    return competency;
  }

  async update(id_competency: number, dto: UpdateConsultingCompetencyDto) {
    await this.findById(id_competency);
    return this.consultingCompetencyRepository.update(id_competency, dto);
  }

  async remove(id_competency: number) {
    await this.findById(id_competency);
    try {
      await this.consultingCompetencyRepository.remove(id_competency);
    } catch (error) {
      if (isForeignKeyViolation(error)) {
        throw new BadRequestException("No se puede borrar: hay plantillas o evaluaciones que usan esta competencia.");
      }
      throw error;
    }
    return { success: true };
  }
}
