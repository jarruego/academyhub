import { Controller, Get, Param, Res, NotFoundException } from '@nestjs/common';
import { Response } from 'express';
import * as path from 'path';
import * as fs from 'fs/promises';
import { Public } from 'src/guards/auth/public.guard';

@Controller('api/files')
export class FilesController {
  /**
   * Sirve archivos de organización (logo/firma)
   * Público ya que son recursos de branding
   */
  @Public()
  @Get('organization/:filename')
  async serveOrganizationFile(
    @Param('filename') filename: string,
    @Res() res: Response
  ) {
    // Sanitizar filename para evitar path traversal
    const sanitized = path.basename(filename);
    const filePath = path.join(process.cwd(), 'uploads', 'organization', sanitized);

    try {
      await fs.access(filePath);
      return res.sendFile(filePath);
    } catch {
      throw new NotFoundException('File not found');
    }
  }
}
