# Iteration 1 deliverable — split fixable behavior NI from pipeline/unscorable

## Objective
Reduce `evaluator.low-quality-rate-24h` **without** creating “false-good” inflation by separating:

- **Fixable agent behavior failures** (true `needs_improvement`) from
- **Pipeline/guard false-penalties** and **unscorable** sessions (runner interruptions, transcript/schema errors)

This deliverable is an evidence-backed classification proposal + metric split that can be implemented by the session owner.

---

## Evidence: current 24h NI drivers are dominated by unscorable/pipeline-like issues
DB evidence (evaluations table; last 24h):

- Total evaluations: **463**
- `needs_improvement`: **266**
- Issue counts (not mutually exclusive):
  - `schema/query error in transcript`: **116**
  - `finish blocked by uncommitted changes`: **154**
  - `terminal status: interrupted`: **28**
  - `terminal status: error`: **13**
  - `shallow_session:*`: **0 in evaluations** (note: may appear upstream in other issue aggregations; not present here)

Query used:
```sql
WITH ev AS (
  SELECT sessionId, verdict, issues, createdAt
  FROM evaluations
  WHERE createdAt >= (strftime('%s','now')-24*3600)*1000
)
SELECT
  COUNT(*) n,
  SUM(CASE WHEN verdict='needs_improvement' THEN 1 ELSE 0 END) ni,
  SUM(CASE WHEN issues LIKE '%finish blocked by uncommitted changes%' THEN 1 ELSE 0 END) uncommitted,
  SUM(CASE WHEN issues LIKE '%terminal status: interrupted%' THEN 1 ELSE 0 END) interrupted,
  SUM(CASE WHEN issues LIKE '%terminal status: error%' THEN 1 ELSE 0 END) term_error,
  SUM(CASE WHEN issues LIKE '%schema/query error in transcript%' THEN 1 ELSE 0 END) schema_err
FROM ev;
```

Top issue bundles:
- `[]`: 197
- `["schema/query error in transcript"]`: 61
- `["finish blocked by uncommitted changes"]`: 54
- `["finish blocked by uncommitted changes","broad may/shared commit during session"]`: 42
- `["finish blocked by uncommitted changes","schema/query error in transcript"]`: 29

---

## Proposed taxonomy (mutually exclusive, in order)
Classify each evaluation into one of:

1. **UNSCORABLE_PIPELINE**
   - `issues` contains any of:
     - `schema/query error in transcript`
     - `terminal status: interrupted`
     - `terminal status: error`
     - (optional) `workflow live signal injection unavailable`
   - Rationale: these are primarily infra/transcript failures; current behavior shows they often lead to automatic NI (`ni_rate ~1.0` in prior analysis).

2. **FIXABLE_AGENT_BEHAVIOR**
   - Everything else that results in `needs_improvement`, notably:
     - `finish blocked by uncommitted changes`
     - `broad may/shared commit during session`
     - `committed generated runtime files`
     - `metric health claim without live evidence`
     - `anti-shallow gate not satisfied: ...`

3. **SCORABLE_GOOD**
   - Remaining verdicts that are not NI and not UNSCORABLE.

### Why ordering matters (prevents false-good inflation)
If we simply “exclude bad categories” from NI denominator, we risk hiding real behavior failures. Ordering ensures we only move clearly pipeline/unscorable sessions out of the scored population.

---

## Metric split recommendation
### A) Replace/adjust the existing metric
Current: `evaluator.low-quality-rate-24h` (appears to treat unscorable as NI)

Recommendation:
- Redefine *scorable* low-quality rate to exclude UNSCORABLE_PIPELINE from denominator.

**Candidate definition:**
- Numerator: `needs_improvement` AND NOT UNSCORABLE_PIPELINE
- Denominator: all evaluations AND NOT UNSCORABLE_PIPELINE

### B) Add separate pipeline health metrics (to avoid gaming)
Add metrics that must be monitored alongside the quality-rate:

1) `evaluator.unscorable-rate-24h`
- Numerator: UNSCORABLE_PIPELINE
- Denominator: all evaluations

2) Breakdown counters (optional but helpful for diagnosis):
- `evaluator.unscorable.schema-query-error-rate-24h`
- `evaluator.unscorable.terminal-interrupted-rate-24h`
- `evaluator.unscorable.terminal-error-rate-24h`

This preserves accountability: lowering low-quality-rate by excluding unscorable is acceptable only if unscorable-rate stays bounded.

---

## Guardrails against “false-good overturns”
To ensure evaluator scoring doesn’t produce low false-good overturns:

- For UNSCORABLE_PIPELINE: evaluator should emit `verdict="unknown"` (or keep `needs_improvement` but tag `unscorable=true`), and downstream aggregation should **exclude from quality-rate** but **include in unscorable-rate**.
- For FIXABLE_AGENT_BEHAVIOR: keep strict NI scoring (no relaxation).

Minimal implementation approach (least risky):
- **Do not change** scoring rules for behavior.
- Only change the aggregation/metric query to apply the UNSCORABLE_PIPELINE filter.

---

## Open discrepancy: `shallow_session:*` is not in evaluations
The provided context says `shallow_session:*` (~1006) is the top driver, but it does not appear in `evaluations.issues` in the last 24h snapshot.

Likely explanations (needs confirmation):
- `shallow_session:*` is emitted by a different stage/table (e.g., request-level heuristics, workflow run logs, or a separate aggregator), not persisted into `evaluations.issues`.
- The 24h window used by the context differs from the 24h window used here.

Action to resolve (next iteration): locate where `shallow_session:*` is stored (events? session_digests? another table) and sample a few raw transcripts to decide if it’s pipeline or agent-driven early bail.
