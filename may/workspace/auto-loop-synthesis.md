# Auto-Loop Decision Brief for Hao

**Prepared by**: May (supervisor)  
**Date**: 2026-04-08  
**Sources**: Tech-lead analysis + Bob design doc  

---

## Executive Summary

Both tech-lead and Bob independently analyzed our workflow system's readiness for multi-cycle autonomous execution. They converge on the same conclusion:

> **Zero engine changes needed. The gap is a ~100-150 line orchestrator workflow + a state file convention.**

Our workflow engine already supports loops, composition, resume-after-crash, steering/interruption, and dynamic agent selection. 229 workflow runs in production prove the primitives work. What's missing is a top-level "auto-loop" workflow that chains heterogeneous tasks with a "done?" gate.

---

## Recommended Approach (Merged)

Combine **tech-lead's Option A** (auto-task workflow) with **Bob's state-file convention** (YAML):

### Architecture

```
1. YAML state file defines the loop:
   agents/<agent>/workspace/auto-loop/<task-id>.yaml
   Contains: task, phase, cycle count, plan, history, context

2. auto-loop.ts workflow reads state → dispatches → updates state:
   while (active && cycle <= maxCycles) {
     derive phase from state file
     dispatch: plan → execute → evaluate → done
     update state file, bump cycle
     check stuck detection (same phase, no progress, 2x = escalate)
   }

3. Two invocation modes:
   a. Workflow-driven: runs all cycles in one session (good for focused tasks)
   b. Heartbeat-driven: one cycle per heartbeat (good for long research tasks)
```

### "Done?" Gate (from tech-lead)

| Gate Type | When to Use |
|---|---|
| Shell verification (`tsc && vitest`) | Code tasks |
| Checklist completion | Explicit multi-step goals |
| File existence check | Documentation/deliverable tasks |
| LLM judgment (1 call) | Ambiguous goals (fallback) |

### Safety Caps

- **maxCycles**: 10 default (configurable per task)
- **maxDuration**: 30 min default
- **Stuck detection**: Same phase repeated 2x with no new output → escalate

---

## What Already Works (from tech-lead audit)

| Capability | Status | Evidence |
|---|---|---|
| Sequential multi-agent steps | ✅ | Every workflow uses `ctx.runAgent()` |
| Workflow composition | ✅ | `ctx.runWorkflow()` exists (barely used — opportunity) |
| Loops in workflows | ✅ | implement-and-verify uses `for (attempt=1..maxAttempts)` |
| State persistence | ✅ | JS vars persist across `runAgent` calls; WorkflowRun JSON auto-saved |
| Resume after crash | ✅ | Built-in replay mechanism |
| Steering/interruption | ✅ | `steer()` → throws `WorkflowInterrupted` |
| Dynamic agent selection | ✅ | `runAgent(name, task)` takes any agent name as string |

**Production stats**: 229 runs, 55% success, 93 escalations (expected — strict quality gates), max 4 steps/run.

---

## Implementation Estimate

| Step | Effort |
|---|---|
| Define YAML state schema | 30 min |
| Write `auto-loop.ts` workflow | 2 hours |
| Heartbeat integration (Mode B) | 1 hour |
| Stuck detection + escalation | 30 min |
| Test with one real research task | 1 session |
| **Total** | **~4 hours agent time, 0 infra changes** |

---

## Decision Requested

1. **Green light to implement?** Both analyses say it's straightforward.
2. **Which mode first?** Recommend workflow-driven (Mode A) for immediate value, add heartbeat-driven later.
3. **First test case?** A multi-experiment research hypothesis (like the pattern we've been doing manually with coach).

---

## Source Documents

- Tech-lead: `agents/tech-lead/workspace/analysis-workflow-autoloop.md` (11.6KB)
- Bob: `agents/bob/workspace/DESIGN-auto-loop.md` (11.5KB)
