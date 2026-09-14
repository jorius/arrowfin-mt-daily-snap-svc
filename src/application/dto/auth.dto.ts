import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class IssueApiKeyDto {
  @ApiProperty({ example: 'T-005', description: 'Trader id. The login identifier is the id, not the email, so the auth payload carries no PII.' })
  @IsString()
  @Length(1, 32)
  traderId!: string;

  @ApiProperty({ example: 'correct horse battery staple', minLength: 8, maxLength: 256, description: 'Verified against a scrypt hash; never stored or logged.' })
  @IsString()
  @Length(8, 256)
  secret!: string;
}

export interface IssueApiKeyResult {
  apiKey: string;
  expiresAt: string;
  principal: { traderId: string; brokerId: string };
  portalName: string;
}
