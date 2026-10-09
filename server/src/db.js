import pg from 'pg';

// Return DECIMAL/numeric as JS numbers (rating, weight, volume) instead of strings.
pg.types.setTypeParser(1700, parseFloat);
// bigint (COUNT) as number — our counts are tiny.
pg.types.setTypeParser(20, parseInt);

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://sanflow:sanflow@127.0.0.1:54329/sanflow',
  // serverless functions open many short-lived instances — keep each one's pool small (Neon's pooler does the rest)
  max: Number(process.env.PG_POOL_MAX) || 10,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
});

export const query = (text, params) => pool.query(text, params);

// Run `fn(client)` inside a transaction.
export async function tx(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
