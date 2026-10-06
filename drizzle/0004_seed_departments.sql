-- Initial department reference data for ProLib (§ departments).
--
-- Departments are real configuration/reference records, not dummy users:
-- a fresh instance starts with these four so students can pick theirs
-- immediately after `npm run db:migrate` — no admin setup step required.
-- Users and projects stay at 0; only this reference table is populated.
--
--   id          short code shown in every compact selector (dropdowns,
--               filters, directory) — CSE / EEE / ECE / CS-AI
--   description the full department name, shown where a long form fits
--
-- ON CONFLICT DO NOTHING keeps re-application harmless (e.g. restoring a
-- database that already has them).
INSERT INTO "departments" ("id", "name", "slug", "code", "description", "position", "active")
VALUES
  ('dept-cse',    'CSE',    'cse',    'CSE',    'Computer Science and Engineering',        1, TRUE),
  ('dept-eee',    'EEE',    'eee',    'EEE',    'Electrical and Electronics Engineering',  2, TRUE),
  ('dept-ece',    'ECE',    'ece',    'ECE',    'Electronics and Communication Engineering', 3, TRUE),
  ('dept-cs-ai',  'CS-AI',  'cs-ai',  'CS-AI',  'Computer Science and Artificial Intelligence', 4, TRUE)
ON CONFLICT DO NOTHING;
