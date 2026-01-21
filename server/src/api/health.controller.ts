import { Controller, Get, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('Health')
@Controller('api/health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  @Get('ping')
  @ApiOperation({ summary: 'Ping de prueba sin autenticación' })
  @ApiResponse({ 
    status: 200, 
    description: 'Pong'
  })
  ping() {
    this.logger.log('[PING] Endpoint de prueba llamado');
    return { pong: true, timestamp: new Date().toISOString() };
  }
}
