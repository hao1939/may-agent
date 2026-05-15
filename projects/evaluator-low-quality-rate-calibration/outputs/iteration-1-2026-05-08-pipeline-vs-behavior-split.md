# Iteration 1 — pipeline vs fixable behavior split (evaluator.low-quality-rate-24h)

## Purpose
Create a concrete, evidence-based split between:
- (A) **Fixable agent behavior failures** (should remain “quality” penalties), and
- (B) **Pipeline/guard false-penalties or infrastructure faults** (should be tracked separately so we reduce false NI, and avoid false-good overturns).

This is based on runtime DB evidence observed on **2026-05-08 ~20:00Z**.

---

## 1) What is currently driving NI in the last 24h?
### 1.1 Top “first issue” counts (24h)
Query:
```sql
SELECT json_extract(issues,'$[0]') AS first_issue, COUNT(*) c
FROM evaluations
WHERE createdAt > (strftime('%s','now')-24*3600)
GROUP BY first_issue
ORDER BY c DESC
LIMIT 30;
```
Observed top drivers:
- `shallow_session: ... only 2 messages` **1006**
- `finish blocked by uncommitted changes` **142**
- `terminal status: interrupted` **62**
- `schema/query error in transcript` **60**

Note: these are counts of `issues[0]` and therefore undercount multi-issue cases where a different issue is first.

### 1.2 Agent-level NI is broadly elevated (systemic)
Query:
```sql
SELECT agent, COUNT(*) total,
  SUM(CASE WHEN verdict='needs_improvement' THEN 1 ELSE 0 END) ni,
  ROUND(1.0*SUM(CASE WHEN verdict='needs_improvement' THEN 1 ELSE 0 END)/COUNT(*),3) ni_rate
FROM evaluations
WHERE createdAt > (strftime('%s','now')-24*3600)
GROUP BY agent
ORDER BY ni_rate DESC, total DESC;
```
Observed examples:
- may: total **542**, ni_rate **0.469** (also: uncommitted **87**, schema_err **31**, interrupted **23**)
- scout: total **218**, ni_rate **0.427**
- dev: total **138**, ni_rate **0.377**
- arc: total **117**, ni_rate **0.325**

This supports the user-provided observation that this is not a single-agent regression.

---

## 2) Split taxonomy (A behavior vs B pipeline)
### A) Fixable agent behavior failures
These are correct to count as quality penalties in `low-quality-rate` because they reflect agent decisions/process.

**A1. Git hygiene / workflow compliance**
- `finish blocked by uncommitted changes`
  - **Why behavior:** agent edited files but did not commit/stash/restore clean tree as required by workflow.
  - **Proposed treatment:** keep as NI, but consider adding targeted remediation guidance in agent templates.

**A2. True shallow/no-work sessions (if agent-controlled)**
- `shallow_session: ... only N messages`
  - **Why ambiguous:** could be caused by autop-runner/heartbeat wiring or by agent bailing early.
  - **Proposed treatment:** do not automatically count as “quality” until we confirm root cause by looking at session metadata and workflow.

### B) Pipeline/guard false-penalties (should not be “quality”)
These are *not* indicators of reasoning/task quality, and cause false NI (and therefore false-good overturn pressure).

**B1. Transcript ingestion/parsing faults**
- `schema/query error in transcript` (60 first-issue occurrences in 24h)
  - **Why pipeline:** evaluator couldn’t parse or query transcript; this is an evaluator/ETL failure, not agent quality.
  - **Proposed treatment:** move to a separate metric (e.g., `evaluator.transcript-error-rate-24h`) and mark evaluation as `skipped`/`unknown` rather than NI.

**B2. Runner/terminal interruptions**
- `terminal status: interrupted` (62)
- `terminal status: error` (12)
  - **Why pipeline:** indicates environment or execution interruption; may happen after the agent already did correct work.
  - **Proposed treatment:** separate metric (e.g., `evaluator.runner-interruption-rate-24h`), and avoid NI unless evidence shows agent-caused interruption.

---

## 3) Guardrail to prevent “false-good overturns”
If we stop counting pipeline faults as NI, we must avoid the opposite mistake: incorrectly calling a session “good” when evaluation is unreliable.

Recommended policy for evaluator/verdict:
1. Introduce an explicit verdict class or flag for **UNSCORABLE / UNKNOWN**.
   - If transcript parse fails or terminal is interrupted before evidence is collected, verdict should be `unknown` (or `skipped`) instead of `good`.
2. Ensure `evaluator.low-quality-rate-24h` excludes `unknown` rather than treating them as `good`.
3. Track unknown volume separately and alert when it rises.

This reduces NI caused by pipeline errors while preventing “false good” inflation.

---

## 4) Next concrete implementation steps (for owner)
1. **Schema:** add a field in evaluations or overall JSON like `overall.unscorableReason` (or use verdict=`unknown`).
2. **Metric split:** update metric computation for `evaluator.low-quality-rate-24h` to:
   - numerator: NI sessions with scorable=true
   - denominator: scorable=true
3. Add new metrics:
   - `evaluator.unscorable-rate-24h`
   - `evaluator.transcript-error-rate-24h`
   - `evaluator.runner-interruption-rate-24h`
4. **Behavior remediation:** add a small “git hygiene” reminder to workflows that commonly hit `finish blocked by uncommitted changes`.

---

## Appendix — bucket query used in this iteration
```sql
WITH e AS (
  SELECT agent, verdict, issues, quality, efficiency
  FROM evaluations
  WHERE createdAt > (strftime('%s','now')-24*3600)
)
SELECT
  CASE
    WHEN json_extract(issues,'$[0]')='schema/query error in transcript' THEN 'PIPELINE: transcript parse/schema'
    WHEN json_extract(issues,'$[0]') IN ('terminal status: interrupted','terminal status: error') THEN 'PIPELINE: terminal/runner'
    WHEN json_extract(issues,'$[0]') LIKE 'shallow_session:%' THEN 'PIPELINE?: shallow/heartbeat'
    WHEN json_extract(issues,'$[0]')='finish blocked by uncommitted changes' THEN 'AGENT: git hygiene'
    ELSE 'OTHER'
  END AS bucket,
  COUNT(*) total,
  SUM(CASE WHEN verdict='needs_improvement' THEN 1 ELSE 0 END) ni,
  ROUND(1.0*SUM(CASE WHEN verdict='needs_improvement' THEN 1 ELSE 0 END)/COUNT(*),3) ni_rate,
  ROUND(AVG(quality),3) avg_q,
  ROUND(AVG(efficiency),3) avg_e
FROM e
GROUP BY bucket
ORDER BY total DESC;
```
Observed (24h):
- PIPELINE?: shallow/heartbeat: total **1016**, ni_rate **1.0**
- AGENT: git hygiene: total **142**, ni_rate **1.0**
- PIPELINE: terminal/runner: total **74**, ni_rate **1.0**
- PIPELINE: transcript parse/schema: total **60**, ni_rate **1.0**
- OTHER: total **2241**, ni_rate **0.361**
