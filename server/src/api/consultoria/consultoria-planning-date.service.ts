import { Injectable, NotFoundException } from "@nestjs/common";
import { ConsultingPlanningDateRepository } from "src/database/repository/consultoria/consulting-planning-date.repository";
import { CreateConsultingPlanningDateDto } from "./dto/create-consulting-planning-date.dto";
import { UpdateConsultingPlanningDateDto } from "./dto/update-consulting-planning-date.dto";

@Injectable()
export class ConsultingPlanningDateService {
  constructor(private readonly consultingPlanningDateRepository: ConsultingPlanningDateRepository) {}

  async create(dto: CreateConsultingPlanningDateDto) {
    return this.consultingPlanningDateRepository.create(dto);
  }

  async findAll() {
    return this.consultingPlanningDateRepository.findAll();
  }

  async findById(id_planning_date: number) {
    const planningDate = await this.consultingPlanningDateRepository.findById(id_planning_date);
    if (!planningDate) throw new NotFoundException("Valor de fecha de planificación no encontrado");
    return planningDate;
  }

  async update(id_planning_date: number, dto: UpdateConsultingPlanningDateDto) {
    await this.findById(id_planning_date);
    return this.consultingPlanningDateRepository.update(id_planning_date, dto);
  }
}
