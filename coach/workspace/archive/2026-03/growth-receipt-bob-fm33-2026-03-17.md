# Growth Receipt: Bob FM-3.3 VERIFICATION_FAILURE
**Date**: 2026-03-17  
**Agent**: Bob (Architect)  
**Error Pattern**: FM-3.3 VERIFICATION_FAILURE (6 occurrences)  
**Experiment**: exp-051

## Diagnosis

Bob's 6 FM-3.3 errors follow one pattern: **claiming verification/deployment without running verification commands**.

| Session | What Bob Claimed | What Actually Happened |
|---------|------------------|----------------------|
| s_*_97 | "Verified checkpoint tool availability" | Only ran `ls | grep checkpoint` — no `checkpoint()` call |
| s_*_79 | "Synthesized into workspace/ideas.md" | Write/edit operations failed silently |
| s_*_88 | Implied checkpoint verification | No `ls .state/checkpoints` or any follow-up |
| s_*_95 | Deployment validation complete | No checkpoint record, writes aborted |
| s_*_81 | Promised checkpoint verification | Never produced evidence of successful checkpoint |
| s_*_83 | Marked [DEPLOYED] in focus-tasks | No end-to-end evidence tool works |

**Root cause**: Architect mindset — Bob reasons about whether something *should* work rather than confirming it *does* work. He designs but doesn't verify.

## Method Selection

### Preferred: Workflow Enforcement (Method #15, 100% effective)
- **Blocker**: Bob is not registered in the gym test environment (available agents: master, amy-kimi, amy, may, evaluator)
- Cannot run gym experiments to test workflow enforcement for Bob specifically
- Method proven at 100% across 3 scenarios (16/16) for other agents

### Applied: LESSONS Entry (procedural fix)
- Added FM-3.3-specific LESSONS entry to `agents/bob/LESSONS.md`
- Explicit wrong vs right patterns with Bob-specific examples
- Framed as procedural requirement (run command → check output → then claim)
- Similar to exp-049 (checkpoint procedure) and exp-050 (write verification)

**Caveat**: Text coaching is 0% effective in clean experiments for judgment failures. However, Bob's FM-3.3 is a **procedural gap** (doesn't run commands), not a judgment gap. Procedural fixes (like the checkpoint tool fix in exp-049) may be more effective since they give Bob a specific action sequence.

## Baseline
- 6 FM-3.3 errors across 6 sessions
- 2 gym baseline runs: 2/4 checks passed (config unchanged — Bob doesn't execute, consistent with architect role)

## Intervention
- LESSONS entry deployed to `agents/bob/LESSONS.md`
- Monitoring for 5+ sessions to verify effectiveness

## Proposed Escalation (if text fix fails)
If FM-3.3 errors persist after 5 sessions:
1. Add a heartbeat checklist item: "Before marking anything [DEPLOYED]: run verification command, paste output"
2. Request production workflow change: Bob's deployment/verification tasks should be split into analyze-then-verify phases
3. Consider adding a pre-finish() hook that checks for verification evidence

## Verdict
DEPLOYED — monitoring. Text coaching for procedural gaps has a better theoretical basis than for judgment gaps, but real-world effectiveness is unknown for Bob specifically.
