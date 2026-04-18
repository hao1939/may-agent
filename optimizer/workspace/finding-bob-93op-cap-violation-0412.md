# Finding: Bob 93-op D-o-R Phase 1 Cap Violation Investigation

**Date**: 2026-04-12  
**Severity**: Medium — cap is 89% effective but 3 violations show structural gap  
**Sessions investigated**: s_1775960654420_1787 (93 ops), s_1775921064376_1491 (40 ops), s_1775949846044_1693 (37 ops)

## Summary

The D-o-R Phase 1 "BUDGET: 15 TOOL CALLS MAX" cap is a **prompt-only instruction** with no hard enforcement. Out of 27 Phase 1 sessions since deployment, 3 (11.1%) violated the cap — at 40, 37, and 93 ops. The compliant sessions average 4.3 ops. The cap is broadly effective but has a structural gap: **tasks that require writing many files in-place** (batch INDEX updates, scorecard reconciliation) cause the LLM to ignore the budget and do the work inline.

## What Happened

### The 93-op Session (s_1775960654420_1787)
- **Task**: KB INDEX batch integration — add ~20+ missing entries to INDEX.md
- **Started**: 2026-04-12T02:24:14Z
- **Parent**: Bob heartbeat (s_1775960622551_1778, 8 ops)
- **Workflow**: D-o-R (wr_1775960654420_6zwj)
- **Workflow structure**: Phase 1 (93 ops) → Phase 3 verification (12 ops). **No Phase 2** — early exit triggered because Phase 1 wrote all deliverables.
- **Root cause**: Task involved adding 20+ entries to INDEX.md. The LLM treated this as "the work" rather than "planning" and wrote all entries inline during Phase 1, burning 93 ops on a phase budgeted for 15.

### The 40-op Session (s_1775921064376_1491)
- **Task**: Bayesian Scorecard Update — reconcile all hypothesis P(H) values
- **Similar pattern**: Heavy data-read task requiring reading many hypothesis files. Phase 1 did all the work. No Phase 2.

### The 37-op Session (s_1775949846044_1693)
- **Task**: EXP-143 results integration into knowledge base
- **Similar pattern**: KB integration with multiple file reads/writes. Phase 1 did all the work. No Phase 2.

## The 113-op Session (s_1775957533648_1759) — NOT a D-o-R violation

The 113-op "Research Synthesis" session is **not a D-o-R Phase 1**. It's the synthesis step of the `parallel-research` workflow (agents/shared/workflows/parallel-research.ts). This workflow has no budget caps at all. The synthesis task received thread results including one failure, and the agent spent 113 ops on cross-referencing and writing files.

This is a separate concern — parallel-research has no op budgets.

## Statistics

| Metric | Value |
|--------|-------|
| Total Phase 1 sessions | 27 |
| Compliant (≤15 ops) | 24 (88.9%) |
| Violations (>15 ops) | 3 (11.1%) |
| Compliant avg ops | 4.3 |
| Violation ops | 40, 37, 93 |
| Overall avg ops | 10.1 |

## Root Cause Analysis

1. **No hard enforcement**: `ctx.runAgent()` has no `maxOps` parameter. The budget is purely a prompt instruction. The LLM can (and does) ignore it when the task feels like "just do it" rather than "plan it."

2. **Early-exit path creates perverse incentive**: The D-o-R workflow has an early-exit check — if Phase 1 writes all deliverables, Phase 2 is skipped entirely. This means the LLM "learns" (within context) that writing in Phase 1 is fine because it sees "DO NOT write" but there's no actual enforcement, and in practice when it does write, the workflow proceeds successfully. The early-exit path was designed for KE-002 (50% of sessions write in Phase 1), but it inadvertently **rewards** Phase 1 budget violations.

3. **Data-heavy tasks are the trigger**: All 3 violations involve batch data integration (many file reads + writes). These tasks feel "mechanical" to the LLM — it wants to just do the work rather than make a plan for a separate session to do it. Simple tasks (2-8 ops) respect the budget easily.

## Recommended Fixes

### Fix 1: Hard op limit on `ctx.runAgent()` (STRUCTURAL)
Add an optional `maxOps` parameter to `ctx.runAgent()`:
```typescript
runAgent(name: string, task: string, opts?: { maxOps?: number }): Promise<TaskResult>;
```
When the agent hits `maxOps`, the session is forcibly terminated with whatever state it has. This would require changes to `src/lib/workflow.ts` and the session manager.

**Pro**: Truly prevents violations. **Con**: Abrupt termination mid-work could leave partial writes.

### Fix 2: Softer enforcement — inject warning at N ops
At op 12 (3 before budget), inject a system message: "⚠️ You have used 12/15 tool calls. Call finish() NOW with your plan."

**Pro**: Gives the LLM a chance to wrap up gracefully. **Con**: Still not hard enforcement — LLM can ignore it.

### Fix 3: Remove early-exit path for high-op Phase 1s
If Phase 1 exceeds 15 ops but wrote files, still run Phase 2 (narrowed to missing files) rather than early-exiting. This removes the "reward" for Phase 1 doing the work.

**Pro**: Simple change to workflow code. **Con**: Doesn't prevent the bloat, just changes the downstream path.

### Recommended approach
**Fix 1** (hard limit) is the right structural fix but requires infra changes. **Fix 2** (warning injection) is a good interim measure. Both should be pursued.

## Impact

- 3 violations × avg 53 excess ops = ~159 wasted ops in 27 Phase 1 sessions
- At current Phase 1 rate (~12/day), violations cost ~70 ops/day (~$3/day)
- The cap remains highly effective for the other 89% of sessions (saved from pre-cap 29.7 avg to 4.3 avg)
- The violations are concentrated in batch-integration tasks — these could be excluded from D-o-R entirely (they're mechanical, not research)

## Related Findings
- `finding-dor-p1-cap-final-verdict-0411.md` — original cap measurement (n=7, all compliant)
- `finding-dor-p1-bloat-0411.md` — Phase 1 bloat root cause analysis
- `finding-bob-90op-archaeology-0411.md` — nested workflow spawning (separate issue, fixed)
