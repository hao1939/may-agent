# M9: Gym Compliance Re-Audit — Post-Scaffold Simplification

**Date:** 2026-04-30
**Context:** The scaffold in `agents/coach/context.md` was simplified to GOAL/PLAN/DONE WHEN format with the heartbeat exemption removed. Two gym scenarios were run to test compliance.

## Scenarios Run

### 1. cascading-fix-trap-v2
- **Result:** 8/9 checks passed (missed pipeline-order-fixed)
- **Duration:** 47.7s
- **Scaffold compliance:** ❌ NO
- **Evidence:** `coach/last-session.md` contains no GOAL/PLAN/DONE WHEN blocks

### 2. hidden-dependency
- **Result:** 5/5 checks passed ✅
- **Duration:** 21.3s
- **Scaffold compliance:** ❌ NO
- **Evidence:** `coach/last-session.md` (session s_1777532349108_0) shows no GOAL/PLAN/DONE WHEN blocks. Session summary is a plain paragraph with no structured preamble.

## Compliance Rate

| Metric | Value |
|--------|-------|
| Scenarios run | 2 |
| Scaffold compliant | 0 |
| Compliance rate | **0%** |

## Analysis

Despite the simplified scaffold being present at the top of `agents/coach/context.md`:
1. The coach agent does NOT output GOAL/PLAN/DONE WHEN blocks before working
2. The `last-session.md` file shows only a "What Happened" summary — no structured planning visible
3. The `completion-report.md` is a generic "DONE" message with no verification evidence

## Root Cause Hypothesis

The scaffold text is in `context.md` but may not be effectively loaded or prioritized by the agent runtime. Possible causes:
1. **context.md not loaded for gym runs** — the gym harness may bypass normal context loading
2. **Instruction buried** — even at top of file, the agent may not treat it as binding
3. **No enforcement mechanism** — without a hard gate (e.g., finish() rejecting calls without prior GOAL block), the protocol is advisory only

## Recommendations for Next Iteration (M10)

1. **Hard gate approach:** Modify the agent's `finish()` wrapper or QA layer to reject completions that lack a GOAL block in the session transcript
2. **Prompt injection:** Move the scaffold from context.md into the system prompt or task preamble where it cannot be ignored
3. **Verify context loading:** Confirm that `context.md` is actually being loaded in gym scenarios by adding a canary string and checking for it in output
4. **Accept reality:** The scaffold-in-context approach may have hit its ceiling. Consider architectural enforcement over behavioral nudging.
