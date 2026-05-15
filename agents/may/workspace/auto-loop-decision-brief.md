# Decision Brief: Auto-Loop for Multi-Cycle Autonomous Execution

**For**: Hao  
**From**: May  
**Date**: 2026-04-08  
**Status**: Ready for decision

---

## The Question

How do we give agents multi-cycle autonomous execution (like GSD-2's auto mode)?

## Background

Both tech-lead and Bob independently analyzed this. Their findings **converge completely**: zero engine changes needed. The workflow system already supports loops, composition, resume, and steering. What's missing is a thin orchestrator layer.

## The Two Analyses

| | Tech-lead | Bob |
|---|---|---|
| **Key insight** | Engine already has all primitives; gap is ~100 lines of workflow code | Heartbeat IS already a loop; gap is structured state + dispatch |
| **Approach** | New `auto-task` workflow using `runAgent`/`runWorkflow` in a `while` loop | YAML state file per task + dispatch table mapping phase→action |
| **Engine changes** | Zero | Zero |
| **Effort** | ~120 lines, immediate | ~4h agent time across 5 steps |
| **"Done?" gate** | Shell verify for code, checklist for docs, LLM judgment as fallback | Evaluate phase per cycle — agent assesses and decides continue/revise/done |
| **Stuck detection** | maxSteps cap (10-20) + time cap + manual steering | Same-phase-no-progress heuristic (2+ repeats → stuck → escalate) |

## Recommended Approach: Hybrid (Best of Both)

**Use Bob's YAML state-file convention + Tech-lead's workflow implementation.**

Specifically:
1. **State file**: `agents/<agent>/workspace/auto-loop/<task-id>.yaml` — readable by agents AND humans, survives crashes, editable for manual intervention
2. **Workflow**: New `auto-loop.ts` (~150 lines) that reads state file, dispatches by phase, updates state, checks stuck detection
3. **Two modes**:
   - **Mode A (heartbeat-driven)**: One cycle per heartbeat — good for long-running research (days)
   - **Mode B (workflow-driven)**: All cycles in one session — good for focused multi-step tasks (hours)
4. **"Done?" gate**: Phase-based evaluation — plan→execute→evaluate→done, with shell verification for code tasks
5. **Safety**: maxCycles cap (default 5-10), stuck detection (escalate after 2 no-progress cycles), steering for emergency brake

### What This Enables
- Coach can run a 5-experiment research sprint autonomously
- Bob can do multi-file design work without per-step dispatch from May
- Tech-lead can chain implement→test→fix→test loops without escalation

### What It Costs
- ~4 hours of agent time to build
- 0 engine changes
- 0 new infrastructure

## Decision Needed

1. **Approve the hybrid approach?** (YAML state + workflow, two modes)
2. **Who builds it?** Recommend: Tech-lead implements, Bob reviews the state file schema
3. **First test case?** Recommend: Coach runs a 3-experiment hypothesis validation using Mode B

## References
- Tech-lead analysis: `agents/tech-lead/workspace/analysis-workflow-autoloop.md`
- Bob design doc: `agents/bob/workspace/DESIGN-auto-loop.md`
