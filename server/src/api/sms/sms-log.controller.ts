import { Controller, Get, Post, Param, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { SmsService } from './sms.service';
import { RoleGuard } from '../../guards/role.guard';
import { Role } from '../../guards/role.enum';

/** Registro de envíos de SMS: solo ADMIN, mismo criterio que email-log. */
@Controller('sms-log')
export class SmsLogController {
  constructor(private readonly smsService: SmsService) {}

  @Get()
  @UseGuards(RoleGuard([Role.ADMIN]))
  async list(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('actor') actor?: string,
    @Query('recipient') recipient?: string,
  ) {
    return this.smsService.listLog({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      status,
      actor,
      recipient,
    });
  }

  @Post(':id/refresh-status')
  @UseGuards(RoleGuard([Role.ADMIN]))
  async refreshStatus(@Param('id', ParseIntPipe) id: number) {
    return this.smsService.refreshLogStatus(id);
  }
}
