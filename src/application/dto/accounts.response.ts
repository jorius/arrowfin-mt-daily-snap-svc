import { ApiProperty } from '@nestjs/swagger';

export class AccountSummaryResponse {
  @ApiProperty({ example: 'ACC-1006' })
  id!: string;

  @ApiProperty({ example: 'SMT-200001' })
  accountNumber!: string;

  @ApiProperty({ example: 'pro_plus', enum: ['funded', 'demo', 'eval', 'pro', 'pro_plus'] })
  accountType!: string;

  @ApiProperty({ example: 'active', enum: ['active', 'restricted', 'closed'] })
  status!: string;
}

export class AccountsResponse {
  @ApiProperty({ type: [AccountSummaryResponse], description: 'Accounts owned by the caller inside their tenant. Balances travel only in the snapshot.' })
  accounts!: AccountSummaryResponse[];
}
