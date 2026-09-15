import { Body, Controller, Delete, Get, Param, Patch, ParseIntPipe, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { RoleGuard } from "src/guards/role.guard";
import { Role } from "src/guards/role.enum";
import { ConsultingClientService } from "./consultoria-client.service";
import { CreateConsultingClientDto } from "./dto/create-consulting-client.dto";
import { UpdateConsultingClientDto } from "./dto/update-consulting-client.dto";
import { AddConsultingClientCompanyDto } from "./dto/add-consulting-client-company.dto";

// Ver docs/consultoria.md — apartado nuevo, ADMIN y CONSULTOR con el mismo acceso.
@ApiTags("Consultoría — Clientes")
@ApiBearerAuth()
@Controller("api/consultoria/clients")
@UseGuards(RoleGuard([Role.ADMIN, Role.CONSULTOR]))
export class ConsultingClientController {
  constructor(private readonly consultingClientService: ConsultingClientService) {}

  @Post()
  @ApiOperation({ summary: "Dar de alta un cliente a auditar" })
  async create(@Body() dto: CreateConsultingClientDto) {
    return this.consultingClientService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: "Listar clientes a auditar" })
  async findAll() {
    return this.consultingClientService.findAll();
  }

  @Get(":id")
  @ApiOperation({ summary: "Ficha de un cliente a auditar" })
  async findById(@Param("id", ParseIntPipe) id: number) {
    return this.consultingClientService.findById(id);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Editar el nombre de un cliente a auditar" })
  async update(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateConsultingClientDto) {
    return this.consultingClientService.update(id, dto);
  }

  @Get(":id/companies")
  @ApiOperation({ summary: "Empresas vinculadas a un cliente" })
  async findCompanies(@Param("id", ParseIntPipe) id: number) {
    return this.consultingClientService.findCompanies(id);
  }

  @Post(":id/companies")
  @ApiOperation({ summary: "Vincular una empresa (ya existente) a un cliente" })
  async addCompany(@Param("id", ParseIntPipe) id: number, @Body() dto: AddConsultingClientCompanyDto) {
    return this.consultingClientService.addCompany(id, dto);
  }

  @Delete(":id/companies/:id_company")
  @ApiOperation({ summary: "Desvincular una empresa de un cliente" })
  async removeCompany(@Param("id", ParseIntPipe) id: number, @Param("id_company", ParseIntPipe) id_company: number) {
    await this.consultingClientService.removeCompany(id, id_company);
    return { success: true };
  }
}
