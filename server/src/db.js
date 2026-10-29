import pg from 'pg';
import { config } from './config.js';

/* DATE columns come back as 'YYYY-MM-DD' strings, the same shape the GYM core uses, instead of JS Dates
   (a JS Date would shift the day by the server's time zone) */
pg.types.setTypeParser(pg.types.builtins.DATE, (v) => v);
/* TIMESTAMP (no zone) columns hold Tashkent local time; give them back in the core's own shape
   'YYYY-MM-DDTHH:MM:SS' instead of a JS Date that would be read in the server's time zone */
pg.types.setTypeParser(pg.types.builtins.TIMESTAMP, (v) => (v == null ? null : v.replace(' ', 'T').slice(0, 19)));
/* NUMERIC money columns come back as numbers; amounts stay far below 2^53 */
pg.types.setTypeParser(pg.types.builtins.NUMERIC, (v) => (v == null ? null : Number(v)));

let pool = null;

export function getPool() {
  if (!pool) {
    pool = new pg.Pool({ connectionString: config.databaseUrl, max: 10 });
    pool.on('error', (err) => console.error('PostgreSQL pool error:', err.message));
  }
  return pool;
}

export function query(text, params) {
  return getPool().query(text, params);
}

/* runs fn(client) inside one transaction: all of it is saved, or none of it */
export async function tx(fn) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const out = await fn(client);
    await client.query('COMMIT');
    return out;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function closePool() {
  if (pool) { await pool.end(); pool = null; }
}
