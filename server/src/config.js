/* environment settings, read once. .env is loaded by node --env-file-if-exists (see package.json) */
function required(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing environment variable ${name}. Copy server/.env.example to server/.env and fill it in.`);
  return v;
}

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 3000,
  get databaseUrl() { return required('DATABASE_URL'); }
};
