# Lens B: Coach Experiment Session Flow Complexity

**Date**: 2026-04-19  
**Target**: EXP-185 (31 ops), EXP-186 (64 ops) — are these inflated by persistent-task workflow overhead?

## Finding: No Workflow Overhead — Ops Are Direct Coach Work

**Severity**: Low (informational — the premise was incorrect)

### Evidence

1. **No persistent-task workflow exists in the codebase.** `src/app/workflows/` directory doesn't exist. The only references to "persistent-task" are:
   - A comment in `workflow-tool.ts:84` about context overflow prevention
   - Auto-detection injection in `project-scanner.ts:75-82` and `cron.ts:853-858`
   - Gym scenarios and lab experiments under `agents/.lab/`

2. **EXP-185 and EXP-186 sessions have no workflow wrapper.** Both sessions have `workflowRunId: null` (DB query on sessions table), confirming they run as plain agent sessions, not workflow-orchestrated.

3. **No child sessions spawned.** Query for `parentSessionId IN (s_1776563469482_804, s_1776558283950_741)` returned zero rows. All 31 and 64 ops accumulate in the coach session itself — no owner↔worker iteration loop.

4. **The op counts are from direct experiment work.** EXP-185 (`s_1776558283950_741`, 31 ops, status: done) and EXP-186 (`s_1776563469482_804`, 64 ops, status: interrupted) are coach sessions doing gym scenario design, execution, and analysis — read/write/bash cycles for building scenarios, running trials, and analyzing results.

### Conclusion

The persistent-task workflow is not a runtime workflow definition — it's a *concept* that coach experiments with (teaching agents to use project files for multi-session continuity). The high op counts in EXP-185/186 come from genuine experiment work (building gym scenarios, running `scripts/gym-run.sh`, analyzing results), not from workflow iteration overhead.

**No action needed.** The 31-64 op range is expected for experiment sessions that involve scenario creation + multiple gym trial runs + result analysis.

### Related Pattern

Other high-op coach sessions follow the same pattern: `s_1776551125350_659` (154 ops), `s_1776545680528_605` (48 ops), `s_1776540115465_532` (65 ops) — all experiment work sessions with no workflow wrapper (`workflowRunId: null`).
