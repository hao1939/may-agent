# Finding: Eval Quality Drop Mar 30

**Date**: 2026-03-30T06:10
**Type**: Cost & Efficiency / Quality Monitoring

## Summary
Good eval rate dropped from 84% (yesterday) to 69% (today). Investigated root causes.

## Data
| Period | Sessions | Good | Acceptable | NI | Skipped | Good% |
|--------|----------|------|------------|-----|---------|-------|
| Day -0 | 184      | 125  | 36         | 5   | 14      | 69%   |
| Day -1 | 141      | 118  | 13         | 3   | 7       | 84%   |
| Day -2 | 177      | 142  | 19         | 1   | 15      | 80%   |

## Root Causes
The drop is driven by 3 distinct clusters, NOT a systemic quality decline:

### 1. Coach Training Sprint Burst (09:00-09:30 UTC)
- 7 sessions with FM failures: SCOPE_DRIFT, ENV_MISREAD, wrong paths, npm install errors
- Sessions: 55ops, 30ops, 29ops, 28ops, 24ops, 21ops, 0ops
- Issues: growth-cycle/sprint-planning sessions using invalid paths, misinterpreting exit codes
- **Impact**: 7 acceptable + 2 needs_improvement ratings from one sprint

### 2. Connectivity Outage Residuals (13:06-13:21 UTC)
- 4 optimizer sessions rated acceptable (0ops, session_error from outage)
- 1 coach session rated needs_improvement (0ops, session_error)
- **Impact**: 5 inflated ratings from infrastructure, not quality

### 3. Tech-lead jsonSchema Bug (recurring)
- 5 sessions rated acceptable (0ops each, same bug)
- Known recurring issue: `undefined is not an object (evaluating 'jsonSchema.properties')`
- **Impact**: 5 inflated ratings from a dependency bug

## Assessment
- **Infrastructure-caused**: 10 of 41 non-good ratings (optimizer outage + tech-lead bug)
- **Real quality issue**: 7 coach sprint sessions with genuine FM failures
- **Adjusted good rate**: ~78% (excluding infrastructure errors) vs 84% yesterday — minor decline
- The coach sprint failures are concerning but contained to one burst, not a trend

## Recommendations
1. Evaluator should consider excluding 0-ops error sessions from quality metrics (they inflate "acceptable" artificially)
2. Coach sprint-planning needs to handle path errors more gracefully
3. Tech-lead jsonSchema bug should be fixed to stop the recurring error noise

## System Health
- 184 sessions/24h, 1981 ops, 10.8 avg ops/session
- Process: may-agent-f83555f (HEAD), uptime ~15h
- Tool waste: 2.80% (stable)
- may.db is at `.state/may.db` (25MB, healthy) — the root `may.db` is a 0-byte leftover
