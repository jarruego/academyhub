import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { SmsTemplatesService } from './sms-templates.service';
import { RoleGuard } from '../../guards/role.guard';
import { Role } from '../../guards/role.enum';
import { SmsTemplateDto } from '../../dto/sms/sms-template.dto';

@Controller('sms-templates')
export class SmsTemplatesController {
  constructor(private readonly smsTemplatesService: SmsTemplatesService) {}

  @Get()
  @UseGuards(RoleGuard([Role.ADMIN, Role.MANAGER, Role.VIEWER, Role.TUTOR, Role.CONSULTOR]))
  findAll() {
    return this.smsTemplatesService.findAll();
  }

  @Get(':id')
  @UseGuards(RoleGuard([Role.ADMIN, Role.MANAGER, Role.VIEWER, Role.TUTOR, Role.CONSULTOR]))
  findById(@Param('id') id: string) {
    return this.smsTemplatesService.findById(Number(id));
  }

  @Post()
  @UseGuards(RoleGuard([Role.ADMIN]))
  create(@Body() body: SmsTemplateDto) {
    return this.smsTemplatesService.create(body);
  }

  @Put(':id')
  @UseGuards(RoleGuard([Role.ADMIN]))
  update(@Param('id') id: string, @Body() body: Partial<SmsTemplateDto>) {
    return this.smsTemplatesService.update(Number(id), body);
  }

  @Delete(':id')
  @UseGuards(RoleGuard([Role.ADMIN]))
  delete(@Param('id') id: string) {
    return this.smsTemplatesService.delete(Number(id));
  }
}
