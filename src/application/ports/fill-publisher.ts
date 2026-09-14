export const FILL_PUBLISHER = Symbol('FILL_PUBLISHER');

/** What travels over the socket: no names, balances or notes. */
export interface FillEvent {
  id: string;
  accountId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  filledAt: string;
}

export interface FillPublisher {
  publish(target: { brokerId: string; accountId: string }, event: FillEvent): void;
}
