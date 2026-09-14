import { IsString, Length } from 'class-validator';

export class IssueApiKeyDto {
  @IsString()
  @Length(1, 32)
  traderId!: string;

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
