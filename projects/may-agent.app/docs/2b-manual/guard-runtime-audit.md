# Guard Runtime Audit

Use this guide to inspect the running guard system. Keep dated snapshots and
one-off findings in runtime reports or task evidence, not in
`2a-design/guards.md`.

## What To Check

The audit answers four questions:

1. Which guards are firing?
2. Are they warning, blocking, repairing, or only observing?
3. Are repeated signals real behavior or duplicated noise?
4. Does a metric breach indicate a bad threshold or a real process issue?

## Guard Volume

```sql
SELECT json_extract(data, '$.guard') AS guard,
       json_extract(data, '$.action') AS action,
       COUNT(*) AS rows,
       COUNT(DISTINCT json_extract(data, '$.sessionId')) AS sessions
FROM events
WHERE event_type = 'guard.triggered'
  AND timestamp > unixepoch() * 1000 - 86400000
GROUP BY guard, action
ORDER BY rows DESC;
```

High volume alone is not proof of agent failure. It is a signal to review
composition, repeat rate, and whether the guard is interrupting work.

## Repeated Per-Session Signals

```sql
SELECT json_extract(data, '$.sessionId') AS session_id,
       json_extract(data, '$.guard') AS guard,
       json_extract(data, '$.reason') AS reason,
       COUNT(*) AS rows
FROM events
WHERE event_type = 'guard.triggered'
  AND timestamp > unixepoch() * 1000 - 86400000
GROUP BY session_id, guard, reason
HAVING rows >= 3
ORDER BY rows DESC
LIMIT 50;
```

If one session emits many repeated guard events for the same condition, prefer
per-session dedup or a narrower detector. If many sessions each emit one guard
event, dedup will not help; fix the workflow, prompt, or tool surface.

## Tool-Level Guard Composition

Tool-level guards may share `guard: "beforeToolCall"`. When that happens,
bucket by reason prefix:

```sql
SELECT substr(json_extract(data, '$.reason'), 1, 40) AS reason_prefix,
       COUNT(*) AS rows,
       COUNT(DISTINCT json_extract(data, '$.sessionId')) AS sessions
FROM events
WHERE event_type = 'guard.triggered'
  AND json_extract(data, '$.guard') = 'beforeToolCall'
  AND timestamp > unixepoch() * 1000 - 86400000
GROUP BY reason_prefix
ORDER BY rows DESC;
```

If an operational workflow depends on parsing reason text, consider improving
the emitted schema so the specific guard id is available as structured data.

## Threshold Quality

When a guard metric breaches:

1. Check whether the breach is dominated by one guard or broad-based.
2. Check whether the dominant signal is repeated within sessions.
3. Check whether the action is mostly `warned` or includes `blocked`.
4. Check recent throughput, because higher session volume can reveal a
   structural detector floor.
5. Prefer root-cause repair over repeated threshold raises.

Threshold changes should include evidence from recent snapshots and a reason
why the new threshold represents a stable expected range.

## Review Output

Record one of these outcomes:

- `true_positive`: guard caught a real issue or near-miss.
- `false_positive`: guard fired on valid behavior.
- `noisy`: guard is too weak or repetitive to act on directly.
- `useful_intervention`: guard helped the agent recover.
- `harmful_intervention`: guard blocked or distracted useful work.
- `unknown`: not enough context to judge.

Only reviewed outcomes should create learning feedback. Raw guard rows are
signals for review, not training data by themselves.

## Audit Smells

- A guard metric repeatedly breaches and the only response is raising the
  threshold.
- A single session emits dozens of identical guard events.
- A guard blocks work before it has reviewed true-positive evidence.
- The owner must parse free-form `reason` text to identify the specific guard.
- A guard emits high-volume facts that are better represented as a metric or
  session eval finding.
