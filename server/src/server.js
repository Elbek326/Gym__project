import { createApp } from './app.js';
import { config } from './config.js';
import { closePool } from './db.js';
import { runMigrations } from './migrate.js';
import { ensureFirstAdmin } from './seed.js';

/* on every start: bring the database schema up to date, and on a brand-new database create the first admin */
async function start() {
  await runMigrations((m) => console.log(m));
  const pw = await ensureFirstAdmin({ random: config.env === 'production' });
  if (pw) {
    console.log('================================================================');
    console.log(`First admin created.  Username: admin   Password: ${pw}`);
    console.log('Sign in and change it at once under "My Password". It is not shown again.');
    console.log('================================================================');
  }
  const server = createApp().listen(config.port, () => {
    console.log(`Bek Sport Gym: http://localhost:${config.port} (${config.env})`);
  });
  async function shutdown() {
    server.close();
    await closePool();
    process.exit(0);
  }
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

start().catch((err) => {
  console.error('Server could not start:', err.message);
  process.exit(1);
});
