import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ConsultingJobPositionRepository } from "src/database/repository/consultoria/consulting-job-position.repository";
import { CreateConsultingJobPositionDto } from "./dto/create-consulting-job-position.dto";
import { UpdateConsultingJobPositionDto } from "./dto/update-consulting-job-position.dto";

// drizzle-orm envuelve el error de pg en un DrizzleQueryError — el código de
// postgres (23503 = violación de FK) va en `.cause.code`, no en `.code`
// directamente (comprobado: el helper equivalente de course.service.ts solo
// mira `.code` y por eso nunca dispara con Drizzle).
function isForeignKeyViolation(error: unknown): boolean {
  const err = error as { code?: string; cause?: { code?: string } };
  return err?.code === "23503" || err?.cause?.code === "23503";
}

@Injectable()
export class ConsultingJobPositionService {
  constructor(private readonly consultingJobPositionRepository: ConsultingJobPositionRepository) {}

  async create(dto: CreateConsultingJobPositionDto) {
    return this.consultingJobPositionRepository.create(dto);
  }

  async findAll() {
    return this.consultingJobPositionRepository.findAll();
  }

  async findById(id_job_position: number) {
    const jobPosition = await this.consultingJobPositionRepository.findById(id_job_position);
    if (!jobPosition) throw new NotFoundException("Puesto de trabajo no encontrado");
    return jobPosition;
  }

  async update(id_job_position: number, dto: UpdateConsultingJobPositionDto) {
    await this.findById(id_job_position);
    return this.consultingJobPositionRepository.update(id_job_position, dto);
  }

  async remove(id_job_position: number) {
    await this.findById(id_job_position);
    try {
      await this.consultingJobPositionRepository.remove(id_job_position);
    } catch (error) {
      if (isForeignKeyViolation(error)) {
        throw new BadRequestException("No se puede borrar: hay alias de puesto, plantillas o evaluaciones que usan este puesto.");
      }
      throw error;
    }
    return { success: true };
  }
}
