-- Run once as the postgres superuser to create the app's own user and database:
--   psql -U postgres -v app_password="YOUR_PASSWORD" -f server/scripts/create-db.sql
-- The app connects as gym_app, never as postgres: it owns only the gym database.

CREATE ROLE gym_app LOGIN PASSWORD :'app_password';
CREATE DATABASE gym OWNER gym_app ENCODING 'UTF8' TEMPLATE template0;
