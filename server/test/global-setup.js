/* once before all test files: bring gym_test up to the latest schema and empty it */
import { runMigrations } from '../src/migrate.js';
import { query, closePool } from '../src/db.js';

export async function setup() {
  if (!process.env.DATABASE_URL) return;
  if (!/\/gym_test(\?|$)/.test(process.env.DATABASE_URL)) throw new Error('Tests refuse to run on a database that is not gym_test.');
  await runMigrations();
  await query(`TRUNCATE users, clients, subs, measurements, products, expenses, visits, txns, sales, audit, sessions CASCADE`);
  await closePool();
}
