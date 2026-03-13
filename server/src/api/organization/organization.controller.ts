import { Controller, Get, Patch, Body, Post, UploadedFile, UseInterceptors, BadRequestException, Logger, UseGuards } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { OrganizationService } from './organization.service';
import { RoleGuard } from 'src/guards/role.guard';
import { Role } from 'src/guards/role.enum';
import { UpdateOrganizationSettingsDTO } from 'src/dto/organization/update-organization.dto';
import { SupabaseStorageService } from 'src/common/storage/supabase-storage.service';

@Controller('api/organization')
export class OrganizationController {
  private readonly logger = new Logger(OrganizationController.name);
  constructor(
    private readonly organizationService: OrganizationService,
    private readonly supabaseStorageService: SupabaseStorageService,
  ) {}

  @Get('settings')
  async getSettings() {
    const s = await this.organizationService.getSettings();
    return { data: s };
  }

  @Patch('settings')
  @UseGuards(RoleGuard([Role.ADMIN]))
  async patchSettings(@Body() body: UpdateOrganizationSettingsDTO) {
    // DTO validation will be applied by global pipes
    const updated = await this.organizationService.upsertSettings(body);
    return { data: updated };
  }

  @Post('upload')
  @UseGuards(RoleGuard([Role.ADMIN]))
  @UseInterceptors(FileInterceptor('file'))
  async uploadAsset(@UploadedFile() file: Express.Multer.File, @Body('type') type?: string) {
    if (!file || !file.buffer) throw new BadRequestException('No file uploaded');
    if (!type || (type !== 'logo' && type !== 'signature')) throw new BadRequestException('Invalid type; must be "logo" or "signature"');

    const s = await this.organizationService.getSettings();
    const prevPath = s ? (type === 'logo' ? (s.logo_path as string | undefined) : (s.signature_path as string | undefined)) : undefined;

    const uploaded = await this.supabaseStorageService.uploadImage(`organization/${type}`, file);
    const id = s?.id;
    if (!id) {
      const created = await this.organizationService.upsertSettings({} as any);
      const newId = created?.id;
      if (!newId) throw new BadRequestException('Unable to create organization settings');
      const updated = await this.organizationService.setAssetPath(newId, type === 'logo' ? 'logo' : 'signature', uploaded.publicUrl);
      return { data: updated };
    }

    const updated = await this.organizationService.setAssetPath(id, type === 'logo' ? 'logo' : 'signature', uploaded.publicUrl);

    try {
      if (prevPath && prevPath !== uploaded.publicUrl) {
        const oldStoragePath = this.supabaseStorageService.extractPathFromPublicUrl(prevPath);
        if (oldStoragePath) {
          await this.supabaseStorageService.removeFile(oldStoragePath);
        }
      }
    } catch (err) {
      this.logger.warn(`Error while attempting to delete previous asset: ${(err as Error).message}`);
    }

    return { data: updated };
  }
}
