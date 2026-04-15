# Improvement Proposals Review — Cycle 19
**Date**: 2026-03-30T09:10 UTC  
**Period**: Since Cycle 18 (2026-03-29 21:10)

## Key Changes Since Last Review

### Code Changes (3 meaningful commits)
1. **opBudget enforcement REMOVED** (84e05c6, bc2588a8, 898d0850) — Always unlimited now. This means agent sessions are no longer constrained by opBudget config. Impact: coach common-sense-verify was previously hitting limits; now sessions run to natural completion. The 35-op heartbeat budget for optimizer is prompt-based only.
2. **ENV_FACTS injected into growth-cycle workflows** (83d28fc6) — FM-2.1 path-guessing fix. Coach growth-cycle was spawning coder sessions that guessed wrong paths (/home/user, etc). Now ENV_FACTS (bun location, npx unavailability, /app root) are injected into workflow prompts.
3. **vitest .state/ exclusion** (aee8a66) — Removes 175 spurious cache test files from test runs.

### System State
- **Sessions**: 183/24h, 1961 ops (10.7 avg) — stable
- **Quality**: 97.4% good+acceptable (6h), 75% good rate (daily) — good rate dip driven by coach "acceptable" verdicts (quality scoring variation, not failures)
- **3-day quality trend**: good+acceptable steady at 97-99%
- **Tool waste**: 2.36% (improving from 2.65%, best reading ever)
- **Errors**: tech-lead jsonSchema only (recurring, known, 0 ops each)
- **Process**: f83555f running 18h, stable

### Active Coder Sessions
4 coder sessions appeared in last 24h (8-14 ops each) — first coder activity in several days. Spawned by coach growth-cycle. This is healthy: the coach→coder pipeline is working.

## Status of Open Initiatives

### ✅ CLEARED (no longer blockers)
- **Process restart wall**: CLEARED since Cycle 18. f83555f running, all handlers active.
- **Tool quality handler**: FIRING. Baseline generated every 4h. Waste trending down.
- **Bob recovery**: Stable for 3+ days. 30% of system ops. Healthy.

### 🔄 STILL OPEN
1. **ANTHROPIC_API_KEY for prompt caching** — No progress. Savings potential ~$23-47/day. Nobody has added the env var.
2. **meta.json cost tracking** — No progress. Still showing $0.00 per session. Sent to tech-lead (req:0f5e25e7) but not implemented.
3. **Coder tool waste** — Coder is #1 offender across 4 waste categories (bash:other, bash:nonexistent-path, bash:cmd-not-found, edit:edit-match-fail). 4 new coder sessions today show waste is ongoing. ENV_FACTS injection (83d28fc6) should help with path guessing — monitor next cycle.
4. **tech-lead jsonSchema error** — Recurring every ~hour, 0 ops. Low priority but adds noise.

### 📊 Metrics Evolution
| Metric | Cycle 17 (Mar 28) | Cycle 18 (Mar 29) | Cycle 19 (Now) |
|--------|-------------------|-------------------|----------------|
| Sessions/24h | ~180 | ~182 | 183 |
| Ops/24h | ~1900 | ~2060 | 1961 |
| Tool waste | 2.8% (last known) | 2.67% | 2.36% |
| Errors/24h | tech-lead only | 0 | 1 (tech-lead) |
| Quality (g+a) | 97% | 99% | 97.4% |
| Skills | 54 (saturated) | 54 | 54 |
| Handlers | 22 | 22 | 22 |
| Process | 64 commits behind | HEAD (f83555f) | HEAD (f83555f) |

## Priorities for Next Cycle
1. **Monitor coder waste post-ENV_FACTS fix** — Does path guessing decrease with 83d28fc6?
2. **Coach quality scoring** — Investigate why coach gets "acceptable" instead of "good" (q=0.55 vs q=5). May be evaluator calibration issue rather than coach behavior.
3. **ANTHROPIC_API_KEY** — Re-escalate if no progress by next weekly review.

## Summary
System is in excellent health. Tool waste at all-time low (2.36%). Quality stable at 97%+. The opBudget removal is notable — it means prompt-based budgets are the only constraint now. The ENV_FACTS injection for growth-cycle is a good targeted fix. No new interventions needed this cycle — the system is running efficiently and improving organically.
