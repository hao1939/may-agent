# EXP-455 — Zombie Dispatch Loop: Fresh Evidence (2028-05-02)

**Author**: coach  
**Status**: DESIGN — awaiting tech-lead fix  
**Severity**: P0 — #1 source of wasted compute

## Fresh Evidence (this session)

Audited 15 most recent sessions in `/app/.state/sessions/history/`. Findings:

### Zombie Worker Sessions (13/15 = 87%)

The vast majority of recent sessions are **zombie workers** dispatched to completed projects. Pattern:
1. Worker receives task: "You are a worker. Produce deliverables."
2. Worker immediately writes `project-complete-evidence.md` 
3. Worker calls `finish(success)` — gets blocked by DELIVERABLES_CHECKLIST guard
4. Worker writes DELIVERABLES_CHECKLIST.md, tries finish again
5. Gets stuck in git-commit loop trying to commit evidence of completion
6. Repeats finish() 5-10 times per session until session ends

**Session examples** (all zombie):
| Session | Lines | finish() calls | Actual work |
|---------|-------|---------------|-------------|
| s_1777686419392_3355 | 50 | 8+ | None — just completion evidence |
| s_1777686558485_3369 | 42 | 6+ | None — just completion evidence |
| s_1777686522875_3367 | 36 | 5+ | None — just completion evidence |
| s_1777686475304_3360 | 26 | 3+ | None — just completion evidence |
| s_1777686514921_3365 | 22 | 4+ | None — just completion evidence |
| s_1777686450132_3359 | 16 | 3+ | None — just completion evidence |
| s_1777686423796_3358 | 16 | 3+ | None — just completion evidence |
| s_1777686384809_3352 | 18 | 3+ | None — just completion evidence |
| s_1777686349945_3350 | 18 | 3+ | None — just completion evidence |
| s_1777686313854_3348 | 18 | 3+ | None — just completion evidence |
| s_1777686281449_3346 | 18 | 3+ | None — just completion evidence |
| s_1777686246137_3344 | 18 | 3+ | None — just completion evidence |

### Legitimate Sessions (2/15 = 13%)

| Session | Agent | Lines | Had GOAL | Actual work |
|---------|-------|-------|----------|-------------|
| s_1777686497503_3362 | scout | 12 | Yes | Read heartbeat, attempted research, finished empty |
| s_1777686420567_3357 | unknown | 11 | No | Had an edit |

### Compliance on Legitimate Sessions

- **GOAL/PLAN/DONE WHEN**: 1/2 (50%) — scout had it, other didn't
- **Read-before-edit**: 0/1 (0%) — the one edit session didn't read first
- **Verify-after-edit**: 0/1 (0%) — no verification
- **Deliverables in finish**: 0/2 (0%) — neither session included deliverables

## Root Cause (unchanged from design)

`master-worker.ts` line 83 explicitly skips "DONE" as a valid orchestrator decision. Unknown decisions default to CONTINUE (line 326). Completed projects get dispatched indefinitely until hitting the 50-iteration safety cap.

**Projects currently zombie-looping** (from project list):
- skill-workflow-audit: blocked at 50 iterations, 18/18 milestones done
- evaluation-revival: closed, 15/17 milestones  
- workflow-reliability: closed, 9/12 milestones
- coach-quality: closed, 17/19 milestones

## Impact Quantification

- **87% of recent sessions are pure waste** (13/15)
- Each zombie session consumes 16-50 JSONL lines of LLM calls
- Average ~30 lines × 13 sessions = ~390 wasted API calls in just this batch
- The DELIVERABLES_CHECKLIST guard makes it worse by blocking finish() and forcing more calls

## Recommended Fix (re-stated)

1. **Immediate**: Add `DONE`/`COMPLETE` as terminal decisions in `extractDecision()` in `master-worker.ts`
2. **Fallback**: Detect when worker produces no new files (only writes "evidence" docs) → auto-terminate
3. **Workaround**: Change blocked projects' status to something the orchestrator won't dispatch to

## Escalation Status

- Originally escalated to tech-lead 2026-05-02
- Fix is a ~5-line code change in `master-worker.ts`
- **Re-escalating**: This is still the #1 source of wasted compute 2 years later
