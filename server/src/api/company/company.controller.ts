import { Controller, Post, Body, Put, Param, Get, Query, Delete, UseGuards } from '@nestjs/common';
import { CreateCompanyDTO } from '../../dto/company/create-company.dto';
import { UpdateCompanyDTO } from '../../dto/company/update-company.dto';
import { CompanyService } from './company.service';
import { FilterCompanyDTO } from 'src/dto/company/filter-company.dto';
import { RoleGuard } from 'src/guards/role.guard';
import { Role } from 'src/guards/role.enum';

@Controller('company')
export class CompanyController {
  constructor(private readonly companyService: CompanyService) {}

  @UseGuards(RoleGuard([Role.ADMIN]))
  @Post()
  async create(@Body() createCompanyDTO: CreateCompanyDTO) {
    return this.companyService.create(createCompanyDTO);
  }

  @UseGuards(RoleGuard([Role.ADMIN]))
  @Put(':id')
  async update(@Param('id') id: string, @Body() updateCompanyDTO: UpdateCompanyDTO) {
    const numericId = parseInt(id, 10);
    return this.companyService.update(numericId, updateCompanyDTO);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const numericId = parseInt(id, 10);
    return this.companyService.findOne(numericId);
  }

  @Get(':id/centers')
  async findCentersByCompanyId(@Param('id') id: string) {
    const numericId = parseInt(id, 10);
    return this.companyService.findCentersByCompanyId(numericId);
  }

  @Get()
  async findAll(@Query() filter: FilterCompanyDTO) {
    return this.companyService.findAll(filter);
  }

  @UseGuards(RoleGuard([Role.ADMIN]))
  @Delete(':id')
  async delete(@Param('id') id: string) {
    const numericId = parseInt(id, 10);
    return this.companyService.delete(numericId);
  }

}