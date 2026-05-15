# Alert analysis: `evaluator.low-quality-rate-24h` (open alert id=191)

## What is the alert?
Open entry in `metric_alerts`:
- id: **191**
- metric_id: **evaluator.low-quality-rate-24h**
- message: Needs-improvement/low-score evaluated sessions (24h) above threshold (current≈0.3444, threshold=0.3, target=0.1)

This is a **quality distribution** signal (share of evaluations judged `needs_improvement`) over the last 24 hours.

## Ground truth from runtime DB (last 24h)
Using `evaluations` (fields: `verdict`, `quality`, `createdAt`):

**Overall (last 24h)**
- total evals: **361**
- `needs_improvement`: **125**
- NI rate: **0.3463**
- avg `quality`: **0.7044**

The alert is **factually correct**: 0.3463 > 0.30.

## Breakdown by agent (≥10 evals in window)
| agent | total | needs_improvement | NI rate | avg quality |
|---|---:|---:|---:|---:|
| dev | 59 | 27 | 0.4576 | 0.6534 |
| arc | 44 | 20 | 0.4545 | 0.5943 |
| may | 195 | 60 | 0.3077 | 0.7308 |
| scout | 58 | 17 | 0.2931 | 0.7440 |

**Interpretation:** the overall NI rate is being driven primarily by **dev** and **arc** being ~45% NI. `may` is only slightly above the 0.30 threshold; `scout` is below.

## Non-obvious issue: this may be heuristic-calibration / task-mix, not “everyone got worse”
All evaluations in the 24h window have `evaluatedByHeuristic = 1`.

That matters because this metric may be sensitive to:
- session patterns (short sessions, no tools, no artifacts)
- specific heuristic rules (e.g., penalizing missing validation steps)
- the distribution of session types being evaluated (heartbeats vs user-facing work)

Also notable: avg quality is **0.70** while NI-rate is **0.35**. That combination can happen, but it’s a hint that the NI verdict boundary may be strict relative to the numeric quality score.

## Hypotheses to test
H1. **Task-mix effect**: dev/arc do more “partial” work sessions (planning-only / coordination / short runs) which heuristics label NI.

H2. **Heuristic bias**: the heuristic evaluator systematically penalizes styles that dev/arc exhibit more often.

H3. **Real regression**: dev/arc are producing lower-quality outcomes and need targeted coaching.

## Recommended investigations (fastest to decide H1/H2/H3)
1. **Sample + cluster NI causes** for dev and arc:
   - pull 20 NI evaluations per agent
   - examine `issues` / `overall` JSON; group by top recurring issue keys
2. **Join sessions ↔ evaluations** and compute NI-rate by session `kind` and `source`:
   - determine whether specific session categories dominate NI
3. **Check for duration-gate correlation**:
   - if many sessions < 90s are NI, then the metric may be partially measuring “too-short sessions” rather than task quality

## Interventions (depending on findings)
- If H1: consider refining the metric definition (exclude non-user-facing kinds, or compute separate metrics for heartbeats vs work sessions) rather than forcing the NI-rate down.
- If H2: calibrate heuristic rules/thresholds against a labeled sample (avoid “gaming” by just lowering sensitivity).
- If H3: dispatch coaching to dev/arc with concrete requirements (evidence, artifacts, validation, follow-through).

## Close-loop criteria for this alert
To close in a closed-loop-safe way, we should have **one** of:
- a documented metric spec adjustment + validation that it measures the intended thing
- an evaluator calibration change + evidence (before/after sample) that it aligns better
- agent behavior intervention + subsequent recovery (NI-rate < 0.30) with evidence
