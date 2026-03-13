import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { MailTemplatesService } from './mail-templates.service';
import { RoleGuard } from '../../guards/role.guard';
import { Role } from '../../guards/role.enum';
import type { MailTemplateInsert } from '../../database/schema/tables/mail_templates.table';
import { SupabaseStorageService } from '../../common/storage/supabase-storage.service';

@Controller('mail-templates')
export class MailTemplatesController {
  constructor(
    private readonly mailTemplatesService: MailTemplatesService,
    private readonly supabaseStorageService: SupabaseStorageService,
  ) {}

  @Get()
  @UseGuards(RoleGuard([Role.ADMIN, Role.MANAGER, Role.VIEWER]))
  findAll() {
    return this.mailTemplatesService.findAll();
  }

  @Get(':id')
  @UseGuards(RoleGuard([Role.ADMIN, Role.MANAGER, Role.VIEWER]))
  findById(@Param('id') id: string) {
    return this.mailTemplatesService.findById(Number(id));
  }

  @Post()
  @UseGuards(RoleGuard([Role.ADMIN]))
  create(@Body() body: MailTemplateInsert) {
    return this.mailTemplatesService.create(body);
  }

  @Post('upload-image')
  @UseGuards(RoleGuard([Role.ADMIN]))
  @UseInterceptors(FileInterceptor('file'))
  async uploadImage(@UploadedFile() file: Express.Multer.File) {
    const uploaded = await this.supabaseStorageService.uploadImage('mail-templates', file);
    return {
      data: {
        path: uploaded.path,
        url: uploaded.publicUrl,
      },
    };
  }

  @Put(':id')
  @UseGuards(RoleGuard([Role.ADMIN]))
  update(@Param('id') id: string, @Body() body: Partial<MailTemplateInsert>) {
    return this.mailTemplatesService.update(Number(id), body);
  }

  @Delete(':id')
  @UseGuards(RoleGuard([Role.ADMIN]))
  delete(@Param('id') id: string) {
    return this.mailTemplatesService.delete(Number(id));
  }
}
