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
rg -n 'on:|events:|subscribe|project\\.owner\\.requested|session\\.end|metric\\.breach' \
  agents projects packages projects/may-agent/src
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
- A missing specialized App/task/internal acceptance means the event remains
  pending; there is no generic owner fallback that can turn routing into work.
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

## Semantic Trace Health

Structural integrity is necessary but insufficient. One default singleton
trace row per event can pass dangling-reference checks while causal propagation
and closure are broken.

Find closed pairs whose authoritative closure link was not persisted:

```sql
SELECT p.pair_name, p.open_event_id, p.close_event_id, p.closed_at
FROM event_pair_runs p
LEFT JOIN event_trace_links l
  ON l.from_event_id = p.close_event_id
 AND l.to_event_id = p.open_event_id
 AND l.type = 'closure'
WHERE p.status = 'closed'
  AND l.id IS NULL
ORDER BY p.closed_at DESC;
```

Find opener/closer trace splits:

```sql
SELECT p.pair_name, p.open_event_id, p.close_event_id,
       ot.trace_id AS open_trace, ct.trace_id AS close_trace
FROM event_pair_runs p
JOIN event_traces ot ON ot.event_id = p.open_event_id
JOIN event_traces ct ON ct.event_id = p.close_event_id
WHERE p.status = 'closed'
  AND ot.trace_id != ct.trace_id;
```

For human-rooted work, verify the trace plus durable App lineage. One trace is
not expected to own every asynchronous attempt:

```text
conversation.message.created (target.appId=may, author.kind=human)
  -> exact May App inbox item/source reference
    -> bounded owner attempt and optional child App/task dependency
      -> App result and correlated channel delivery operation
```

Also check that each May App request has one human intent, that bookkeeping
acceptance does not hide a missing App disposition, and that generated human
output has a correlated transport delivery. Trace identity supplies causality
inside and between observed attempts; the inbox, dependency, and delivery IDs
supply eventual-handling authority across restarts. Direct-agent
persistent-chat turns, if used, must have distinct traces unless reply context
links them.

For Conversation reads, also verify that non-human semantic messages create no
May request, transient messages do not replay, and only confirmed delivery is
projected as seen human output.

Trace tests should cover new May requests, later/corrective requests, approval,
cancellation, App delegation and delivery, failure, and recovery. Compatibility
execution tests separately cover async fork/workflow/CLI events and direct-chat
cold resume.

## Audit Smells

Treat these as follow-up tasks:

- A documented canonical event has no emitter.
- A live event has no declared App/task/internal consumer and remains pending.
- A lifecycle-shaped event has no direct-close contract, compatibility
  correlation key, or explicit exception.
- A closed pair has no persisted closure link or its opener/closer traces differ.
- A persistent chat session reuses one trace for unrelated human turns.
- A human semantic intent has no child work/disposition or its result has no
  channel-delivery projection.
- A targeted domain event is accepted only by lifecycle bookkeeping rather
  than durable admission or a bounded internal handler.
- A handler subscribes to a legacy or shortcut event when a canonical event
  exists.
- An ingress path persists flattened data instead of the canonical envelope.
- A dated row-count table appears in a design doc.

## Where Findings Go

- Design mismatch: update the design doc or implementation in the same task.
- Runtime issue likely to repeat: add or adjust a metric.
- One-off runtime issue: record evidence on the task or runtime report.
- Human decision needed: emit or route an owner request with enough context.
