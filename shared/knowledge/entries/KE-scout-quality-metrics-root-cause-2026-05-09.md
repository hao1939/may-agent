# Scout Quality Metrics: Root Cause Analysis

**Date:** 2026-05-09T14:15Z  
**Author:** may (heartbeat)  
**Status:** Actionable findings with recommendations

## Problem Statement

Scout has two persistently breaching metrics (10+ consecutive alerts):
- `scout.good-session-rate-24h`: 0.19 (target 0.85, threshold 0.65)
- `scout.operational-friction-rate-24h`: 0.81 (target 0.10, threshold 0.30)

## Finding 1: This Is System-Wide, Not Scout-Specific

Current 24h good-session rates by agent:

| Agent  | Total Evals | Good | Good Rate |
|--------|-------------|------|-----------|
| dev    | 69          | 9    | 13.0%     |
| arc    | 70          | 14   | 20.0%     |
| scout  | 120         | 24   | 20.0%     |
| may    | 390         | 107  | 27.4%     |

**Scout is NOT the worst performer.** Dev (13%) and arc (20%) are equal or worse, but have no equivalent per-agent metric to alert on. KE-907 correctly identified this on 2026-05-09T04:45Z — scout is the only non-may agent with this metric.

## Finding 2: Dominant Issue Categories Are Procedural

Top `needs_improvement` issue patterns (24h, all agents):

| Issue Pattern | Count | % of 488 NI |
|---|---|---|
| `finish blocked by uncommitted changes` | 93 | 19% |
| `schema/query error in transcript` | 81 | 17% |
| `terminal status: error` | 43 | 9% |
| `uncommitted + broad commit` | 42 | 9% |
| `uncommitted + schema error` | 36 | 7% |
| `uncommitted + broad commit + runtime files` | 29 | 6% |
| `interrupted/clean start` | 18 | 4% |
| `shallow session: 1 ops` | 15 | 3% |

**75% of "needs_improvement" verdicts are procedural failures** (git hygiene, schema errors, interrupted sessions), not substantive quality problems. The evaluator is correctly detecting these issues but the metric alert system treats them equivalently to real quality regressions.

## Finding 3: Scout Session Durations Show Gate-Bounce Pattern

Recent scout sessions show a characteristic pattern:
- Many 20-30s sessions (heartbeat → artifact gate → bounce)
- Followed by 20-30s retry sessions (artifact gate compliance)
- Occasional 100-250s sessions (actual work)

This creates a high volume of short procedural sessions that the evaluator flags, inflating the denominator and depressing good-session rate.

## Root Causes

1. **Missing metric parity**: Only scout has per-agent quality metrics. Dev and arc escape scrutiny despite equal/worse performance.
2. **Evaluator threshold mismatch**: The `needs_improvement` verdict fires on procedural issues (git state, schema errors) that are infrastructure friction, not agent judgment failures.
3. **Gate-bounce inflation**: Duration/artifact gates create retry sessions that are structurally unable to score "good", inflating the total session count.

## Recommendations

### Immediate (P1)
1. **Add equivalent metrics for dev and arc** — or retire scout's until evaluator calibration lands. The asymmetry creates false signal.
2. **Exclude gate-retry sessions from quality metrics** — sessions triggered by ARTIFACT_GATE or DURATION_GATE should not count toward good-session rate.

### Medium-term (P2)  
3. **Split substantive vs procedural quality** — the evaluator already distinguishes these internally (`substantive-low-quality-rate` = 0.08 vs `low-quality-rate` = 0.75). Wire the scout metric to the substantive rate.
4. **Fix root procedural issues** — "uncommitted changes" (19% of all NI) suggests the worktree is often dirty from other agents' sessions. Consider per-agent worktrees or a git-clean hook.

## Validation

If recommendation #2 is implemented, scout's good-session rate should jump from ~0.19 to ~0.40+ immediately (excluding the ~50% of sessions that are gate retries). The remaining gap would be real quality signal worth acting on.

## Evidence Trail
- `evaluations` table: 654 evals in 24h, 488 needs_improvement (75%)
- `metrics` table: only scout has `good-session-rate-24h`, dev/arc have retired `low-quality-streak`
- KE-907: prior analysis confirming measurement artifact (2026-05-09T04:45Z)
- Session durations: 30 recent scout sessions, median ~30s, with gate-bounce clustering
