# Eval coverage gap — 2026-05-01

## Signals

DB query (bun:sqlite, readonly) shows:
- `max(evaluations.createdAt)`: **1777625760415**
- `max(sessions.startedAt)`: **1777625807783**
- `sessions without any evaluation`: **2549**

Evidence: `bun -e` output in heartbeat transcript:
```js
{ maxEval: 1777625760415, maxSess: 1777625807783, uneval: 2549 }
```

## Interpretation

- Session evaluation pipeline is writing to `evaluations` very recently (maxEval is near-now), so the cron is *alive*.
- However, the unevaluated backlog is extremely large (2549 sessions). This indicates either:
  1) the evaluation job is intentionally sampling a small subset, or
  2) the scope/filters are wrong (skipping most sessions), or
  3) eval writes are happening but only for certain agents/kinds.

Legacy artifact directory `.state/evaluations/` still has newest mtime around **Mar 24** (observed via `ls ... | tail -5`), consistent with prior “artifacts drift” notes: DB is canonical; filesystem artifacts may be stale.

## Follow-up queries run in this heartbeat

### Unevaluated backlog by agent (top 15)

```js
[
  { agent: "evaluator", c: 1435 },
  { agent: "coach", c: 471 },
  { agent: "optimizer", c: 428 },
  { agent: "amy", c: 131 },
  { agent: "may", c: 36 },
  { agent: "tech-lead", c: 13 },
  { agent: "scout", c: 12 },
  { agent: "bob", c: 10 },
  { agent: "qa", c: 9 },
  { agent: "arc", c: 3 },
  { agent: "dev", c: 2 }
]
```

### Recent evaluation rate vs recent sessions (last 6 hours)

```js
{ sessionsRecent: 535, evalsRecent: 124 }
```

## Next queries to run (owner: evaluator / tech-lead)

1) Distribution by kind/source (to see if certain kinds are excluded):
```sql
select kind, source, count(*) c
from sessions s
where not exists (select 1 from evaluations e where e.sessionId=s.sessionId)
group by kind, source
order by c desc;
```

2) Fraction heuristic vs LLM:
```sql
select evaluatedByHeuristic, count(*) c
from evaluations
group by evaluatedByHeuristic;
```

## Action recommendation

Escalate to tech-lead / optimizer to confirm intended sampling policy. If full coverage is desired, either:
- increase eval throughput, or
- restrict which sessions enter `sessions` table, or
- add prioritization (evaluate only sessions with tool calls or only non-heartbeats, etc.).
