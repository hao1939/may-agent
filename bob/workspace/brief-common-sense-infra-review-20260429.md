# Common Sense Infra Review — 2026-04-29

## Summary

The three structural guards from prior briefs (read-before-edit, verify-after-write, hallucinated-path) are now **BUILT AND DEPLOYED** — auto-loaded via `agents/shared/guards/loader.ts`. The highest-priority unbuilt infra mechanism is now the **evaluator pipeline** (dead since Apr 16, re-escalated Jul 10). Coach is structurally blind without it.

## Ownership Updates

| Item | Previous Status | New Status |
|------|----------------|------------|
| read-before-edit guard (C1.1) | P0 UNBUILT | ✅ DEPLOYED (`agents/shared/guards/read-before-edit.ts`) |
| verify-after-write guard (C1.3) | P0 UNBUILT | ✅ DEPLOYED (`agents/shared/guards/verify-after-write.ts`) |
| PATH_HALLUCINATION bash wrapper | P1 UNBUILT | ✅ DEPLOYED (`agents/shared/guards/hallucinated-path.ts`) |

All three are auto-discovered by `loader.ts` (scans all `.ts` in the guards dir). No manual wiring needed.

## Highest Priority Unbuilt: Evaluator Pipeline (P0)

**Coach's #1 blocker** — re-escalated to May on Jul 10:
- 0 evaluations produced since Apr 16 (100+ days blind)
- Evaluator sessions exist but only run "digest" tasks, not actual evals
- ALL coaching metrics, convention compliance tracking, and skill effectiveness measurement are dead
- This is NOT a coach problem — it's infrastructure

**Why this matters for common-sense.md:**
- "Metric-oriented" principle requires working metrics
- Coach cannot verify if deployed guards (above) are actually improving compliance
- The system is flying blind on behavioral quality

**What's needed:** Investigation of why evaluator sessions only produce digests. Likely a task-routing or scheduling issue in the evaluator agent's heartbeat/dispatch logic.

## Coach's Current Infra-Blocked Items

1. **P0: Evaluator pipeline dead** — cannot measure anything (infra/may ownership)
2. **P0: Verification failures** — guard is deployed but coach can't measure impact without evaluator
3. ~~P0: Structural guards~~ — ✅ RESOLVED (all three deployed)

## Recommendation

1. **P0:** Investigate evaluator pipeline — why only "digest" tasks? Fix task routing so evals run again.
2. **P1:** Measure guard effectiveness — once evaluator works, check if C1.1/C1.3 violation rates dropped.
3. **Housekeeping:** Coach's todo still lists verify-after-write as "blocked on tech-lead" — it's been shipped. Coach should be notified.
