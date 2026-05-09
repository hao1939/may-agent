# Iteration 1 deliverable — Heuristic v2 calibration plan (reduce evaluator.low-quality-rate-24h)

## What we need to fix (non-gaming)
The current `evaluator.low-quality-rate-24h` is dominated by **heuristic v2** evaluations (see `overall.heuristicVersion=2`) and the heuristic v2 rubric currently maps *any* detected “process/hygiene issue” to `verdict="needs_improvement"` at `quality=0.55`.

This means the metric is currently measuring **(task quality OR workflow hygiene)** rather than “needs_improvement as a meaningful signal about solution quality”. The goal is not to hide failures, but to **separate signal types** so the metric matches the goal.

## Evidence (DB)
### 1) Heuristic v2 is the driver
Query (runtime DB):
```sql
SELECT json_extract(overall,'$.heuristicVersion') hv,
       COUNT(*) n,
       SUM(verdict='needs_improvement') ni,
       1.0*SUM(verdict='needs_improvement')/COUNT(*) rate
FROM evaluations
WHERE createdAt >= (strftime('%s','now')-24*3600)*1000
GROUP BY hv;
```
Observed (2026-05-08):
- `hv=2`: **292** evals, **NI-rate 0.637**
- `hv=NULL`: **169** evals, **NI-rate 0.172**

### 2) LLM lane is currently absent
```sql
SELECT datetime(MAX(createdAt),'unixepoch') lastLLM
FROM evaluations
WHERE evaluatedByHeuristic=0;
```
Observed: `NULL` (no LLM evaluations recorded in current DB).

So: until LLM eval is restored, the heuristic is the sole driver of the metric.

## Mechanism (where the behavior is coming from)
Heuristic v2 is implemented in:
- `agents/evaluator/workflows/evaluator-aftermath.ts`
  - `HEURISTIC_VERSION = 2`
  - `classifyVerdict(session, transcript)`
  - **Rule:** if `failed || issues.length` then `verdict='needs_improvement'`; else `good`.
  - `issues` include:
    - terminal statuses (`error`, `interrupted`) and any `session.error`
    - “finish blocked by uncommitted changes” (transcript string match)
    - “schema/query error in transcript” (`no such table/column` regex)
    - “metric health claim without live evidence” heuristic
    - “workflow live signal injection unavailable”
    - anti-shallow gate not satisfied

This is useful as a *triage tool*, but too aggressive as the sole determinant of “needs_improvement”.

## Proposed calibration change (iteration-1 concrete proposal)
### A) Split `needs_improvement` into two buckets inside `overall`
Without changing DB schema, we can embed a new field in `overall`:
- `overall.lowQualityCategory`: one of
  - `"outcome"` (bad/incorrect/incomplete result)
  - `"process"` (hygiene / guard / evidence protocol failures)
  - `"infra"` (workflow injection unavailable; transcript missing; evaluator pipeline issues)

This avoids gaming because we still record the issues, but can define the metric on the right bucket.

### B) Change verdict mapping for *process-only* issues
Change `classifyVerdict` mapping:
- Keep `needs_improvement` for:
  - `status in ('error','interrupted')` OR `session.error` (true failure)
  - anti-shallow gate not satisfied (likely low-quality work)
- For “process-only” issues (examples):
  - finish blocked by uncommitted changes
  - metric health claim without live evidence
  - broad may/shared commit during session
  - committed generated runtime files
  - schema/query error **IF** session status is `done` and there is no other failure

…map to a new `verdict='good'` **but** reduce quality to e.g. `0.7` and set `overall.lowQualityCategory='process'`.

Rationale: these sessions may have perfectly fine task outcomes, but violate process/evidence rules; they should be visible via a separate metric, not dominate task-quality NI-rate.

If keeping verdict taxonomy fixed is required, alternate:
- Keep verdict as `needs_improvement` but adjust the *metric query* to count only outcome failures (see section D).

### C) Keep heuristic v2 as triage, add a second “outcome quality” heuristic
Add a second pass that looks for **actual outcome problems** (still heuristic, but outcome-focused), e.g.:
- claims “tests pass” without test output (already present as “metric health claim without evidence”; extend to tests)
- writes code but no verification evidence for changed files
- tool hallucination patterns

This would populate `overall.lowQualityCategory='outcome'` and would be the metric’s numerator.

### D) Update metric definition (preferred if we can change metrics safely)
Redefine `evaluator.low-quality-rate-24h` to count only *outcome* category.
Example query shape:
```sql
SELECT 1.0 * SUM(
  verdict='needs_improvement'
  AND COALESCE(json_extract(overall,'$.lowQualityCategory'),'outcome')='outcome'
) / COUNT(*)
FROM evaluations
WHERE createdAt >= (strftime('%s','now')-24*3600)*1000;
```
Then create separate metrics:
- `evaluator.process-issue-rate-24h`
- `evaluator.infra-issue-rate-24h`

This is explicitly **not gaming**: it makes the “needs_improvement” signal meaningful by aligning the metric with the concept it intends to measure.

## Why this should move the metric ≤ 0.10
Given the observed split (v2 NI-rate ~0.64), most of those NI classifications are currently coming from `issues.length>0` triggers that are process-related.

If we (1) keep outcome failures as NI and (2) recategorize process-only into non-NI (or remove from numerator via category), the numerator drops sharply.

We should validate with a one-time backtest query over the last 24h:
- Count how many NI sessions have only process issues vs terminal failure.

## Implementation checklist (next iteration; not done here)
1. Edit `agents/evaluator/workflows/evaluator-aftermath.ts`:
   - Add a `categorizeIssues(issues, session)` helper.
   - Modify `classifyVerdict` to produce `{ category }` and either:
     - change `verdict` mapping OR
     - keep verdict but annotate category.
2. Update metric SQL for `evaluator.low-quality-rate-24h` (or create a new metric ID and transition dashboards).
3. Add tests under `agents/shared/tests/` validating:
   - process-only issues do not force NI (if we change verdict mapping)
   - category is set correctly
4. Roll out, then monitor:
   - heuristic-share remains 1.0 until LLM restored
   - NI-rate drops toward target, while process-issue-rate remains visible

## Notes / Risks
- If other parts of the pipeline assume verdict is binary (`good` vs `needs_improvement`), changing verdict mapping might be risky. In that case, **do not change verdict**; only change the metric definition to filter by category.
- Restoring LLM eval coverage remains important; heuristic should not be sole arbiter long-term.
