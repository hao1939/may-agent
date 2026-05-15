# Evaluator low-quality-rate 24h deep dive (2026-05-09)

## Why this artifact exists
The `evaluator.low-quality-rate-24h` metric is persistently red (~0.64 vs threshold 0.3), but the related `evaluator.substantive-low-quality-rate-24h` is green (~0.089). This suggests the alert is dominated by hygiene/pipeline/unscorable failures rather than actual low-quality agent work.

This note quantifies the top drivers and proposes concrete pivots/fixes.

## Current metric snapshot (DB)
From `metrics` table:
- `evaluator.low-quality-rate-24h`: **0.6436** (threshold 0.3, target 0.1)
- `evaluator.substantive-low-quality-rate-24h`: **0.0886** (threshold 0.3, target 0.1)
- `evaluator.false-good-rate-sample`: **0.3913** (threshold 0.6, target 0.05)

(Queried at the same `updated_at` timestamp.)

## 24h evaluation population composition
From `evaluations` in last 24h:
- total evaluations: **464**
- `needs_improvement`: **299** (implied rate 0.644)
- `evaluatedByHeuristic=1`: **462** (≈ 99.6%)

Implication: the red metric is almost entirely driven by heuristic evaluation, not LLM evaluation.

## Top NI issue bundles (last 24h)
Grouping `evaluations.issues` (stored as TEXT, often JSON-looking) among `verdict='needs_improvement'`:

| issues bundle | count |
|---|---:|
| `["finish blocked by uncommitted changes"]` | 59 |
| `["schema/query error in transcript"]` | 52 |
| `["finish blocked by uncommitted changes","broad may/shared commit during session"]` | 52 |
| `["finish blocked by uncommitted changes","schema/query error in transcript"]` | 25 |
| `["finish blocked by uncommitted changes","broad may/shared commit during session","committed generated runtime files"]` | 24 |
| `["terminal status: interrupted","error: Clean start (fresh)"]` | 15 |
| `["terminal status: error"]` | 13 |

### Derived rollups (lower bound)
Because bundles overlap, rollups below are **lower bounds** computed by summing bundles that explicitly include the string.

- **finish blocked by uncommitted changes**: at least 59+52+25+24 = **160 NI** (53.5% of NI)
- **schema/query error in transcript**: at least 52+25 = **77 NI** (25.8% of NI)
- **terminal interrupted/error**: at least 15+13 = **28 NI** (9.4% of NI)

These three categories alone account for a large majority of NI.

## Interpretation: what’s actually being measured?
The dominant drivers are *process/hygiene and transcript/runner issues*:
- `finish blocked by uncommitted changes` is a **workflow/guard failure**, not task quality.
- `schema/query error in transcript` is typically an **agent tool misuse** (bad SQL) *or* transcript corruption/partial capture; either way it is not “low-quality work” in the human sense.
- `terminal status: interrupted` / `Clean start (fresh)` looks like **runner lifecycle** rather than work quality.

This matches the observed divergence:
- broad low-quality-rate ~0.64 (counts these as NI)
- substantive low-quality-rate ~0.089 (filters toward actual task-quality problems)

## Recommendations (ordered by expected impact)

### 1) Operational: stop counting unscorable/hygiene-only sessions as NI in the *headline* metric
If the system wants a single page-worthy health metric, it should reflect substantive quality.

Action options:
- **Pivot alerting** from `evaluator.low-quality-rate-24h` → `evaluator.substantive-low-quality-rate-24h`.
- Or redefine `evaluator.low-quality-rate-24h` to exclude clearly non-substantive classes (finish-blocked, interrupted/clean-start, transcript schema errors) and track them as separate error-budget metrics.

Why: otherwise the alert is mostly measuring “guard friction + transcript/tool reliability,” which requires a different owner and response playbook.

### 2) Fix the single biggest driver: “finish blocked by uncommitted changes”
This is the most frequent NI trigger and is plausibly fixable with behavior and/or guard improvements.

Candidate interventions:
- Add more explicit pre-finish hygiene checklist in agent instructions (or auto-run `git status --porcelain` and prompt to clean up before `finish()`).
- Ensure `agents/shared/projects/**` is not treated as writeable/committable in workflows (it is often gitignored, leading to unavoidable dirty state).
- Consider evaluator rubric: classify uncommitted-changes finish block as a *separate verdict class* (unscorable) rather than NI, if it prevents delivering any real output.

### 3) Reduce “schema/query error in transcript” false penalties
This might be conflating two things:
- genuine SQL mistakes by agents
- evaluator parsing errors / transcript truncation

Next step to disambiguate:
- sample 10 sessions from this bucket and inspect whether the query failure is (a) agent misuse vs (b) transcript/evaluator issue.

### 4) Confirm why LLM evaluation is absent
462/464 are heuristic. If LLM eval is expected but down, the broad metric is being skewed by heuristic step-function scoring.

Next step:
- check recent sessions where evaluatedByHeuristic=1 but should have had LLM eval; find the pipeline switch/feature flag.

## Concrete next queries (for follow-up)
1. Sample sessionIds for the top bucket and join to sessions to see agent + status:
```sql
SELECT e.sessionId, e.agent, e.issues, s.status, s.error
FROM evaluations e
JOIN sessions s ON s.sessionId=e.sessionId
WHERE e.createdAt > (strftime('%s','now')-86400)*1000
  AND e.issues='["finish blocked by uncommitted changes"]'
LIMIT 20;
```

2. Determine if `issues` is valid JSON enough to unnest more robustly:
```sql
SELECT
  SUM(CASE WHEN json_valid(issues) THEN 1 ELSE 0 END) json_ok,
  COUNT(*) total
FROM evaluations
WHERE createdAt > (strftime('%s','now')-86400)*1000;
```

## What would “good” look like
- Headline alert based on substantive quality stays <0.3 consistently.
- Hygiene/process metrics exist and page the correct owner (workflow/infra) with actionable playbooks.
- LLM evaluation is re-enabled (if intended), reducing reliance on heuristic.
