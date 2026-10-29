import { randomBytes } from 'node:crypto';
import GYM from '../../client/src/core/gym.js';
import { query } from './db.js';

/* creates the first admin when there are no users at all. Returns the password it set, or null.
   - random: true (production): a new random password, shown once in the log. Nobody can guess it.
   - random: false (local development): the well-known admin / admin123. */
export async function ensureFirstAdmin({ random }) {
  const { rows } = await query('SELECT count(*)::int AS n FROM users');
  if (rows[0].n > 0) return null;
  const password = random ? randomBytes(12).toString('base64url') : 'admin123';
  await query('INSERT INTO users (id, username, password, role, created_at) VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING',
    ['u_admin', 'admin', await GYM.hashPassword(password), 'admin', GYM.now().iso]);
  return password;
}
