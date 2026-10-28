import { createApp } from './app.js';
import { config } from './config.js';
import { closePool } from './db.js';

const server = createApp().listen(config.port, () => {
  console.log(`Gym Manager API: http://localhost:${config.port}/api/health (${config.env})`);
});

async function shutdown() {
  server.close();
  await closePool();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
