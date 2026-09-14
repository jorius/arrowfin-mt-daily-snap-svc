export const MARKET_PRICES_REPOSITORY = Symbol('MARKET_PRICES_REPOSITORY');

export interface InstrumentMark {
  symbol: string;
  description: string;
  pointValue: number;
  markPrice: number;
  asOf: Date;
}

/** Reference data shared by every tenant: the one port besides credentials without a TenantContext. */
export interface MarketPricesRepository {
  marksFor(symbols: string[]): Promise<Map<string, InstrumentMark>>;
}
