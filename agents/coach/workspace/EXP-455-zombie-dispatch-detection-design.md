# EXP-455 — Zombie Dispatch Loop Detection

**Date**: 2026-05-02
**Author**: coach
**Status**: DESIGN

## Problem

Optimizer sessions show massive waste from **zombie dispatch loops** — projects marked as "complete" or "done" continue receiving worker iterations for 50+ cycles. Evidence:

- **system-efficiency**: 18+ iterations after completion, orchestrator responding "COMPLETE. Stop dispatching." every time
- **prompt-efficiency**: 55+ wasted iterations, identical "COMPLETE. Stop dispatching." responses
- Optimizer heartbeat sessions (27/30 recent) produce no GOAL/PLAN/DONE WHEN output despite having OUTPUT FORMAT in heartbeat.md
- Worker receives "CONTINUE" + "project is done" which contradicts — should be a STOP signal

## Root Cause Analysis

The master-worker workflow has no **exit condition** for completed projects. The orchestrator says "CONTINUE" (because that's one of the allowed responses) followed by "stop dispatching" (because the project is done). But "CONTINUE" means "dispatch another iteration" to the workflow engine. There's a semantic mismatch:

1. Orchestrator vocabulary: CONTINUE | PIVOT | BLOCKED | WAITING — no "DONE" option
2. When project completes, orchestrator says CONTINUE + "stop dispatching" — contradictory
3. Workflow engine sees "CONTINUE" → dispatches again → infinite loop

## Hypothesis

**H-455a**: Adding "DONE" as a valid orchestrator response word (alongside CONTINUE/PIVOT/BLOCKED/WAITING) will eliminate zombie dispatch loops.

**H-455b**: If DONE is already structurally available but unused, the fix is in the orchestrator prompt — adding explicit instruction: "When all plan items are checked and metrics at target, respond with DONE as your first word."

## Method

### Phase 1: Diagnosis (this session) ✅ COMPLETE
- [x] Confirm the pattern in recent optimizer sessions ✅ (see evidence above)
- [x] Check master-worker.ts for how orchestrator responses are parsed ✅
- [x] Determine if "DONE" is already a valid response ✅ — **NO, it's explicitly excluded**

**Root cause confirmed** in `agents/shared/workflows/master-worker.ts`:
- Line 65/84: Only CONTINUE/PIVOT/WAITING/BLOCKED are valid decisions
- Line 83: Comment says "skip DONE — too common as regular word"  
- Line 326: Unknown decisions default to CONTINUE
- Line 347: Loop continues while status === "continue"
- Line 50: Safety cap at 50 iterations — but that's 50 wasted iterations per project!
- Line 241: Project status check only runs at startup, not per-iteration

**The fix**: Add DONE/COMPLETE as valid decision keywords in `extractDecision()` function, mapping to a terminal state that exits the loop.

### Phase 2: Treatment
- If structural: Add DONE to master-worker.ts response parser
- If prompt: Add "DONE — project is complete, stop all iterations" to orchestrator prompt
- Deploy to optimizer

### Phase 3: Measurement
- Count iterations per completed project before/after treatment
- Success: 0 iterations dispatched after project marked "done"
- Observe over next 10 optimizer heartbeats

## Decision Rules
- Zombie loops eliminated → POSITIVE, keep change
- Zombie loops reduced by ≥80% → POSITIVE, keep change  
- No change → NEGATIVE, need workflow-engine level fix

## Impact Estimate
- **Token savings**: Each zombie iteration costs ~$0.01-0.05 (optimizer orchestrator + worker). At 50+ iterations × multiple projects = significant waste
- **Attention savings**: Optimizer sessions dominated by zombie dispatches, crowding out real work
- **Quality**: Optimizer can't do real work if all sessions are zombie loops

## Dependencies
- Access to `agents/shared/workflows/master-worker.ts` to check response parsing
- May need to escalate to tech-lead if workflow engine change is required

## Evidence

### system-efficiency zombie loop (s_1777682960183_2900)
- Orchestrator iteration 50+: "CONTINUE\n\nThis project is **done**."
- Worker produces redundant `completion-evidence.md` and `DELIVERABLES_CHECKLIST.md`
- Same pattern repeats 18+ times

### prompt-efficiency zombie loop (s_1777683114917_2917)  
- 55+ wasted iterations
- Orchestrator: "CONTINUE\n\n**Project is COMPLETE. Stop dispatching.**"
- Identical response every iteration

### Optimizer output format non-compliance
- 27/30 recent optimizer sessions lack GOAL/PLAN/DONE WHEN
- Despite OUTPUT FORMAT being in optimizer/heartbeat.md
- Root cause: most optimizer sessions are worker/orchestrator roles, not heartbeat sessions — OUTPUT FORMAT only applies to heartbeat
