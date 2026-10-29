import { Router } from 'express';
import { call } from './call.js';
import { requireStaff, requireUser } from '../auth/middleware.js';
import { HttpError } from '../http.js';

/* read-only views: dashboard, analytics, rankings, audit log */
export const reportsRouter = Router();

function month(v) {
  const ym = String(v || '');
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(ym)) throw new HttpError(400, 'Month must look like 2026-10.');
  return ym;
}
/* the few member fields a list row needs (no note, no debt history) */
function brief(c) { return c ? { id: c.id, name: c.name, image: c.image || null } : null; }

reportsRouter.get('/dashboard', requireStaff, async (req, res) => {
  res.json(await call(req, (G) => {
    const D = G.dashboard();
    const S = G.S();
    /* today's visits with the member and what is left on their plan, as the dashboard list shows */
    D.todays = D.todays.map((v) => {
      const c = S.clients[v.client]; const sub = c ? G.activeSub(c.id) : null;
      return { ...v, member: brief(c), remaining: sub ? G.subRemaining(sub, D.today) : null, sub_type: sub ? sub.sub_type : null };
    });
    D.expiring = D.expiring.map((e) => ({ member: brief(e.c), rem: e.rem, label: e.label, urgency: e.urgency }));
    D.members_total = G.values('clients').length;
    D.has_sample = G.hasSample();
    return D;
  }));
});

/* GET /api/analytics?month=2026-10 */
reportsRouter.get('/analytics', requireStaff, async (req, res) => {
  const ym = month(req.query.month);
  res.json(await call(req, (G) => ({
    report: G.monthlyReport(ym),
    newMembers: G.newMembers(ym).map((c) => ({ ...brief(c), created_at: c.created_at })),
    lost: G.lostMembers().map((x) => ({ member: brief(x.c), last: x.last, gap: x.gap, status: x.status })),
    attendance: G.attendanceSeries(30)
  })));
});

/* top 50, plus the caller's own row if a member is further down. Photos only where shown. */
reportsRouter.get('/rankings', requireUser, async (req, res) => {
  res.json(await call(req, (G) => {
    const all = G.rankings();
    const staff = G.isStaff(G.me());
    const rows = all.map((r, i) => ({ n: i + 1, r }));
    const out = rows.slice(0, 50);
    if (!staff) { const mine = rows.find((x) => x.r.me); if (mine && mine.n > 50) out.push(mine); }
    return {
      staff,
      rows: out.map(({ n, r }) => ({
        n, member: brief(r.c), visits: r.visits, months: r.months, score: r.score,
        me: !!r.me, ...(staff ? { paid: r.paid } : {})
      }))
    };
  }));
});

/* GET /api/audit?q=login&page=2: newest first, 50 per page */
reportsRouter.get('/audit', requireStaff, async (req, res) => {
  const q = String(req.query.q || '').trim().toLowerCase();
  res.json(await call(req, (G) => {
    let rows = G.listAudit().sort((a, b) => b.created_at.localeCompare(a.created_at) || (b.id < a.id ? -1 : 1));
    if (q) rows = rows.filter((r) => (r.action + ' ' + r.detail + ' ' + r.by).toLowerCase().includes(q));
    return G.paginate(rows, req.query.page, 50);
  }));
});
