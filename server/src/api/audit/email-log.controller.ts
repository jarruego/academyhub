import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { RoleGuard } from 'src/guards/role.guard';
import { Role } from 'src/guards/role.enum';
import { AuditService } from './audit.service';

@Controller('email-log')
export class EmailLogController {
  constructor(private readonly auditService: AuditService) {}

  /** Consulta paginada del registro de envíos de correo. Solo ADMIN. */
  @Get()
  @UseGuards(RoleGuard([Role.ADMIN]))
  async list(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('actor') actor?: string,
    @Query('recipient') recipient?: string,
  ) {
    return this.auditService.getEmailLog({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      status,
      actor,
      recipient,
    });
  }
}
