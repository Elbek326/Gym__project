/* creates the first admin when the users table is empty, the same account the artifact made:
   admin / admin123. Change the password right after the first sign-in. */
import GYM from '../../client/src/core/gym.js';
import { query, closePool } from '../src/db.js';

async function main() {
  const { rows } = await query('SELECT count(*)::int AS n FROM users');
  if (rows[0].n > 0) { console.log('Users already exist, nothing to seed.'); return; }
  const hash = await GYM.hashPassword('admin123');   /* same PBKDF2 format as the core, so old backups keep working */
  await query('INSERT INTO users (id, username, password, role, created_at) VALUES ($1, $2, $3, $4, $5)',
    ['u_admin', 'admin', hash, 'admin', GYM.now().iso]);
  console.log('Created admin / admin123. Change this password after the first sign-in.');
}

main().catch((err) => { console.error('Seed failed:', err.message); process.exitCode = 1; }).finally(closePool);
