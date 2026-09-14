import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { HealthResponse } from '../application/dto/health.response.js';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOperation({ summary: 'Liveness probe (unauthenticated); used by the Railway health check.' })
  @ApiOkResponse({ type: HealthResponse })
  check(): HealthResponse {
    return { status: 'ok' };
  }
}
