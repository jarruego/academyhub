import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { RoleGuard } from 'src/guards/role.guard';
import { Role } from 'src/guards/role.enum';
import { AuditService } from './audit.service';

@Controller('audit-log')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  /** Consulta paginada del registro de auditoría. Solo ADMIN. */
  @Get()
  @UseGuards(RoleGuard([Role.ADMIN]))
  async list(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('method') method?: string,
    @Query('actor') actor?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.auditService.getAuditLog({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      method,
      actor,
      from,
      to,
    });
  }
}
