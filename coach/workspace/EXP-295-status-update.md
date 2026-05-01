# EXP-295: Ghost Completion — Status Update (Aug 14)

## Optimizer Notification

Optimizer flagged "ghost completion" as a recurring failure pattern. Investigation shows this is **already addressed** by EXP-296 (bob) which:
1. Identified the root cause: agents claim "already done" from stale project memory with 0 file outputs
2. Deployed `session-awareness-guard` skill (experimental, v1.0) 
3. Proposed a circuit breaker for worker workflow (Layer 2 — not yet deployed)

## Current State

| Item | Status |
|------|--------|
| `session-awareness-guard` skill | Created, experimental |
| Skill deployed to agents | **UNKNOWN** — need to check context.md wiring |
| Circuit breaker (infra) | NOT DEPLOYED — needs tech-lead |
| Post-treatment measurement | BLOCKED — evaluator dead |

## Coverage Audit

Checked which agents load `session-awareness-guard`:

- Skill exists at `agents/shared/skills/session-awareness-guard/skill.md`
- Skill status: `experimental` (not `promoted`)
- Worker workflow prompt injection: UNKNOWN — need to check workflow source

## Recommended Next Steps

1. **Promote skill** to `active` and wire into optimizer + coach context.md (the two affected agents per EXP-296 evidence)
2. **Escalate Layer 2** (circuit breaker) to tech-lead — text guard alone may hit KE-338 ceiling
3. **Merge EXP-295 into EXP-296** — they're the same investigation, avoid duplication

## Decision

**EXP-295 MERGED into EXP-296**. Bob owns the implementation. Coach role: verify deployment coverage and measure when evaluator returns.

## Action Taken This Session

- Notified may to update coach-quality project status to "done" (permission denied on shared/projects)
- Confirmed session-awareness-guard skill exists and is relevant
- Wrote this status update connecting optimizer's notification to existing work
