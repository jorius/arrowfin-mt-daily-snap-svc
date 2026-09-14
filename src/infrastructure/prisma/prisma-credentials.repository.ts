import { Injectable } from '@nestjs/common';
import type { CredentialRecord, CredentialsRepository } from '../../application/ports/credentials.repository.js';
import { PrismaService } from './prisma.service.js';

/** Selects only what authentication needs: never name, contact, notes or audit columns. */
@Injectable()
export class PrismaCredentialsRepository implements CredentialsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByTraderId(traderId: string): Promise<CredentialRecord | null> {
    const row = await this.prisma.trader.findUnique({
      where: { id: traderId },
      select: {
        id: true,
        brokerId: true,
        kycStatus: true,
        credential: { select: { secretHash: true } },
        broker: { select: { whiteLabelName: true } },
      },
    });
    if (!row?.credential) return null;
    return {
      traderId: row.id,
      brokerId: row.brokerId,
      secretHash: row.credential.secretHash,
      kycStatus: row.kycStatus,
      portalName: row.broker.whiteLabelName,
    };
  }
}
