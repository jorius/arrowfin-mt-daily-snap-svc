import { Injectable, Logger } from '@nestjs/common';
import { type OnGatewayInit, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { AuthenticateApiKeyUseCase } from '../application/auth/authenticate-api-key.usecase.js';
import type { FillEvent, FillPublisher } from '../application/ports/fill-publisher.js';
import type { Principal } from '../application/principal.js';
import { ListAccountsUseCase } from '../application/snapshot/list-accounts.usecase.js';

export const room = (brokerId: string, accountId: string) => `broker:${brokerId}:account:${accountId}`;

/**
 * Tenant scoping happens once, in the handshake, before the connection is accepted.
 * Sockets are joined only to rooms derived from the principal's own accounts and
 * there is no client-to-server "subscribe" message at all.
 */
@Injectable()
@WebSocketGateway({ cors: { origin: process.env.CORS_ORIGIN ?? 'http://localhost:3000' } })
export class SnapshotGateway implements OnGatewayInit, FillPublisher {
  @WebSocketServer() server!: Server;
  private readonly log = new Logger(SnapshotGateway.name);

  constructor(
    private readonly authenticate: AuthenticateApiKeyUseCase,
    private readonly listAccounts: ListAccountsUseCase,
  ) {}

  afterInit(server: Server) {
    server.use((socket: Socket, next: (err?: Error) => void) => {
      void this.admit(socket).then(
        (principal) => {
          if (!principal) return next(new Error('unauthorized'));
          next();
        },
        () => next(new Error('unauthorized')),
      );
    });
  }

  private async admit(socket: Socket): Promise<Principal | null> {
    const raw: unknown = socket.handshake.auth?.apiKey;
    const apiKey = typeof raw === 'string' ? raw : null;
    const principal = apiKey ? await this.authenticate.execute(apiKey) : null;
    if (!principal) return null;
    const { accounts } = await this.listAccounts.execute(principal);
    socket.data.principal = principal;
    for (const account of accounts) await socket.join(room(principal.brokerId, account.id));
    this.log.log(
      `socket admitted trader=${principal.traderId} broker=${principal.brokerId} rooms=${accounts.length}`,
    );
    return principal;
  }

  publish(target: { brokerId: string; accountId: string }, event: FillEvent): void {
    this.server.to(room(target.brokerId, target.accountId)).emit('fill', event);
  }
}
