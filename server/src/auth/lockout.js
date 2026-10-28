/* sign-in throttling, same rule as the artifact: 5 wrong passwords -> 30 seconds locked.
   Counted per IP address and username, so one person mistyping does not lock out the whole desk.
   Kept in memory: enough for a single server process; it resets on restart. */
const MAX_FAILS = 5;
const LOCK_MS = 30000;
const entries = new Map();   /* key -> { fails, lockedUntil } */

function key(ip, username) { return ip + '|' + String(username || '').trim().toLowerCase(); }

/* seconds left if locked, else 0 */
export function lockedFor(ip, username, now = Date.now()) {
  const e = entries.get(key(ip, username));
  return e && e.lockedUntil > now ? Math.ceil((e.lockedUntil - now) / 1000) : 0;
}

export function recordFailure(ip, username, now = Date.now()) {
  const k = key(ip, username);
  const e = entries.get(k) || { fails: 0, lockedUntil: 0 };
  e.fails++;
  if (e.fails >= MAX_FAILS) { e.lockedUntil = now + LOCK_MS; e.fails = 0; }
  entries.set(k, e);
  if (entries.size > 10000) entries.clear();   /* memory guard against a flood of random usernames */
}

export function recordSuccess(ip, username) { entries.delete(key(ip, username)); }

export function _resetLockouts() { entries.clear(); }   /* tests */
