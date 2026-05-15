# Runtime DB schema notes (quick reminders)

These are *field name* reminders to prevent avoidable `no such column` errors. Always `PRAGMA table_info(<table>)` when unsure.

## metric_alerts
- `id` (INTEGER PK)
- `metric_id` (TEXT)
- `alert_type` (TEXT)
- `message` (TEXT)
- `resolved_at` (INTEGER)
- `created_at` (INTEGER)

## metric_snapshots
- `id` (INTEGER PK)
- `metric_id` (TEXT)
- `value` (REAL)
- `sample_size` (INTEGER)
- `measured_at` (INTEGER)
- `measured_by` (TEXT)
- `note` (TEXT)
