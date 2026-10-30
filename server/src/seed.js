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

/* ADMIN_PASSWORD (and optional ADMIN_USERNAME, default "admin") set in the environment: makes sure that account
   exists, is an admin and has this password. It is how the owner picks the first login, or gets back in after
   forgetting the password. Remove the variable after signing in: while it is set, every restart resets the
   password to this value. Returns 'created', 'reset' or null (not set or not valid). */
export async function applyEnvAdmin(env = process.env) {
  const password = env.ADMIN_PASSWORD;
  if (!password) return null;
  const username = String(env.ADMIN_USERNAME || 'admin').trim();
  if (!/^[A-Za-z0-9_.-]{3,30}$/.test(username)) {
    console.error('ADMIN_USERNAME ignored: use 3 to 30 letters, digits, dots, dashes or underscores.');
    return null;
  }
  if (password.length < 8) {
    console.error('ADMIN_PASSWORD ignored: it must be at least 8 characters.');
    return null;
  }
  const hash = await GYM.hashPassword(password);
  const n = GYM.now();
  const found = await query('SELECT id FROM users WHERE lower(username) = lower($1)', [username]);
  if (found.rowCount) {
    await query('UPDATE users SET password = $1, role = $2, client = NULL WHERE id = $3', [hash, 'admin', found.rows[0].id]);
    await query('DELETE FROM sessions WHERE user_id = $1', [found.rows[0].id]);   /* old sign-ins end */
  } else {
    await query('INSERT INTO users (id, username, password, role, created_at) VALUES ($1, $2, $3, $4, $5)',
      ['u' + GYM.uid(), username, hash, 'admin', n.iso]);
  }
  const result = found.rowCount ? 'reset' : 'created';
  await query('INSERT INTO audit (id, d, action, detail, created_at, by) VALUES ($1, $2, $3, $4, $5, $6)',
    [GYM.uid(), n.date, 'PASSWORD_RESET', username + ' (ADMIN_PASSWORD)', n.iso, 'server']);
  return result;   /* the password itself is never logged */
}
