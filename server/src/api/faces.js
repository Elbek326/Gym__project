import { Router } from 'express';
import GYM from '../../../client/src/core/gym.js';
import { query, tx } from '../db.js';
import { distance } from '../../../client/src/face/match.js';
import { audit } from '../audit.js';
import { requireStaff } from '../auth/middleware.js';
import { HttpError } from '../http.js';

/* face check-in data. Matching happens in the reception browser; the server only keeps descriptors
   (no images) and hands them to staff screens. Check-in itself uses the normal POST /members/:id/checkin,
   so every check-in rule (plan, frozen, once a day, training days) still applies. */
export const facesRouter = Router();
/* staff only, set per route: this router is mounted at /api, so a router-wide guard would also block other /api paths */

const SIZE = 128, MAX_SHOTS = 8;
const MAX_TOTAL = 20;     /* enrolment shots + learned ones per member */
const DUPLICATE = 0.15;   /* a learned descriptor closer than this to a stored one adds nothing */

function checkOne(v) {
  if (!Array.isArray(v) || v.length !== SIZE || !v.every((x) => typeof x === 'number' && Number.isFinite(x) && Math.abs(x) <= 2)) {
    throw new HttpError(400, 'The face data is not valid. Try again.');
  }
  return v.map((x) => Math.round(x * 1e6) / 1e6);
}

/* 1 to 8 arrays of 128 finite numbers each; anything else is refused */
function checkDescriptors(d) {
  if (!Array.isArray(d) || d.length < 1 || d.length > MAX_SHOTS) throw new HttpError(400, 'Take 1 to 8 face shots.');
  return d.map(checkOne);
}

async function member(id) {
  const r = await query('SELECT id, name FROM clients WHERE id = $1', [id]);
  if (!r.rowCount) throw new HttpError(404, 'Member not found.');
  return r.rows[0];
}

/* all enrolled members, for matching at the reception screen */
facesRouter.get('/faces', requireStaff, async (req, res) => {
  const r = await query(`SELECT c.id, c.name, c.image, f.descriptors || f.learned AS descriptors
                           FROM faces f JOIN clients c ON c.id = f.client ORDER BY c.name`);
  res.json(r.rows);
});

facesRouter.get('/members/:id/face', requireStaff, async (req, res) => {
  await member(req.params.id);
  const r = await query('SELECT jsonb_array_length(descriptors) AS shots, jsonb_array_length(learned) AS learned, consent_at FROM faces WHERE client = $1', [req.params.id]);
  res.json(r.rowCount ? { enrolled: true, shots: r.rows[0].shots, learned: r.rows[0].learned, consent_at: r.rows[0].consent_at } : { enrolled: false });
});

/* enrol or replace: { descriptors: [[128]...], consent: true } */
facesRouter.put('/members/:id/face', requireStaff, async (req, res) => {
  const b = req.body || {};
  if (b.consent !== true) throw new HttpError(400, 'The member must agree to face check-in first.');
  const c = await member(req.params.id);
  const d = checkDescriptors(b.descriptors);
  await query(`INSERT INTO faces (client, descriptors, learned, consent_at, created_by) VALUES ($1, $2, '[]', $3, $4)
               ON CONFLICT (client) DO UPDATE SET descriptors = EXCLUDED.descriptors, learned = '[]', consent_at = EXCLUDED.consent_at,
                 created_by = EXCLUDED.created_by, updated_at = now()`,
    [c.id, JSON.stringify(d), GYM.now().iso, req.user.username]);
  await audit('FACE_ENROLLED', c.name, req.user.id);
  res.json({ ok: true, shots: d.length });
});

/* self-learning: a confident live check-in adds its (smoothed) descriptor as one more view of the member.
   { descriptor: [128] }. Enrolment shots are never touched; learned ones fill the room left under MAX_TOTAL and,
   when it is full, the oldest learned one is replaced. Near-duplicates are skipped. Needs an existing face record
   (which only exists with consent). */
facesRouter.post('/members/:id/face/learn', requireStaff, async (req, res) => {
  const d = checkOne((req.body || {}).descriptor);
  const c = await member(req.params.id);
  const out = await tx(async (db) => {
    const r = await db.query('SELECT descriptors, learned FROM faces WHERE client = $1 FOR UPDATE', [c.id]);
    if (!r.rowCount) throw new HttpError(404, 'This member has no face enrolled.');
    const orig = r.rows[0].descriptors, learned = r.rows[0].learned;
    if (orig.concat(learned).some((x) => distance(x, d) < DUPLICATE)) return { added: false, reason: 'duplicate', learned };
    const room = Math.max(0, MAX_TOTAL - orig.length);
    if (!room) return { added: false, reason: 'full', learned };
    const next = learned.concat([d]);
    while (next.length > room) next.shift();   /* drop the oldest learned ones */
    await db.query('UPDATE faces SET learned = $2, updated_at = now() WHERE client = $1', [c.id, JSON.stringify(next)]);
    return { added: true, learned: next };
  });
  res.json({ ok: true, added: out.added, reason: out.reason, learned: out.learned.length });
});

facesRouter.delete('/members/:id/face', requireStaff, async (req, res) => {
  const c = await member(req.params.id);
  const r = await query('DELETE FROM faces WHERE client = $1', [c.id]);
  if (r.rowCount) await audit('FACE_DELETED', c.name, req.user.id);
  res.json({ ok: true, deleted: r.rowCount > 0 });
});
