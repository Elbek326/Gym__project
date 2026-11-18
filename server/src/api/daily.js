import { Router } from 'express';
import { call } from './call.js';
import { requireStaff } from '../auth/middleware.js';
import { HttpError } from '../http.js';
import { deniedOn } from './denied.js';

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
  const out = await call(req, (G) => {
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
    return {
      date, visits, dayPasses,
      totals: { visits: visits.length, dayPasses: dayPasses.length, dayPassAmount: r2(amount) },
      stats: dayStats(G, date)
    };
  });
  /* recognised at the entrance but not let in (frozen, no plan, expired...), shown apart */
  out.denied = await deniedOn(out.date);
  out.totals.denied = out.denied.length;
  out.stats.denied = out.denied.length;
  res.json(out);
});

function r2(x) { return Math.round(x * 100) / 100; }
function isDayPass(t) { return t.txn_type === 'income' && t.category === 'day pass'; }

/* one day in numbers: arrivals, money in and out, new members, arrivals per hour, and yesterday for comparison */
function dayStats(G, date) {
  const sum = (list, f) => r2(list.reduce((s, x) => s + f(x), 0));
  const txns = G.values('txns').filter((t) => t.d === date);
  const payments = sum(txns.filter((t) => t.txn_type === 'payment'), (t) => t.amount);
  const income = sum(txns.filter((t) => t.txn_type === 'income'), (t) => t.amount);
  const sales = sum(G.values('sales').filter((s) => s.d === date), (s) => s.total);
  const expenses = sum(G.values('expenses').filter((e) => e.date === date), (e) => e.amount);
  const revenue = r2(payments + income + sales);

  const byHour = Array.from({ length: 24 }, (_, hour) => ({ hour, visits: 0, dayPasses: 0 }));
  G.values('visits').forEach((v) => { if (v.visit_date === date) byHour[+v.visit_time.slice(0, 2)].visits++; });
  txns.forEach((t) => { if (isDayPass(t)) byHour[+t.created_at.slice(11, 13)].dayPasses++; });

  const y = G.addDays(date, -1);
  const yTxns = G.values('txns').filter((t) => t.d === y);
  const yesterday = {
    visits: G.values('visits').filter((v) => v.visit_date === y).length,
    dayPasses: yTxns.filter(isDayPass).length,
    revenue: r2(sum(yTxns.filter((t) => t.txn_type === 'payment' || t.txn_type === 'income'), (t) => t.amount)
      + sum(G.values('sales').filter((s) => s.d === y), (s) => s.total))
  };

  return {
    newMembers: G.values('clients').filter((c) => c.created_at.slice(0, 10) === date).length,
    revenue, payments, income, sales, expenses, profit: r2(revenue - expenses), byHour, yesterday
  };
}

/* POST /api/daily/day-pass { name?, phone?, amount } → the new entry, timed now */
dailyRouter.post('/day-pass', async (req, res) => {
  const b = req.body || {};
  const name = String(b.name || '').trim().slice(0, 80), phone = String(b.phone || '').trim().slice(0, 30);
  const note = [name, phone].filter(Boolean).join(' · ');
  const t = await call(req, (G) => G.addIncome({ category: 'day pass', amount: b.amount, note }));
  res.status(201).json({ id: t.id, time: t.created_at.slice(11, 16), name: note, amount: t.amount, note });
});
