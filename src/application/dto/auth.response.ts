import { ApiProperty } from '@nestjs/swagger';

export class PrincipalResponse {
  @ApiProperty({ example: 'T-005' })
  traderId!: string;

  @ApiProperty({ example: 'BRK-SMPT', description: 'Tenant key, resolved server-side from the trader row; never taken from the request.' })
  brokerId!: string;
}

export class IssueApiKeyResponse {
  @ApiProperty({
    example: 'afk_2f9c…',
    description: 'Opaque bearer key. Shown once; only its sha256 is stored. Send it as `Authorization: Bearer afk_…` and as `auth.apiKey` in the Socket.IO handshake.',
  })
  apiKey!: string;

  @ApiProperty({ example: '2026-08-26T02:30:00.000Z', description: 'Expiry on the server clock (API_KEY_TTL_HOURS after issuance).' })
  expiresAt!: string;

  @ApiProperty({ type: PrincipalResponse })
  principal!: PrincipalResponse;

  @ApiProperty({ example: 'Summit Trader Portal', description: "The broker's white-label name, for the portal header." })
  portalName!: string;
}
