-- 001: the ten tables of the GYM core, one row per record (no daily shards).
-- Ids stay TEXT so records from the artifact backup keep their ids on import (stage 7).
-- Dates are DATE ('YYYY-MM-DD'), created_at is Asia/Tashkent local time without zone, as in the core.
-- Money is NUMERIC(14,2): exact, no floating point rounding.

CREATE TABLE users (
  id          TEXT PRIMARY KEY,
  username    TEXT NOT NULL,
  password    TEXT NOT NULL,                       -- 'pbkdf2_sha256$iter$salt$hash', never sent to the browser
  role        TEXT NOT NULL,                       -- 'admin' | 'member' (old roles may arrive from a backup; the core refuses them)
  client      TEXT,                                -- set only for role 'member'
  created_at  TIMESTAMP NOT NULL
);
CREATE UNIQUE INDEX users_username_lower ON users (lower(username));

CREATE TABLE clients (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  phone         TEXT,
  note          TEXT NOT NULL DEFAULT '',
  image         TEXT,                              -- small JPEG data URL (max 400 KB, checked by the core)
  created_at    TIMESTAMP NOT NULL,
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'frozen')),
  frozen_since  DATE,
  days          TEXT NOT NULL DEFAULT '',          -- 'Mon,Wed,Fri' or '' for any day
  debt          NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (debt >= 0),
  sample        BOOLEAN NOT NULL DEFAULT false
);
ALTER TABLE users ADD CONSTRAINT users_client_fk FOREIGN KEY (client) REFERENCES clients(id) ON DELETE CASCADE;

CREATE TABLE subs (
  id              TEXT PRIMARY KEY,
  client          TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  sub_type        TEXT NOT NULL CHECK (sub_type IN ('time', 'sessions')),
  start_date      DATE NOT NULL,
  end_date        DATE,                            -- required for 'time', optional for 'sessions'
  total_sessions  INTEGER NOT NULL DEFAULT 0 CHECK (total_sessions >= 0),
  used_sessions   INTEGER NOT NULL DEFAULT 0 CHECK (used_sessions >= 0),
  price           NUMERIC(14,2) NOT NULL DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMP NOT NULL,
  sample          BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX subs_client ON subs (client);
-- at most one active plan per member, enforced by the database even if two desks act at once
CREATE UNIQUE INDEX subs_one_active ON subs (client) WHERE is_active;

CREATE TABLE measurements (
  id          TEXT PRIMARY KEY,
  client      TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  created_at  TIMESTAMP NOT NULL,
  note        TEXT NOT NULL DEFAULT '',
  weight      NUMERIC(7,2), height NUMERIC(7,2), body_fat NUMERIC(7,2),
  chest       NUMERIC(7,2), waist  NUMERIC(7,2), bicep    NUMERIC(7,2),
  sample      BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX measurements_client ON measurements (client);

CREATE TABLE products (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  category    TEXT NOT NULL DEFAULT 'General',
  price       NUMERIC(14,2) NOT NULL,
  cost        NUMERIC(14,2) NOT NULL DEFAULT 0,
  stock       INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  created_at  TIMESTAMP NOT NULL,
  sample      BOOLEAN NOT NULL DEFAULT false
);
CREATE UNIQUE INDEX products_name_lower ON products (lower(name));

CREATE TABLE expenses (
  id          TEXT PRIMARY KEY,
  category    TEXT NOT NULL,
  amount      NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  note        TEXT NOT NULL DEFAULT '',
  date        DATE NOT NULL,
  created_at  TIMESTAMP NOT NULL,
  sample      BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX expenses_date ON expenses (date);

CREATE TABLE visits (
  id            TEXT PRIMARY KEY,
  d             DATE NOT NULL,                     -- kept from the core (= visit_date)
  client        TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  subscription  TEXT REFERENCES subs(id) ON DELETE SET NULL,
  visit_date    DATE NOT NULL,
  visit_time    TEXT NOT NULL,                     -- 'HH:MM'
  sample        BOOLEAN NOT NULL DEFAULT false
);
-- one check-in per member per day, also when two desks check the same member in at once
CREATE UNIQUE INDEX visits_one_per_day ON visits (client, visit_date);
CREATE INDEX visits_date ON visits (visit_date);

CREATE TABLE txns (
  id             TEXT PRIMARY KEY,
  d              DATE NOT NULL,
  client         TEXT REFERENCES clients(id) ON DELETE SET NULL,   -- history stays when a member is deleted
  txn_type       TEXT NOT NULL CHECK (txn_type IN ('charge', 'payment', 'adjustment', 'income')),
  category       TEXT NOT NULL DEFAULT '',
  amount         NUMERIC(14,2) NOT NULL,
  balance_after  NUMERIC(14,2),
  note           TEXT NOT NULL DEFAULT '',
  created_at     TIMESTAMP NOT NULL,
  by             TEXT NOT NULL DEFAULT '',
  sample         BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX txns_d ON txns (d);
CREATE INDEX txns_client ON txns (client);

CREATE TABLE sales (
  id            TEXT PRIMARY KEY,
  d             DATE NOT NULL,
  product       TEXT,                              -- no FK: past sales stay when a product is deleted
  product_name  TEXT NOT NULL,
  client        TEXT REFERENCES clients(id) ON DELETE SET NULL,
  qty           INTEGER NOT NULL CHECK (qty > 0),
  unit_price    NUMERIC(14,2) NOT NULL,
  total         NUMERIC(14,2) NOT NULL,
  created_at    TIMESTAMP NOT NULL,
  by            TEXT NOT NULL DEFAULT '',
  sample        BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX sales_d ON sales (d);

CREATE TABLE audit (
  id          TEXT PRIMARY KEY,
  d           DATE NOT NULL,
  action      TEXT NOT NULL,
  detail      TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMP NOT NULL,
  by          TEXT NOT NULL DEFAULT ''
);
CREATE INDEX audit_created ON audit (created_at DESC);
