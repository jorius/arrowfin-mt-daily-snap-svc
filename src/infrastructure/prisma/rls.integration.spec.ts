/**
 * Integration check for the row-level security migration. Runs only when a
 * DATABASE_URL is available (local .env); it reads inside a rolled-back
 * transaction and writes nothing.
 */
import 'dotenv/config';
import pg from 'pg';

const url = process.env.DATABASE_URL;

describe.skipIf(!url)('row-level security', () => {
  async function withTenant<T>(brokerId: string | null, fn: (c: pg.Client) => Promise<T>): Promise<T> {
    const client = new pg.Client({ connectionString: url });
    await client.connect();
    try {
      await client.query('BEGIN');
      await client.query('SET LOCAL ROLE arrowfin_tenant');
      if (brokerId) await client.query("SELECT set_config('app.broker_id', $1, true)", [brokerId]);
      return await fn(client);
    } finally {
      await client.query('ROLLBACK').catch(() => undefined);
      await client.end();
    }
  }

  it('hides another tenant\'s account even when the query forgets WHERE broker_id', async () => {
    const asMeridian = await withTenant('BRK-MRDN', (c) =>
      c.query("SELECT count(*)::int AS n FROM fills WHERE account_id = 'ACC-1006'"),
    );
    expect(asMeridian.rows[0].n).toBe(0);

    const asSummit = await withTenant('BRK-SMPT', (c) =>
      c.query("SELECT count(*)::int AS n FROM fills WHERE account_id = 'ACC-1006'"),
    );
    expect(asSummit.rows[0].n).toBeGreaterThan(0);
  });

  it('shows exactly one broker to a tenant transaction, and nothing without a tenant', async () => {
    const brokers = await withTenant('BRK-ARWP', (c) => c.query('SELECT count(DISTINCT broker_id)::int AS n FROM fills'));
    expect(brokers.rows[0].n).toBe(1);
    const none = await withTenant(null, (c) => c.query('SELECT count(*)::int AS n FROM traders'));
    expect(none.rows[0].n).toBe(0);
  });
});
