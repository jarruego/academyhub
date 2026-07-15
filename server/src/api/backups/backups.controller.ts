import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { RoleGuard } from 'src/guards/role.guard';
import { Role } from 'src/guards/role.enum';
import { BackupsService } from './backups.service';
import { DownloadBackupDTO } from './dto/download-backup.dto';

@Controller('api/backups')
@UseGuards(RoleGuard([Role.ADMIN]))
export class BackupsController {
  constructor(private readonly backupsService: BackupsService) {}

  /** Últimas ejecuciones del workflow nocturno (GitHub Actions). Solo ADMIN. */
  @Get('status')
  async status() {
    return this.backupsService.getStatus();
  }

  /** Copias disponibles en el bucket externo. Solo ADMIN. */
  @Get('list')
  async list() {
    return this.backupsService.listBackups();
  }

  /** Lanza una copia manual ("Hacer copia ahora"). Queda en audit_log. Solo ADMIN. */
  @Post('run')
  async run() {
    return this.backupsService.triggerBackup();
  }

  /** URL temporal de descarga de una copia (cifrada). POST para que quede en audit_log. Solo ADMIN. */
  @Post('download-url')
  async downloadUrl(@Body() body: DownloadBackupDTO) {
    return this.backupsService.getDownloadUrl(body.key);
  }
}
