import { randomBytes, createHash } from 'node:crypto';
import { query } from '../db.js';

export const COOKIE = 'gym_sid';
const IDLE_HOURS = 12;   /* a session ends after 12 hours without any request; every request pushes it forward */

function hashToken(t) { return createHash('sha256').update(t).digest('hex'); }

/* new session for a user: returns the raw token for the cookie (only its hash is stored) */
export async function createSession(userId) {
  const token = randomBytes(32).toString('base64url');
  await query(`INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, now() + interval '${IDLE_HOURS} hours')`,
    [hashToken(token), userId]);
  query('DELETE FROM sessions WHERE expires_at < now()').catch(() => {});   /* tidy up, never blocks the sign-in */
  return token;
}

/* the signed-in user for a token, or null. Also slides the expiry forward. */
export async function findSession(token) {
  if (!token) return null;
  const r = await query(
    `UPDATE sessions SET last_seen = now(), expires_at = now() + interval '${IDLE_HOURS} hours'
       WHERE token_hash = $1 AND expires_at > now()
     RETURNING user_id`, [hashToken(token)]);
  if (!r.rowCount) return null;
  const u = await query('SELECT id, username, password, role, client, created_at FROM users WHERE id = $1', [r.rows[0].user_id]);
  return u.rows[0] || null;
}

export async function destroySession(token) {
  if (token) await query('DELETE FROM sessions WHERE token_hash = $1', [hashToken(token)]);
}

/* after a password change: sign the user out on every other device */
export async function destroyOtherSessions(userId, keepToken) {
  await query('DELETE FROM sessions WHERE user_id = $1 AND token_hash <> $2', [userId, hashToken(keepToken)]);
}

export function cookieOptions(isProd) {
  return {
    httpOnly: true,            /* page scripts cannot read it, so an XSS bug cannot steal the session */
    sameSite: 'lax',           /* not sent on cross-site POSTs */
    secure: isProd,            /* HTTPS only in production */
    path: '/',
    maxAge: IDLE_HOURS * 3600 * 1000
  };
}

/* reads one cookie without an extra dependency */
export function readCookie(req, name) {
  const raw = req.headers.cookie || '';
  for (const part of raw.split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) {
      try { return decodeURIComponent(part.slice(i + 1).trim()); } catch { return null; }
    }
  }
  return null;
}
