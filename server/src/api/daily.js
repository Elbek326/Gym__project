import { Router } from 'express';
import { call } from './call.js';
import { requireStaff } from '../auth/middleware.js';
import { HttpError } from '../http.js';

/* "Today's arrivals": members who checked in on a day, and day-pass guests (people who pay for one visit without
   being members). A day pass is an ordinary income row with category 'day pass'; the guest's name and phone are
   kept in its note, so it shows in Finance too. Staff only. */
export const dailyRouter = Router();
dailyRouter.use(requireStaff);   /* mounted at /api/daily only, so this guards just these routes */

function day(G, v) {
  const d = v ? String(v) : G.now().date;
  if (!G.isDate(d)) throw new HttpError(400, 'Date is not valid.');
  return d;
}
function brief(c) { return c ? { id: c.id, name: c.name, image: c.image || null } : null; }

/* GET /api/daily?date=YYYY-MM-DD (default today), newest first */
dailyRouter.get('/', async (req, res) => {
  res.json(await call(req, (G) => {
    G.requireStaff();
    const date = day(G, req.query.date);
    const S = G.S();
    const visits = G.values('visits').filter((v) => v.visit_date === date)
      .sort((a, b) => b.visit_time.localeCompare(a.visit_time))
      .map((v) => {
        const c = S.clients[v.client] || null; const sub = c ? G.activeSub(c.id) : null;
        return { id: v.id, time: v.visit_time, member: brief(c), remaining: sub ? G.subRemaining(sub, date) : null, sub_type: sub ? sub.sub_type : null };
      });
    const dayPasses = G.values('txns').filter((t) => t.txn_type === 'income' && t.category === 'day pass' && t.d === date)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((t) => ({ id: t.id, time: t.created_at.slice(11, 16), name: t.note || '', amount: t.amount, note: t.note || '' }));
    const amount = dayPasses.reduce((s, p) => s + p.amount, 0);
    return { date, visits, dayPasses, totals: { visits: visits.length, dayPasses: dayPasses.length, dayPassAmount: Math.round(amount * 100) / 100 } };
  }));
});

/* POST /api/daily/day-pass { name?, phone?, amount } → the new entry, timed now */
dailyRouter.post('/day-pass', async (req, res) => {
  const b = req.body || {};
  const name = String(b.name || '').trim().slice(0, 80), phone = String(b.phone || '').trim().slice(0, 30);
  const note = [name, phone].filter(Boolean).join(' · ');
  const t = await call(req, (G) => G.addIncome({ category: 'day pass', amount: b.amount, note }));
  res.status(201).json({ id: t.id, time: t.created_at.slice(11, 16), name: note, amount: t.amount, note });
});
