import { Body, Controller, Delete, HttpCode, Post, UseGuards } from '@nestjs/common';
import { IssueApiKeyUseCase } from '../application/auth/issue-api-key.usecase.js';
import { RevokeApiKeyUseCase } from '../application/auth/revoke-api-key.usecase.js';
import { IssueApiKeyDto } from '../application/dto/auth.dto.js';
import type { Principal } from '../application/principal.js';
import { CurrentPrincipal } from './decorators/principal.decorator.js';
import { ApiKeyGuard } from './guards/api-key.guard.js';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly issueApiKey: IssueApiKeyUseCase,
    private readonly revokeApiKey: RevokeApiKeyUseCase,
  ) {}

  @Post('api/key')
  @HttpCode(201)
  issue(@Body() dto: IssueApiKeyDto) {
    return this.issueApiKey.execute(dto);
  }

  @Delete('api/key')
  @UseGuards(ApiKeyGuard)
  @HttpCode(204)
  async revoke(@CurrentPrincipal() principal: Principal): Promise<void> {
    await this.revokeApiKey.execute(principal);
  }
}
