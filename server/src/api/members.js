import { Router } from 'express';
import { call } from './call.js';
import { requireStaff, requireUser } from '../auth/middleware.js';

/* members and their subscriptions. Every rule lives in the core; these routes only translate HTTP to core calls.
   Staff-only routes are guarded twice: here (fast 403) and again inside the core. */
export const membersRouter = Router();
const PER_PAGE = 25;

/* the fields a member form may send; nothing else reaches the core */
function memberFields(b = {}) {
  return {
    name: b.name, phone: b.phone, note: b.note, days: b.days, image: b.image,
    login: b.login, password: b.password, plan: b.plan
  };
}

/* list with search, status filter and paging: GET /api/members?q=ali&filter=active&page=2 */
membersRouter.get('/', requireStaff, async (req, res) => {
  const out = await call(req, (G) => {
    const R = G.memberRows({ q: req.query.q, filter: req.query.filter });
    return { counts: R.counts, ...G.paginate(R.rows, req.query.page, PER_PAGE) };
  });
  res.json(out);
});

membersRouter.post('/', requireStaff, async (req, res) => {
  res.status(201).json(await call(req, (G) => G.createClient(memberFields(req.body))));
});

/* the profile page: staff any member, a member only their own (the core decides) */
membersRouter.get('/:id', requireUser, async (req, res) => {
  const p = await call(req, (G) => G.profileData(req.params.id));
  if (!p) return res.status(404).json({ error: 'Member not found.' });
  res.json(p);
});

membersRouter.put('/:id', requireStaff, async (req, res) => {
  const f = memberFields(req.body);
  if (!('image' in (req.body || {}))) delete f.image;   /* image left out = keep the current photo */
  res.json(await call(req, (G) => G.updateClient(req.params.id, f)));
});

membersRouter.delete('/:id', requireStaff, async (req, res) => {
  await call(req, (G) => G.deleteClient(req.params.id));
  res.json({ ok: true });
});

/* subscriptions */
membersRouter.post('/:id/subscriptions', requireStaff, async (req, res) => {
  res.status(201).json(await call(req, (G) => G.addSubscription(req.params.id, req.body || {})));
});
membersRouter.post('/:id/subscriptions/extend', requireStaff, async (req, res) => {
  const b = req.body || {};
  res.json(await call(req, (G) => G.extendSubscription(req.params.id, { days: b.days, sessions: b.sessions })));
});

/* freeze / unfreeze */
membersRouter.post('/:id/freeze', requireStaff, async (req, res) => {
  await call(req, (G) => G.freezeClient(req.params.id));
  res.json({ ok: true });
});
membersRouter.post('/:id/unfreeze', requireStaff, async (req, res) => {
  res.json(await call(req, (G) => G.unfreezeClient(req.params.id)));
});

/* the member's own login account (username only, never the password) */
membersRouter.get('/:id/login', requireStaff, async (req, res) => {
  res.json({ login: await call(req, (G) => G.memberLogin(req.params.id)) });
});
membersRouter.post('/:id/login/password', requireStaff, async (req, res) => {
  await call(req, (G) => G.resetMemberPassword(req.params.id, (req.body || {}).password));
  res.json({ ok: true });
});
