import { Body, Controller, Delete, HttpCode, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { IssueApiKeyUseCase } from '../application/auth/issue-api-key.usecase.js';
import { RevokeApiKeyUseCase } from '../application/auth/revoke-api-key.usecase.js';
import { IssueApiKeyDto, type IssueApiKeyResult } from '../application/dto/auth.dto.js';
import { IssueApiKeyResponse } from '../application/dto/auth.response.js';
import { ErrorResponse } from '../application/dto/error.response.js';
import type { Principal } from '../application/principal.js';
import { CurrentPrincipal } from './decorators/principal.decorator.js';
import { ApiKeyGuard } from './guards/api-key.guard.js';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly issueApiKey: IssueApiKeyUseCase,
    private readonly revokeApiKey: RevokeApiKeyUseCase,
  ) {}

  @Post('api/key')
  @HttpCode(201)
  @ApiOperation({
    summary: 'Exchange a trader id and secret for an opaque API key.',
    description:
      'The secret is verified against its scrypt hash (a dummy comparison runs for unknown ids so timing reveals nothing). The key is returned once; only its sha256 is stored, together with the broker_id resolved from the trader row.',
  })
  @ApiCreatedResponse({ type: IssueApiKeyResponse })
  @ApiUnauthorizedResponse({ type: ErrorResponse, description: 'Unknown trader id or wrong secret (same response for both).' })
  @ApiForbiddenResponse({ type: ErrorResponse, description: 'Correct secret, but the trader is suspended.' })
  issue(@Body() dto: IssueApiKeyDto): Promise<IssueApiKeyResult> {
    return this.issueApiKey.execute(dto);
  }

  @Delete('api/key')
  @UseGuards(ApiKeyGuard)
  @HttpCode(204)
  @ApiBearerAuth('api-key')
  @ApiOperation({ summary: 'Revoke the API key that authenticates this call.', description: 'The next request with the same key returns 401.' })
  @ApiNoContentResponse({ description: 'Revoked.' })
  @ApiUnauthorizedResponse({ type: ErrorResponse })
  async revoke(@CurrentPrincipal() principal: Principal): Promise<void> {
    await this.revokeApiKey.execute(principal);
  }
}
