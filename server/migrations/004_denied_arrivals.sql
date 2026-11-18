-- 004: members the entrance camera recognised but who could NOT be checked in (frozen, no plan, expired,
-- no sessions left, not a training day). Kept so the day's statistics show everyone who came.
-- One row per member per day; removed with the member.

CREATE TABLE denied_arrivals (
  id          TEXT PRIMARY KEY,
  client      TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  d           DATE NOT NULL,
  time        TEXT NOT NULL,                       -- 'HH:MM', Asia/Tashkent
  reason      TEXT NOT NULL,                       -- frozen | no_plan | finished | expired | not_training_day
  message     TEXT NOT NULL DEFAULT '',            -- the rule's own message, as shown on screen
  created_at  TIMESTAMP NOT NULL
);
CREATE UNIQUE INDEX denied_arrivals_one_per_day ON denied_arrivals (client, d);
CREATE INDEX denied_arrivals_d ON denied_arrivals (d);
