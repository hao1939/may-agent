# Finding: Coach 136-op EXP-156 Session (Apr 17)

**Session**: `s_1776399785799_320`
**Agent**: coach
**Status**: running (38+ min, 136 ops so far)
**Workflow**: None (direct fork, no workflowRunId)
**Children**: None (no sub-sessions)

## Task

EXP-156: Hard Gate Generalization — Create treatment scenarios and run trials. Multi-phase experiment: create treatment scenarios, run baselines (10 trials × 2 scenarios), run treatments (10 trials × 2 scenarios), analyze results.

## Analysis

**Is 136 ops excessive?** Not necessarily for this task. The session is running 40+ gym trials (10 trials × 2 scenarios × 2 arms = 40 runs). Each gym run costs ~3 ops minimum (setup + run + record). 40 × 3 = 120 ops baseline, plus scenario creation, smoke tests, and analysis overhead → 136 ops is reasonable for this workload.

**Comparison to other coach sessions:**
- EXP-070 (252 ops): scenario redesign + baseline runs — similar multi-phase pattern
- EXP-117 (188 ops): analysis + design (no gym runs) — this was genuinely bloated
- EXP-124 (136 ops): same op count, similar gym trial workload
- EXP-154 (133 ops): similar, was interrupted

**Root cause of high ops**: The task itself is large — 4 phases with 40+ gym trials. This is structural (big task) not waste (bloated process).

## Verdict

**Not actionable.** The 136-op count is proportional to the workload (40+ gym trials + scenario creation + analysis). No workflow overhead issue — the session doesn't even use a workflow. The coach's EXP sessions routinely hit 130-190 ops when running batch gym trials. This is expected behavior for experiment execution sessions.

## Recommendation

None. If we wanted to reduce coach session ops, the lever would be smaller experiment batches (e.g., 5 trials instead of 10), but that trades statistical power for efficiency — not a clear win.
