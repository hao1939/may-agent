# Event Runtime Audit

Use this guide to compare the running system with the event design. Keep live
row counts and one-off findings in runtime reports or task evidence, not in the
stable design doc.

## What To Check

The audit answers three questions:

1. Which event types are currently emitted?
2. Which handlers or runtime components consume them?
3. Which events are accepted, unhandled, or waiting for a paired close?

The event table has retention, so counts are windowed facts. A zero count means
"not seen in the retained window", not "impossible".

## Emitter Reality

Query the retained event window:

```sql
SELECT event_type, COUNT(*) AS rows, MAX(timestamp) AS last_seen
FROM events
GROUP BY event_type
ORDER BY rows DESC;
```

Check for malformed event names:

```sql
SELECT id, event_type, source, owner, timestamp
FROM events
WHERE LENGTH(event_type) > 100
   OR event_type LIKE '{%'
   OR event_type NOT LIKE '%.%';
```

Malformed event names usually mean an ingress path bypassed canonical envelope
normalization. Fix the emitter path instead of teaching handlers to accept the
bad shape.

## Consumer Reality

Check recent handler activity:

```sql
SELECT handler_name, COUNT(*) AS runs, MAX(started_at) AS last_started
FROM handler_runs
WHERE started_at > unixepoch() * 1000 - 86400000 * 7
GROUP BY handler_name
ORDER BY runs DESC;
```

Then compare the emitted event types with handler subscriptions in code:

```bash
rg -n 'on:|events:|subscribe|project\\.owner\\.requested|session\\.completed|metric\\.breach' \
  agents projects packages src
```

Before adding a new `on:`-only handler:

1. Confirm the source event is emitted in the retained window.
2. Confirm the event has a stable owner and target context.
3. Add a timer fallback only when delayed or backfill behavior is required.

Before adding a new event type to `SystemEvent`:

1. Identify the emitter site in code.
2. Identify the consumer or owner route.
3. Decide whether the event needs pair tracking.

## Delivery Health

Delivery acceptance is not work completion. Use delivery fields to find routing
gaps:

```sql
SELECT id, event_type, owner, source, timestamp, delivery_status,
       accepted_by, delivery_route, delivery_note
FROM events
WHERE delivery_status IN ('pending', 'unhandled')
ORDER BY timestamp DESC
LIMIT 100;
```

Interpretation:

- `delivery_status='unhandled'` means no responsible route accepted the event
  within its TTL.
- `accepted_by='default-owner:<owner>'` means no specialized handler claimed
  the event, so delivery fell back to owner accountability.
- `delivery_route='noop'` is only a legacy baseline marker for old rows.

## Pair Health

Opening events with expected closing events should appear in pair tracking:

```sql
SELECT pair_name, correlation_key, owner, status, opened_at,
       expected_close_at, closed_at, note
FROM event_pair_runs
WHERE status != 'closed'
ORDER BY expected_close_at ASC
LIMIT 100;
```

An orphan is an investigation signal. It can mean stuck work, a missing close
event, a wrong correlation key, a bad timeout, or an event naming issue.

## Audit Smells

Treat these as follow-up tasks:

- A documented canonical event has no emitter.
- A live event has no direct consumer and repeatedly falls back to
  `default-owner:<owner>` when a direct handler should own it.
- A lifecycle-shaped event has no correlation key and no explicit exception.
- A handler subscribes to a legacy or shortcut event when a canonical event
  exists.
- An ingress path persists flattened data instead of the canonical envelope.
- A dated row-count table appears in a design doc.

## Where Findings Go

- Design mismatch: update the design doc or implementation in the same task.
- Runtime issue likely to repeat: add or adjust a metric.
- One-off runtime issue: record evidence on the task or runtime report.
- Human decision needed: emit or route an owner request with enough context.
