-- 003: face check-in. Only face descriptors are kept (128 numbers per shot, computed in the browser),
-- never the camera images. Biometric data: stored only with the member's consent, removed with the member,
-- and not part of backup files (the backup is the core's tables only).

CREATE TABLE faces (
  client       TEXT PRIMARY KEY REFERENCES clients(id) ON DELETE CASCADE,
  descriptors  JSONB NOT NULL,                     -- [[128 numbers], ...], 1 to 5 shots
  consent_at   TIMESTAMP NOT NULL,                 -- Asia/Tashkent time the staff confirmed consent
  created_by   TEXT NOT NULL DEFAULT '',
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
