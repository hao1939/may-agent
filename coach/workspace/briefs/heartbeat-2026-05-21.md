# Coach Heartbeat Brief — 2026-05-21

## Status: 🔴 Critical — Stuck Loop

**Quality trend**: 8 of last 10 evals = 0 (needs_improvement). Only 2 acceptable/good.
**Pattern**: Heartbeats are copy-paste of previous with no new work done.

## Metrics (all below target)
| Metric | Current | Target | Gap |
|--------|---------|--------|-----|
| Instruction compliance | 53 | 0.8 | Note: units mismatch (53 vs 0.8?) |
| Intervention hit rate | 47.3 | 0.6 | Same units issue |
| Skill effectiveness | 29.2 | 0.6 | Same units issue |
| Breadcrumb action rate | 0.31 | 0.8 | ⚠️ 39% of target |

## Core Problem

Both P0 projects (instruction-following, prove-the-loop) are **blocked on tech-lead** for structural enforcement. Coach has been reporting this for 5+ consecutive heartbeats with zero progress. This is a classic "waiting for someone else" stall.

## What Must Change

### 1. Stop waiting — find unblocked work
The blocked projects should NOT consume all bandwidth. Coach has proven mechanisms (forced externalization, strict workflow gates, cross-reference discovery) that are NOT deployed. Deploy what you have.

### 2. EXP-188 finish-guard — DO the wiring yourself
Code exists at `agents/src/lib/finish-guard.ts` and `agents/shared/guards/finish-guard.ts`. It's NOT imported anywhere. This is a trivial wiring task — investigate the integration point and either:
- Wire it yourself if it's in agents/ code you can edit
- Write a precise 5-line PR description for tech-lead (not a vague "please help")

### 3. EXP-190 gym issue — diagnose concretely
"agent_status:skipped" has been reported for 4 heartbeats. Spend ONE session reading the gym runner code to understand WHY, then file a specific bug.

### 4. Convention regressions — 12+ stale notifications
You have 12+ convention regression notifications (oldest 60+ days). Either batch-triage them or acknowledge they're not actionable.

## Recommended Next Session Priority
1. Wire EXP-188 finish-guard into production (or write exact integration code for tech-lead)
2. Read gym runner source to diagnose agent_status:skipped
3. Triage stale convention notifications (batch close or act)

## Anti-pattern to avoid
Do NOT write another heartbeat that says "both P0 projects blocked on tech-lead, metrics unchanged". That's been said 5 times. Either escalate with a concrete ask, or pivot to unblocked work.
