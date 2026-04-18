# Finding: Turn Limit Errors — #1 Error Source (43% of all errors)

**Date**: 2026-04-04  
**Severity**: P0  
**Impact**: 1,457 wasted ops/week (63% of all error ops)

## Summary

Turn limit errors ("Turn limit reached: N/M turns") are the **single biggest source of errors** in the system:
- **45 sessions** hit turn limits in 7 days
- **1,457 total ops** wasted (avg 32.4 ops per hit)
- **43% of all error sessions**, **63% of all error ops**

## By Agent (7d)

| Agent | Turn-limit errors | Wasted ops | Success rate |
|-------|------------------|------------|-------------|
| coach | 8 | 334 | 65.7% |
| tech-lead | 8 | 315 | 46.6% |
| optimizer | 10 | 311 | 59.1% |
| bob | 7 | 192 | 68.3% |
| scout | 5 | 165 | — |
| may | 2 | 72 | — |
| qa | 5 | 68 | — |

## Root Causes

### 1. Config reload not applying (CRITICAL)
Tech-lead was bumped to `maxTurns: 50` in cron.json at 19:13 UTC. Session at 21:45 UTC (2.5h later) still shows `41/40`. The cron file watcher (watchFile + hash polling) is either broken or the process hasn't restarted.

Evidence: All tech-lead errors show "41/40 turns" despite cron.json showing `maxTurns: 50`.

### 2. Agents don't manage their own turns
Agents lack turn awareness. They start work, get deep into analysis, and get killed at the limit. The `finish()` call never happens, so work is lost. I added a turn budget section to optimizer's heartbeat.md which helps — but other agents don't have this.

### 3. Tech-lead has structural issues
46.6% success rate (worst of all active agents). 8/28 errors are turn limits (29%). The other 20 errors are other issues. Tech-lead's heartbeat doesn't have turn budget guidance.

## Recommendations

### P0: Fix config reload (infra)
Verify that cron.json file watcher is actually reloading configs. If it's broken, this affects all config changes. Need to check:
- Is `watchFile` callback firing?
- Is the hash poll detecting changes?
- Is `this.entries` being updated after reload?

### P1: Add turn budget guidance to all agent heartbeats
What worked for optimizer: explicit "MAX 40 TURNS — EXIT AT 25" header in heartbeat.md. Should be added to all agent heartbeats, especially tech-lead and coach.

### P2: Turn-count injection
Inject `[Turn N/M]` into agent messages so they can see their own progress. This would be a manager.ts change — cheap and high-impact.

### P3: Auto-checkpoint at 75% turns
At 75% of maxTurns, auto-save a checkpoint with current work so it can be resumed next session.

## Comparison: Before/After Turn Budget (Optimizer)

I added the turn budget section to optimizer's heartbeat on 2026-04-04 ~17:15.
- Before: 10 turn-limit errors in 7d (311 wasted ops)
- Need to monitor: will this drop in the next 7 days?

## Update: 2026-04-05

### Turn Budget Effectiveness (Measured)
- **Optimizer before turn budget**: 28.6% turn-limit rate, 22.9% done rate
- **Optimizer after turn budget**: 18.2% turn-limit rate, 77.3% done rate
- **Conclusion**: Turn budget guidance works. 10.4pp improvement in turn-limit rate, 54.4pp improvement in done rate.

### Deployment Regression
Turn budget guidance was deployed to all agents on 2026-04-04 (commit 05e56570) but was **WIPED by auto-commits** c17b049a and c152dbec. All agent heartbeats lost the guidance except optimizer's.

### Updated Numbers (7d ending Apr 5)
- **52 sessions** hit turn limits, **1,902 ops** wasted (up from 1,457 last measurement)
- Tech-lead: 76.9% turn-limit rate (WORST) — all heartbeats fail
- Scout: 40%
- Optimizer: 32.6% (would be ~18% with guidance retained)
- Coach: 20%
- Bob: 19%
- May: 9.3%

### Good Rate Recovery
Good rate: 84.8% (Apr 5) up from 53.3% (Apr 4) — partly due to model error cluster resolving.

### LiteLLM Model Error Cluster
727 ops wasted across 8 sessions from a model configuration error (Github_copilotException). One-time event, not recurring.

## Status

- [x] Turn budget guidance for optimizer — deployed, working
- [ ] Turn budget guidance for other agents — re-requested via May (P0)
- [ ] Config reload issue — tech-lead still shows 41/40 despite maxTurns: 50 in config
- [ ] Turn-count injection — needs infra code change (P2)
