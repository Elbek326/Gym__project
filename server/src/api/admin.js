import { Router } from 'express';
import { call } from './call.js';
import { requireAdmin } from '../auth/middleware.js';
import { COOKIE } from '../auth/sessions.js';

/* admin only: staff accounts, whole-database backup and restore, sample data */
export const adminRouter = Router();
adminRouter.use(requireAdmin);

/* a staff account as the browser may see it: never the password hash */
function account(u) { return { id: u.id, username: u.username, role: u.role, created_at: u.created_at }; }

adminRouter.get('/users', async (req, res) => {
  res.json(await call(req, (G) => G.listUsers().map(account)));
});
adminRouter.post('/users', async (req, res) => {
  const b = req.body || {};
  res.status(201).json(await call(req, async (G) => account(await G.addUser({ username: b.username, password: b.password, role: b.role }))));
});
adminRouter.put('/users/:id/role', async (req, res) => {
  await call(req, (G) => G.setRole(req.params.id, (req.body || {}).role));
  res.json({ ok: true });
});
adminRouter.post('/users/:id/password', async (req, res) => {
  await call(req, (G) => G.resetPassword(req.params.id, (req.body || {}).password));
  res.json({ ok: true });
});
adminRouter.delete('/users/:id', async (req, res) => {
  await call(req, (G) => G.deleteUser(req.params.id));
  res.json({ ok: true });
});

/* the whole database as one JSON file, same format as the artifact's backup (old backups restore here).
   It contains password hashes so accounts survive a restore: keep backup files private. */
adminRouter.get('/backup', async (req, res) => {
  const b = await call(req, (G) => G.exportBackup());
  res.setHeader('Content-Disposition', `attachment; filename="${b.name}"`);
  res.type('application/json').send(b.text);
});

/* replaces EVERYTHING with the backup's contents. Every session ends (sessions belong to the old users),
   so everybody, including the caller, signs in again. Body: { text: "<backup file contents>" } */
adminRouter.post('/backup/restore', async (req, res) => {
  await call(req, (G) => G.restoreBackup(String((req.body || {}).text || '')));
  res.clearCookie(COOKIE, { path: '/' });
  res.json({ ok: true, signedOut: true });
});

adminRouter.post('/sample', async (req, res) => {
  res.status(201).json({ members: await call(req, (G) => G.loadSample()) });
});
adminRouter.delete('/sample', async (req, res) => {
  res.json({ removed: await call(req, (G) => G.removeSample()) });
});
