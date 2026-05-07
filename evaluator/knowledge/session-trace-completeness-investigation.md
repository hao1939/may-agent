# Investigation: `capability.session-trace-completeness` at ~0.0024 vs observed session op coverage ~0.49

Date: 2026-05-07

## Why this is non-obvious
The dashboard metric `capability.session-trace-completeness` is extremely low (0.0024). At face value it suggests the system is not emitting the event chain needed to reconstruct sessions.

However, a quick check of the `sessions` table shows that *tool/op recording is much healthier*:

- last 24h sessions: **414**
- sessions with `opCount > 0`: **202**
- op coverage rate: **0.4879**

So we have a paradox:

- `opCount>0` coverage ≈ 49%
- `session-trace-completeness` ≈ 0.24%

That gap strongly implies the trace-completeness metric is *not measuring tool ops*, but a much stricter event chain (likely v2 spec chain elements like `context.read`, `agent.decision`, etc.), and/or its denominator is being polluted by non-session events.

## Evidence collected (DB)

### A) Sessions with ops (ground truth proxy)
Query:

```sql
SELECT COUNT(*) AS total,
       SUM(CASE WHEN opCount>0 THEN 1 ELSE 0 END) AS with_ops,
       ROUND(1.0*SUM(CASE WHEN opCount>0 THEN 1 ELSE 0 END)/COUNT(*),4) AS rate
FROM sessions
WHERE endedAt IS NOT NULL
  AND endedAt > (strftime('%s','now')-86400)*1000;
```

Result:
- total=414, with_ops=202, rate=0.4879

Per-agent breakdown (same window) shows the lowest op coverage is `may` (0.3429), others are ~0.55–0.62.

### B) Metric record has no provenance fields
The `metrics` row for `capability.session-trace-completeness` has `source`, `source_query`, `source_command`, and `config` all NULL.

That means:
- we cannot validate its query logic from the DB alone
- we must locate the computation in code (likely `agents/may/handlers/metrics-snapshot.ts` per related KEs)

## Context from existing knowledge (important)
A recent incident write-up (KE-795) documents a 41-minute **event storm** (508k events) where `session.start` events were re-emitted tens of thousands of times for a handful of sessionIds. That incident explicitly calls out that:

- `capability.session-trace-completeness` was forced toward ~0 because the denominator included ~82k storm `session.start` rows while the numerator (e.g., `context.read`) barely moved.

So a low reading can be *mathematically inevitable* even if agents behave normally.

## Hypotheses (ranked)

### H1 — Denominator pollution by duplicated `session.start` (event storm or replay)
If the trace metric is computed as:

> (# sessions with full chain) / (# session.start events)

then duplicate `session.start` emissions drive the denominator up dramatically, collapsing the ratio.

KE-795 provides a concrete mechanism for this exact failure mode.

**Prediction:** if we recompute using distinct sessionIds (or from the `sessions` table), the ratio should be much higher.

### H2 — Metric measures v2 chain completeness, not "has tools"
The v2 spec measurement referenced in repo docs indicates this metric is about reconstructing a chain (e.g., `session.start` → `context.read` → `agent.decision` → tool ops → `session.end`).

So a session can have `opCount>0` and still fail trace completeness if it never emitted `context.read` / `agent.decision` events.

**Prediction:** agents with good op coverage could still have low trace completeness if they skip those emissions.

### H3 — Metric window mismatch or wrong join key
If the metric correlates events by a field that’s missing or inconsistent (e.g., uses `events.data.sessionId` but some emit `session_id` or uses `requestId`), then it will undercount numerator.

## Improvement opportunity (actionable)
The system needs *two separate metrics* to disambiguate "instrumentation missing" vs "denominator storm":

1. **Distinct-session trace completeness**
   - denominator: distinct sessionIds started in window (or `sessions` table)
   - numerator: distinct sessionIds with required chain

2. **Session.start duplication factor**
   - `COUNT(session.start events) / COUNT(DISTINCT sessionId)`
   - alerts when >1.1 (or similar)

These make the existing trace metric interpretable:
- if duplication factor spikes, trace completeness becomes untrustworthy and should be suppressed/annotated.

## Next steps for the owner (May/arc)
1. Locate the computation for `capability.session-trace-completeness` in code (likely `agents/may/handlers/metrics-snapshot.ts`).
2. Add provenance to the metrics table record (`source_query` or `config`) so evaluators can audit it without grepping.
3. Implement the two disambiguation metrics above and wire to dashboard/alerts.
