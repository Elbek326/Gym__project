import { Router } from 'express';
import { call } from './call.js';
import { requireStaff } from '../auth/middleware.js';
import { HttpError } from '../http.js';

/* money in and out of the gym (not member debts): month view, expenses, other income. Staff only. */
export const financeRouter = Router();
financeRouter.use(requireStaff);

function month(req) {
  const ym = String(req.query.month || '');
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(ym)) throw new HttpError(400, 'Month must look like 2026-10.');
  return ym;
}

/* GET /api/finance?month=2026-10: totals, income and expense lists, per-day and per-category sums */
financeRouter.get('/', async (req, res) => {
  const ym = month(req);
  res.json(await call(req, (G) => G.financeMonth(ym)));
});

financeRouter.post('/expenses', async (req, res) => {
  const b = req.body || {};
  res.status(201).json(await call(req, (G) => G.addExpense({ category: b.category, amount: b.amount, date: b.date, note: b.note })));
});
financeRouter.delete('/expenses/:id', async (req, res) => {
  await call(req, (G) => G.deleteExpense(req.params.id));
  res.json({ ok: true });
});

financeRouter.post('/income', async (req, res) => {
  const b = req.body || {};
  res.status(201).json(await call(req, (G) => G.addIncome({ category: b.category, amount: b.amount, date: b.date, note: b.note })));
});
financeRouter.delete('/income/:id', async (req, res) => {
  await call(req, (G) => G.deleteIncome(req.params.id));
  res.json({ ok: true });
});
