import GYM from '../../../client/src/core/gym.js';
import { query } from '../db.js';

/* which check-in refusals count as "came, but was not let in". "Already checked in today" is not one: that visit is
   already on the list. Matched on the core's own messages (see checkIn in client/src/core/gym.js). */
const REASONS = [
  [/ is frozen\. /, 'frozen'],
  [/ has no active subscription\.$/, 'no_plan'],
  [/ has no sessions left\.$/, 'finished'],
  [/^The subscription of .+ expired on /, 'expired'],
  [/ is not a training day for /, 'not_training_day']
];
export function deniedReason(message) {
  const hit = REASONS.find(([re]) => re.test(String(message || '')));
  return hit ? hit[1] : null;
}

/* one row per member per day: standing in front of the camera for a minute is still one arrival */
export async function recordDenied(clientId, reason, message) {
  const n = GYM.now();
  await query(`INSERT INTO denied_arrivals (id, client, d, time, reason, message, created_at)
               SELECT $1, $2, $3, $4, $5, $6, $7 WHERE EXISTS (SELECT 1 FROM clients WHERE id = $2)
               ON CONFLICT (client, d) DO NOTHING`,
    [GYM.uid(), clientId, n.date, n.time, reason, String(message).slice(0, 300), n.iso]);
}

/* the day's refused arrivals, minus members who were checked in later the same day */
export async function deniedOn(date) {
  const { rows } = await query(
    `SELECT a.id, a.time, a.reason, a.message, c.id AS cid, c.name, c.image
       FROM denied_arrivals a JOIN clients c ON c.id = a.client
      WHERE a.d = $1 AND NOT EXISTS (SELECT 1 FROM visits v WHERE v.client = a.client AND v.visit_date = a.d)
      ORDER BY a.time DESC`, [date]);
  return rows.map((r) => ({ id: r.id, time: r.time, reason: r.reason, message: r.message, member: { id: r.cid, name: r.name, image: r.image || null } }));
}
