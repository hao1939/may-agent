# Improvement Proposals Review — Cycle 18
**Date**: 2026-03-29T21:10 UTC
**Period**: Since Cycle 17 (2026-03-28T09:06)

## System Summary (36h)
- **Sessions**: ~40 sessions since Cycle 17 (very quiet, ~1.1/hr avg)
- **Errors**: Zero errors since connectivity outage (13:06-13:21 Mar 29)
- **Process**: PID 52 running may-agent-f83555f (HEAD), restarted at 15:07 UTC Mar 29
- **Binary**: f83555f = HEAD, all blocked improvements now active

## Code Changes (18 commits since Cycle 17)

### Chat/Console Infrastructure (12 commits)
Major Hao-directed work on chat/web UI:
- `e98bf59`..`f83555f`: Chat sessions survive finish(), persist across restarts, web UI improvements
- `debceba`: Simplified console UI
- `64f1a6d`, `971bfab`: Orphan session cleanup fixes
- **Impact**: User-facing features, minimal impact on agent operations

### Guard Evolution (4 commits)
- `36f0c27`: Path hallucination guard
- `45812bc`: Gate 3 contradictory finish status guard
- `ca53a87`: Gate 3b transcript contradiction detection
- `b12c138`: **REVERT** — removed 3 harness guards, replaced with context.md facts
- **Impact**: Guard strategy shifted from code-level guards to context.md facts per Hao directive. Net change: +1 guard (finish-guard Gates 3/3b), -3 guards (reverted). Guards deprioritized.

### Agent Config (2 commits in agents repo)
- `06e362e2`: context.md facts added for path and finish-status (replacing reverted guards)
- `a53c889c`: reviewed-delivery workflow — evidence-gate before sending briefs

## Infrastructure Health

| Metric | Value | Trend |
|--------|-------|-------|
| Binary | f83555f (HEAD) | ✅ Current |
| Process uptime | 6h (since 15:07) | Fresh |
| Handlers | 22 | Stable |
| Skill files | 49 | Stable (-2 from guard reverts?) |
| Cron entries | 37 | Stable |
| Sessions/24h | ~20 (very quiet) | Low activity |
| Errors/24h | 0 | ✅ Perfect |
| Tool waste | 2.67% (70/2624) | 1.3% → 2.8% → 2.7% (stable) |

## Key Findings

### 1. Process Restart Wall CLEARED ✅
The #1 bottleneck from Cycles 15-17 is resolved. Binary f83555f = HEAD, process restarted at 15:07. All previously blocked items are now active:
- Tool quality handler generating JSON data ✅
- Path hallucination guard active ✅
- Circuit breaker gap fix active ✅
- maxTurns enforcement active ✅
- All context.md facts loaded ✅

### 2. System Very Quiet Post-Restart
Only ~20 sessions in 6h since restart. No stress testing of the new binary yet. Need more data before drawing conclusions about regression.

### 3. Tool Waste Stable at 2.7%
Trend: 1.3% → 2.8% → 2.7% → 2.67%. Three consecutive readings around 2.7%. Main offenders:
- bash:other = 36 (51% of waste) — qa, coach, coder
- bash:nonexistent-path = 12 — coder, coach
- bash:cmd-not-found = 8 — coder, qa
- edit:edit-match-fail = 4 — coder only
- **Coder is worst offender** across 4 categories

### 4. Skill Lifecycle Saturated
4th consecutive "no new skill needed" finding. 49 skills. Library effectively complete for current behavioral patterns. Switched to weekly/on-demand cadence.

### 5. Guards Deprioritized
Per Hao directive, guard development stopped. 3 guards reverted (b12c138), replaced with context.md facts. Only finish-guard enhancements retained (Gates 3/3b for contradictory finish status).

## Open Items & Priorities

### Still Active
1. **Coder tool waste** — Coder is #1 offender for bash:nonexistent-path, bash:cmd-not-found, edit:edit-match-fail, write:empty-args. A targeted intervention (LESSONS.md update or context.md fact) could reduce waste by ~30 calls/day.
2. **ANTHROPIC_API_KEY** — Still not set. Prompt caching savings ($23-47/day) blocked.
3. **meta.json cost tracking** — Still $0.00 per session. No real cost visibility.

### Resolved Since Last Cycle
1. ✅ Process restart wall cleared
2. ✅ Tool quality handler generating data
3. ✅ Guard strategy clarified (deprioritized)

### Deferred
- Memory redesign Phase 3+ (awaiting Hao review)
- Coach common-sense-verify optimization (maxTurns now enforced)
- Periodic zombie cleanup (startup cleanup sufficient post-restart)

## Verdict
System is healthy and stable post-restart. Major infrastructure debt (restart wall) cleared. Remaining optimization opportunities are incremental: coder tool waste, prompt caching activation, cost visibility. No urgent action items. Next cycle should focus on coder waste intervention and validating gym baseline on new binary.
