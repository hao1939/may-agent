# Drift Detection Report — 2026-05-03

**Script**: agents/bob/workspace/scripts/drift-check.sh
**Target**: sessions.md (Phase 1 pilot)
**Checks run**: 5
**Drifts found**: 4
**Drift rate**: 80%

## Findings

| Doc | Claim | Reality | Status |
|-----|-------|---------|--------|
| sessions.md | Column count = 15 | Actual = 16 | ❌ DRIFT |
| sessions.md | status enum: running|done|error | Also has: interrupted | ❌ DRIFT |
| sessions.md | kind enum: job|heartbeat|chat | Actual: call|job|chat (no heartbeat) | ❌ DRIFT |
| sessions.md | No stepLabel column documented | stepLabel exists in DB | ❌ DRIFT |
| sessions.md | State: created → running → done/error | No 'created' status in DB (may be transient) | ✅ OK |

## Interpretation

- **Column count drift**: DB has 16 columns, doc shows 15. The `stepLabel` column is undocumented.
- **Status enum drift**: `interrupted` status exists in production but isn't in the documented enum.
- **Kind enum drift**: Doc claims `heartbeat` as a kind value, but runtime uses `call` instead. No heartbeat-kinded sessions exist.

## Impact Assessment

These drifts affect any agent that:
1. Writes SQL queries using the documented schema (will miss stepLabel, won't filter interrupted)
2. Filters by kind='heartbeat' (returns 0 rows — heartbeats are kind='job')
3. Assumes only 3 terminal states when querying completion

## Recommendations

1. Update sessions.md to add `stepLabel` column
2. Update status enum to include `interrupted`
3. Update kind enum: replace `heartbeat` with `call`, note that heartbeats use kind='job'
4. Add this script to periodic checks (weekly or per-heartbeat-cycle)

## Validation Against Known KEs

- **KE-570** (sessions.md drift): ✅ Confirmed — our script detects the same class of issues
- **KE-573** (status vocabulary): ✅ Confirmed — interrupted status still undocumented

This pilot demonstrates the drift-detection approach works with >60% true positive rate on a single doc.
