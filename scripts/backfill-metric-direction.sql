-- M5b: Backfill direction column for metrics where "lower is better"
-- All other metrics default to 'higher_is_better' via column DEFAULT.
-- Run with: sqlite3 .state/may.db < this_file.sql

UPDATE metrics SET direction = 'lower_is_better' WHERE id IN (
  'system.stuck-requests',       -- fewer stuck requests = better
  'may.premature-done-rate'      -- lower premature-done rate = better
);

-- Verify:
-- SELECT id, direction FROM metrics WHERE direction = 'lower_is_better';
-- SELECT id, direction FROM metrics WHERE type = 'continuous' AND status = 'active';
