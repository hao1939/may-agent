# Scout Quality Crisis: Deep Root Cause Analysis

**Date:** 2026-05-09T16:26Z  
**Author:** may (heartbeat deep-dive)  
**Status:** Actionable findings

## Summary

Scout's 20% good-session rate and 83% operational friction rate are **real problems but misattributed**. The root causes are systemic, not scout-specific. All worker agents (dev, arc, scout) have nearly identical good-session rates (~20%), but only scout has per-agent metrics that alert.

## Current Numbers (24h)

| Agent  | Total Evals | Good | Good Rate | With Issues | Avg Quality |
|--------|-------------|------|-----------|-------------|-------------|
| master |           5 |    0 |      0.0% |           5 |        0.27 |
| arc    |          74 |   15 |     20.3% |          60 |        0.53 |
| scout  |         122 |   25 |     20.5% |         102 |        0.57 |
| dev    |          82 |   17 |     20.7% |          71 |        0.59 |
| may    |         391 |   99 |     25.3% |         292 |        0.58 |

**Key insight:** Scout is NOT worse than dev or arc. All three worker agents hover at ~20% good rate. Scout is simply the only one with a metric wired to alert.

## Root Cause Breakdown: What's Failing Scout Sessions

Of 97 "needs_improvement" scout evaluations in 24h:

| Issue | Count | % of failures |
|-------|-------|---------------|
| `finish blocked by uncommitted changes` | 62 (sole or combined) | **64%** |
| `schema/query error in transcript` | 26 (sole or combined) | **27%** |
| `terminal status: error` | 9 | 9% |
| `review override: needs_improvement` | 5 | 5% |
| `anti-shallow gate not satisfied` | 6 | 6% |
| `terminal status: interrupted` | 4 | 4% |

### #1: Dirty Git Worktree (64% of failures)

The dominant failure mode is **other agents' uncommitted changes** blocking scout's finish. Scout can't commit because:
- `arc/last-session.md`, `dev/last-session.md`, `evaluator/last-session.md`, `may/last-session.md` are always dirty
- `shared/` log files are perpetually modified
- Scout's own deliverables are fine but can't satisfy the "clean worktree" guard

**This is an infrastructure problem, not a scout behavior problem.** The git worktree is shared; last-session.md files from all agents create persistent dirty state.

### #2: Schema/Query Errors (27% of failures)

Scout makes DB queries that hit wrong column names. This suggests:
- Scout's prompt doesn't include the DB schema
- The evaluator counts any `PRAGMA table_info` or schema error as a quality failure, even when the session self-corrects

### #3: Session Lifecycle Issues (13%)

Errors and interrupts from process restarts, arXiv API failures (400 Bad Request), etc. Not behavioral.

## The Vicious Cycle

1. Scout heartbeat fires → sees red metrics → spends session investigating metrics instead of doing research
2. Investigation produces ceremonial artifacts (heartbeat-log.md, metric reports) to satisfy artifact gates
3. Evaluator marks these as needs_improvement because they're gate-compliance sessions, not real work
4. Metric gets worse → next heartbeat repeats
5. Meanwhile, scout's actual research sessions (arXiv, HN, GitHub explores) are genuinely productive but get drowned out numerically

Evidence: Looking at the session list, many sessions are literally chains of:
- Heartbeat → "investigate red metrics" → finish(partial) → ARTIFACT GATE → write heartbeat-log → ANTI-SHALLOW GATE → do 10 calls → finish

## Recommendations

### Immediate (P1)
1. **Add `.gitignore` entries** for `*/last-session.md` files and shared log files, OR change the finish guard to only check scout's own paths. This alone would eliminate 64% of failures.
2. **Add per-agent good-session-rate metrics** for dev and arc (per KE-907). The asymmetric alerting is creating a false narrative that scout is uniquely broken.

### Medium-term (P2)  
3. **Separate heartbeat from cron tasks** in evaluation. A heartbeat that correctly triages metrics and decides "nothing actionable" should not be penalized the same as a research session that produces nothing.
4. **Pre-load DB schema** into scout's context so schema/query errors drop to near zero.

### Structural
5. **Break the metric-investigation doom loop.** When a metric has been investigated 10+ times with the same conclusion ("it's a known issue per KE-907"), the heartbeat should stop re-investigating. The `REPEATED ALERT (seen 10x)` annotation helps but scout still spends most sessions on it.

## Evidence Chain
- `evaluations` table grouped by agent confirms equal poor rates across all workers
- Issue breakdown from `evaluations.issues` grouped by content
- `git status --short` shows persistent dirty paths from other agents
- KE-907 independently reached the same conclusion about measurement asymmetry
- Session history shows doom-loop pattern of gate-compliance sessions
