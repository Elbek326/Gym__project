-- 005: self-learning face check-in. `descriptors` keeps the enrolment shots untouched; confident check-ins add
-- extra views to `learned` (oldest first). Together they never exceed 20 per member (see src/api/faces.js).
-- Still only 128 numbers per entry, never images, and removed with the face record.

ALTER TABLE faces ADD COLUMN learned JSONB NOT NULL DEFAULT '[]';   -- [[128 numbers], ...], oldest first
