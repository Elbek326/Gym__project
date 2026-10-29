/* environment settings, read once. .env is loaded by node --env-file-if-exists (see package.json) */
function required(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing environment variable ${name}. Copy server/.env.example to server/.env and fill it in.`);
  return v;
}

const env = process.env.NODE_ENV || 'development';

/* how many proxies sit in front of the app. On Render (and most hosts) one load balancer adds X-Forwarded-For;
   trusting exactly one hop gives the real client IP for sign-in throttling and cannot be spoofed further. */
function trustProxy() {
  const v = process.env.TRUST_PROXY;
  if (v === undefined || v === '') return env === 'production' ? 1 : 'loopback';
  return /^\d+$/.test(v) ? Number(v) : v;
}

export const config = {
  env,
  port: Number(process.env.PORT) || 3000,
  trustProxy: trustProxy(),
  get databaseUrl() { return required('DATABASE_URL'); }
};
