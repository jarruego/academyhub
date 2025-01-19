import { Controller, Post, Body, Put, Param, Get, Query } from '@nestjs/common';
import { CreateCenterDTO } from '../../dto/center/create-center.dto';
import { UpdateCenterDTO } from '../../dto/center/update-center.dto';
import { CenterService } from './center.service';
import { FilterCenterDTO } from 'src/dto/center/filter-center.dto';

@Controller('center')
export class CenterController {
  constructor(private readonly centerService: CenterService) {}

  @Post()
  async create(@Body() createCenterDTO: CreateCenterDTO) {
    return this.centerService.create(createCenterDTO);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() updateCenterDTO: UpdateCenterDTO) {
    const numericId = parseInt(id, 10);
    return this.centerService.update(numericId, updateCenterDTO);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const numericId = parseInt(id, 10);
    return this.centerService.findById(numericId);
  }

  @Get()
  async findAll(@Query() filter: FilterCenterDTO) {
    return this.centerService.findAll(filter);
  }
}