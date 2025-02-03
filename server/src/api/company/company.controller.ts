import { Controller, Post, Body, Put, Param, Get, Query, Delete } from '@nestjs/common';
import { CreateCompanyDTO } from '../../dto/company/create-company.dto';
import { UpdateCompanyDTO } from '../../dto/company/update-company.dto';
import { CompanyService } from './company.service';
import { FilterCompanyDTO } from 'src/dto/company/filter-company.dto';

@Controller('company')
export class CompanyController {
  constructor(private readonly companyService: CompanyService) {}

  @Post()
  async create(@Body() createCompanyDTO: CreateCompanyDTO) {
    return this.companyService.create(createCompanyDTO);
  }

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

  @Delete(':id')
  async delete(@Param('id') id: string) {
    const numericId = parseInt(id, 10);
    return this.companyService.delete(numericId);
  }

  // ...existing code...
}