import { runMigrations } from '../src/migrate.js';
import { closePool } from '../src/db.js';

runMigrations(console.log)
  .then((n) => console.log(n ? `${n} migration(s) applied.` : 'Database is up to date.'))
  .catch((err) => { console.error('Migration failed:', err.message); process.exitCode = 1; })
  .finally(closePool);
