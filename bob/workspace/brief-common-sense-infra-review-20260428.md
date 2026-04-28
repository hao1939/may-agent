# Common Sense Infra Review — 2026-04-28

## Task
Cron: Review common-sense.md for infra-owned items. Identify highest-priority unbuilt mechanism. Check Coach flags.

## Changes Since Last Review (2026-04-09)
- **common-sense.md**: Unchanged (same content, SIG matches)
- No ownership changes needed — all items correctly categorized

## Infra-Owned Items Status

| Item | Status | Mechanism |
|------|--------|-----------|
| C1.7 Success Requires Evidence | ✅ BUILT | finish-guard.ts Gate 2 (FM-3.3) |
| C1.8 Match finish() to reality | ✅ BUILT | finish-guard.ts Gate 0 (ghost deliverables) |
| git add agents/ = NO | ✅ BUILT | .gitignore blocks; 99.04% compliance |
| C1.3 Verify every write | ❌ UNBUILT | Coach status: 6 consecutive ❌ checks. 0% behavioral fix rate across all experiments |
| Finish-guard wiring | ❌ UNWIRED 75+ DAYS | Code exists in src/, NOT imported by manager.ts |

## Highest Priority Unbuilt: Finish-Guard Wiring (P0)

**This is higher priority than C2.3 auto-readback because the code already exists.**

The finish-guard (`finish-guard.ts`) has been written for 75+ days but is not wired into `src/lib/manager.ts`. This blocks ALL structural convention enforcement. Coach has been blocked for 47+ consecutive heartbeats waiting on this.

**Why P0**: Every downstream structural enforcement (C1.3 verify-writes, C1.7 evidence check, C1.5 ghost deliverables) depends on the finish-guard actually running in production. Without wiring, these guards only fire in test/eval contexts.

**Action**: Escalate to tech-lead or May. Single task: import finish-guard in manager.ts and wire it into the finish() call path.

## Second Priority: C2.3 Auto-Readback (P1)

Status unchanged from Apr 9 review. V4 brief ready at `agents/bob/workspace/brief-infra-c23-auto-readback-v4.md`. Not started.

Coach data proves text-based coaching has 0% fix rate for verify-after-edit (EXP-020, 055, 055b, 056, 093 — all failed). The only path is tool-layer enforcement.

**Blocked on**: Finish-guard wiring (P0 above). C2.3 enforcement needs the finish-guard pipeline to be live.

## Coach-Flagged Items Needing Infra

Coach's reflections (Apr 24-28) repeatedly flag:

| Item | Coach Priority | Days Blocked | Coach Assessment |
|------|---------------|-------------|-----------------|
| Finish-guard wiring | P0 | 75+ | "Code exists, not wired — blocks structural enforcement" |
| IT-86/IT-90 structural enforcement design | P1 | NOT STARTED | "Text coaching = 0% effective. Needs tool-level enforcement." |
| Evaluation pipeline | P0 | 63+ | "Everything downstream depends on it" |
| Sub-session commit guard gap | P2 | — | Phase 2 sub-sessions bypass commit guard |

**Coach escalation failure**: Coach has logged "still blocked" for 47+ heartbeats without escalating to May. Coach's Apr 28 reflection self-identifies this: "Coach should escalate to May with a concrete request, not just log 'still blocked' indefinitely."

## Ownership Updates
No changes to common-sense.md needed. Document content unchanged since last review.

## Summary
1. **P0 unbuilt**: Finish-guard wiring (code exists 75+ days, not in manager.ts)
2. **P1 unbuilt**: C2.3 auto-readback (v4 brief ready, depends on P0)
3. **Coach flags**: Structural enforcement blocked on tech-lead for 47+ heartbeats with no escalation
4. **No common-sense.md ownership changes needed**
