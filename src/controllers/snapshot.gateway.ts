import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  type OnGatewayConnection,
  type OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { AuthenticateApiKeyUseCase } from '../application/auth/authenticate-api-key.usecase.js';
import { CLOCK, type Clock } from '../application/ports/clock.js';
import type { FillEvent, FillPublisher } from '../application/ports/fill-publisher.js';
import type { Principal } from '../application/principal.js';
import { ListAccountsUseCase } from '../application/snapshot/list-accounts.usecase.js';
import { loadWsOptions } from '../infrastructure/config/env.js';

export const room = (brokerId: string, accountId: string) => `broker:${brokerId}:account:${accountId}`;

/** Heartbeat settings are read once, at import time, because decorator options are evaluated then. */
export const WS_OPTIONS = loadWsOptions();

/** Sent to a socket right after it is admitted. Carries configuration only: no ids, no PII. */
export interface HelloEvent {
  serverTime: string;
  pingIntervalMs: number;
  pingTimeoutMs: number;
  connectTimeoutMs: number;
  transport: string;
  rooms: number;
}

/**
 * Tenant scoping happens once, in the handshake, before the connection is accepted.
 * Sockets are joined only to rooms derived from the principal's own accounts and
 * there is no client-to-server "subscribe" message at all.
 */
@Injectable()
@WebSocketGateway({
  cors: { origin: process.env.CORS_ORIGIN ?? 'http://localhost:3000' },
  pingInterval: WS_OPTIONS.pingIntervalMs,
  pingTimeout: WS_OPTIONS.pingTimeoutMs,
  connectTimeout: WS_OPTIONS.connectTimeoutMs,
})
export class SnapshotGateway implements OnGatewayInit, OnGatewayConnection, FillPublisher {
  @WebSocketServer() server!: Server;
  private readonly log = new Logger(SnapshotGateway.name);

  constructor(
    private readonly authenticate: AuthenticateApiKeyUseCase,
    private readonly listAccounts: ListAccountsUseCase,
    @Inject(CLOCK) private readonly clock: Clock,
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

  /** Runs only for admitted sockets: tells the client which heartbeat it is on. */
  handleConnection(socket: Socket) {
    const hello: HelloEvent = {
      serverTime: this.clock.now().toISOString(),
      pingIntervalMs: WS_OPTIONS.pingIntervalMs,
      pingTimeoutMs: WS_OPTIONS.pingTimeoutMs,
      connectTimeoutMs: WS_OPTIONS.connectTimeoutMs,
      transport: socket.conn.transport.name,
      // socket.rooms always contains the socket's own id; the rest are account rooms.
      rooms: Math.max(0, socket.rooms.size - 1),
    };
    socket.emit('hello', hello);
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
