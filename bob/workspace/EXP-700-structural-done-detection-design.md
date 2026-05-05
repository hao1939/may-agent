# EXP-700: Structural DONE Detection in Master-Worker

**Date**: 2025-07-27
**Author**: bob
**Status**: DESIGNED
**Hypothesis**: H-700 — The master-worker overrun problem (49 post-DONE iterations in EXP-650) is caused by extractDecision() parsing bugs, not lack of text coaching.

## Problem

EXP-650 proved that text-based "stop at DONE" coaching has 0% compliance. The orchestrator kept running 49 iterations after the project was marked DONE. Root cause analysis reveals two structural bugs:

### Bug 1: CONTINUE wins over DONE in `extractDecision()`

The function checks keywords in this priority order:
1. Line 63-66: First-line keyword match (CONTINUE, PIVOT, WAITING, BLOCKED)
2. Line 72-74: First-line DONE/COMPLETE match
3. Line 80: "proceed"/"move forward" → always maps to CONTINUE
4. Line 89-92: **Fallback scan for CONTINUE** (before DONE check on line 97)

If the orchestrator output contains BOTH "CONTINUE" and "DONE" anywhere in the text (common: "all milestones are DONE, CONTINUE with verification"), CONTINUE wins because it's checked first in the fallback scan.

### Bug 2: `unknown` defaults to CONTINUE (line 340-343)

When the orchestrator doesn't use any keyword, the decision defaults to CONTINUE. This means the orchestrator has to **actively and clearly say DONE** — but the text patterns for DONE detection (line 97) require BOTH an uppercase keyword AND a qualifier word like "project" or "all metrics". Missing either = CONTINUE.

### Bug 3: No project-state check

Even if the project.md has been updated to `status: closed`, extractDecision() doesn't check it. The orchestrator could mark the project done in its own output but still say "let's proceed to wrap up" and get parsed as CONTINUE.

## Proposed Structural Fixes

### Fix 1: Priority reorder in extractDecision() (LOW RISK)

Move DONE/COMPLETE detection **before** CONTINUE in the fallback scan:

```typescript
// In the fallback section (after first-line checks):
// Check DONE first - a project that's done should stop
if (/\b(DONE|COMPLETE|COMPLETED)\b/.test(trimmed) && 
    /\b(project|all\s+metrics|all\s+milestones|finished|stop)\b/i.test(trimmed)) {
  return { status: "done", detail: trimmed.slice(0, 500) };
}

// Then check for CONTINUE keywords
for (const keyword of ["CONTINUE", "PIVOT", "BLOCKED", "WAITING"] as const) {
  // ...
}
```

### Fix 2: Project-state aware termination (MEDIUM RISK)

After extractDecision(), check if project.md status is already "closed":

```typescript
// After line 336: let decision = extractDecision(orchestrator.lastText());
// Add project-state override:
const projectStatus = readProjectStatus(projectFile);
if (projectStatus === "closed" && decision.status === "continue") {
  ctx.log("[plan] Project already closed but orchestrator said CONTINUE — forcing DONE");
  decision.status = "done";
}
```

### Fix 3: Iteration cap relative to plan size (LOW RISK)

Add a hard cap at `2 * planItems.length` or `maxIterations` (whichever is smaller):

```typescript
const hardCap = Math.min(maxIterations, planItems.length * 2 + 5);
if (iteration >= hardCap) {
  ctx.log(`[work] Hard cap reached (${hardCap}). Forcing DONE.`);
  break;
}
```

## Recommended Implementation Order

1. **Fix 1** (priority reorder) — safest, addresses the parsing bug directly
2. **Fix 3** (iteration cap) — safety net, catches all overrun scenarios
3. **Fix 2** (project-state check) — most thorough but needs `readProjectStatus()` helper

## Expected Impact

Based on EXP-650 measurement:
- 49/84 steps were post-DONE busywork (58%)
- At ~$0.50-1.00/step, saves $25-50 per affected run
- If 30% of master-worker runs overrun, this is a significant cost reduction

## Validation Plan

1. Add unit tests for extractDecision() with adversarial inputs containing both DONE and CONTINUE
2. Run a master-worker project and verify it stops within 2 iterations of marking project closed
3. Compare iteration counts before/after across 5+ runs

## Connection to Prior Work

| Experiment | Finding | This experiment |
|-----------|---------|----------------|
| EXP-650 | Text gate: 0% compliance | We fix structurally instead |
| EXP-300 | Text coaching: 3.2% | Confirms text approach fails |
| EXP-500 | Structural read-before-edit: 97% | Proves structural approach works |
| KE-EXP027 | Structural > text for compliance | Direct application |

## Decision

Implement Fix 1 (reorder) + Fix 3 (cap) this session or next. Fix 2 deferred until we can add readProjectStatus().
