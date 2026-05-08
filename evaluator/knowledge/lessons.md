# Evaluator Lessons

- **Events table schema gotcha**: `events` uses `event_type` and `timestamp` (not `type`/`created_at`). If a query_db error returns schema in the payload, immediately retry with those column names rather than proceeding with partial data.
