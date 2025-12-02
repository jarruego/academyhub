import { Controller, Get, Patch, Body, Post, UploadedFile, UseInterceptors, BadRequestException, Logger, UseGuards } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { OrganizationService } from './organization.service';
import * as path from 'path';
import * as fs from 'fs/promises';
import { RoleGuard } from 'src/guards/role.guard';
import { Role } from 'src/guards/role.enum';
import { UpdateOrganizationSettingsDTO } from 'src/dto/organization/update-organization.dto';

@Controller('api/organization')
export class OrganizationController {
  private readonly logger = new Logger(OrganizationController.name);
  constructor(private readonly organizationService: OrganizationService) {}

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

  // Ensure uploads dir
  const uploadsRoot = path.join(process.cwd(), 'public', 'uploads', 'organization');
  await fs.mkdir(uploadsRoot, { recursive: true });
  // read current settings (to know previous asset path) before writing new file
  const s = await this.organizationService.getSettings();
  // record previous path so we can remove the old file after successful update
  const prevPath = s ? (type === 'logo' ? (s.logo_path as string | undefined) : (s.signature_path as string | undefined)) : undefined;

    // sanitize filename minimally
    const timestamp = Date.now();
    const ext = path.extname(file.originalname) || '';
    const filename = `${type}-${timestamp}${ext}`;
    const filepath = path.join(uploadsRoot, filename);

  await fs.writeFile(filepath, file.buffer);

    // Update DB: set path relative to public
    const relPath = `/uploads/organization/${filename}`;
  // get existing row id (first row)
  // NOTE: we already read `s` earlier before writing, but re-use its id here
  const id = s?.id;
    if (!id) {
      // create an empty settings row then set asset path
      const created = await this.organizationService.upsertSettings({} as any);
      const newId = created?.id;
      if (!newId) throw new BadRequestException('Unable to create organization settings');
      const updated = await this.organizationService.setAssetPath(newId, type === 'logo' ? 'logo' : 'signature', relPath);
      // no previous file to delete in creation case (prevPath is undefined)
      return { data: updated };
    }

    const updated = await this.organizationService.setAssetPath(id, type === 'logo' ? 'logo' : 'signature', relPath);

    // If there was a previous file different from the new one, try to remove it.
    try {
      if (prevPath && prevPath !== relPath && prevPath.startsWith('/uploads/organization/')) {
        // build filesystem path safely by stripping leading slash
        const relative = prevPath.replace(/^\/+/, '');
        const oldFsPath = path.join(process.cwd(), 'public', relative);
        await fs.unlink(oldFsPath).catch((err) => {
          this.logger.warn(`Could not delete old asset ${oldFsPath}: ${err?.message ?? err}`);
        });
      }
    } catch (err) {
      // log but don't block response
      this.logger.warn(`Error while attempting to delete previous asset: ${(err as Error).message}`);
    }

    return { data: updated };
  }
}
