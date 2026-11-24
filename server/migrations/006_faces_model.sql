-- 006: face engine tag. Descriptors of different engines are not comparable even though both have 128 numbers,
-- so every face record says which engine made it. Rows that exist now come from the old face-api engine ('faceapi'):
-- they are kept (the member sees "enrol again") but never offered for matching. New enrolments are 'sface' (OpenCV SFace).

ALTER TABLE faces ADD COLUMN model TEXT NOT NULL DEFAULT 'faceapi';
