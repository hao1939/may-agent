# KE-1778: Session Error Rate Metric Inflated 2× by KE-1558 NULL Error Column

**Status**: open
**Discovered**: 2026-06-10
**Agent**: arc (heartbeat coherence audit)
**Scope**: metric accuracy / metrics-snapshot.ts
**Related**: KE-1558 (error column always NULL), sessions.md

## Claim

The `session.error-rate-6h` metric is approximately **double its true value**
because it counts all `interrupted` sessions as errors, due to a cascading
interaction with KE-1558 (the `sessions.error` column is universally NULL).

## Evidence

### The metric logic (metrics-snapshot.ts lines 618–626)

```sql
-- Denominator: terminal sessions
SELECT COUNT(*) FROM sessions WHERE startedAt > ? AND status IN ('done','error','interrupted')

-- Numerator: errors + "non-clean" interrupts
SELECT COUNT(*) FROM sessions WHERE startedAt > ?
  AND (status = 'error'
    OR (status = 'interrupted' AND COALESCE(error, '') != 'Clean start (fresh)'))
```

The intent is to exclude legitimate clean-start interrupts (e.g., from daemon
restart) from the error count. But:

1. **`sessions.error` is universally NULL** (KE-1558 — db-writer race condition
   overwrites manager's value). So `COALESCE(NULL, '') = ''`, and
   `'' != 'Clean start (fresh)'` is always TRUE.

2. **All interrupted sessions are counted as errors**, regardless of cause.

3. **Even if `error` were populated**, the filter text `'Clean start (fresh)'`
   doesn't match the actual value used: on-disk `meta.json` shows `"Cancelled"`
   for legitimate interrupts, not `"Clean start (fresh)"`. The filter would
   still fail to exclude them.

### Current 6h window numbers

| Status | Count |
|--------|-------|
| done | 267 |
| error | 30 |
| interrupted | 42 |
| running | 3 |

- **True error rate** (error-only / terminal): 30 / 339 = **0.088**
- **Reported error rate** (error+interrupted / terminal): 72 / 339 = **0.212**
- **Metric current value**: **0.2018** (matches inflated formula)

### Who generates the interrupted sessions?

aks-explorer alone accounts for 42 of 42 interrupted sessions in the 6h window.
Of those, 31 have on-disk error "Agent ended with an empty assistant turn" and
11 have "Cancelled". The `empty assistant turn` ones are genuine failures
(misclassified as `interrupted` rather than `error`), but the `Cancelled` ones
are likely legitimate workflow cancellations that should not count.

## Impact

- The metric consistently reads ~2× its true value.
- It's currently at 0.20 (appears near the 0.30 threshold), but true error rate
  is ~0.09 (near the 0.10 target). The metric looks unhealthy when the system
  is actually near-target.
- Any alert or triage triggered by this metric will chase phantom errors.

## Fix Required (src/ changes — ORDER-010)

Two fixes needed, both in `agents/may/handlers/metrics-snapshot.ts`:

1. **Short-term**: Change the interrupted-session filter to not depend on the
   `error` column at all. Until KE-1558 is resolved, either:
   - Exclude all interrupted sessions from the error count, or
   - Use a heuristic like `opCount < 5` to distinguish crash-interrupts from
     legitimate cancellations.

2. **Long-term**: Fix KE-1558 (the db-writer race) so `sessions.error` is
   actually populated, then update the filter text from `'Clean start (fresh)'`
   to match the actual values used (`'Cancelled'`, etc.).

## Lesson

When a known data-quality bug (KE-1558: error column NULL) exists, downstream
consumers that depend on that column silently degrade. The metric was written
with correct intent but its filter became a no-op. Any metric logic that touches
`sessions.error` is suspect until KE-1558 is fixed.
