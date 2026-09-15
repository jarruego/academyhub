import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import {
  ConsultingClientRepository,
  ConsultingClientCompanyRepository,
} from "src/database/repository/consultoria/consulting-client.repository";
import { CreateConsultingClientDto } from "./dto/create-consulting-client.dto";
import { UpdateConsultingClientDto } from "./dto/update-consulting-client.dto";
import { AddConsultingClientCompanyDto } from "./dto/add-consulting-client-company.dto";

@Injectable()
export class ConsultingClientService {
  constructor(
    private readonly consultingClientRepository: ConsultingClientRepository,
    private readonly consultingClientCompanyRepository: ConsultingClientCompanyRepository,
  ) {}

  async create(dto: CreateConsultingClientDto) {
    return this.consultingClientRepository.create(dto);
  }

  async findAll() {
    return this.consultingClientRepository.findAll();
  }

  async findById(id_consulting_client: number) {
    const client = await this.consultingClientRepository.findById(id_consulting_client);
    if (!client) throw new NotFoundException("Cliente de consultoría no encontrado");
    return client;
  }

  async update(id_consulting_client: number, dto: UpdateConsultingClientDto) {
    await this.findById(id_consulting_client);
    return this.consultingClientRepository.update(id_consulting_client, dto);
  }

  async findCompanies(id_consulting_client: number) {
    await this.findById(id_consulting_client);
    return this.consultingClientCompanyRepository.findByClientId(id_consulting_client);
  }

  async addCompany(id_consulting_client: number, dto: AddConsultingClientCompanyDto) {
    await this.findById(id_consulting_client);
    const existing = await this.consultingClientCompanyRepository.findLink(id_consulting_client, dto.id_company);
    if (existing) throw new ConflictException("Esta empresa ya está vinculada a este cliente");
    return this.consultingClientCompanyRepository.addCompany(id_consulting_client, dto.id_company);
  }

  async removeCompany(id_consulting_client: number, id_company: number) {
    await this.findById(id_consulting_client);
    return this.consultingClientCompanyRepository.removeCompany(id_consulting_client, id_company);
  }
}
