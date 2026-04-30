# Design: Structural Auditor Workflow Integration

**Author**: Bob | **Date**: 2027-11-01
**Status**: PROPOSAL
**Source**: EXP-242 (p=0.015), KE-413, EXP-245 (generalization null)

## Problem

EXP-242 proved that a two-phase auditor pattern fixes 44% of ordering bugs that are **0% fixable** by any single-agent intervention (6+ attempts, 200+ trials). But it's been sitting as a knowledge entry for months — no production impact.

## What We Proved

| Approach | Ordering Bug Fix Rate | Cost |
|----------|----------------------|------|
| Any single-agent intervention | 0% | 1 session |
| Sequential auditor (EXP-242) | 44% | 2 sessions |
| Direct human hint | 40% | 1 session + human |

The auditor achieves human-hint-equivalent performance autonomously.

## What We Know Doesn't Work

- **Inline auditor instructions** (EXP-245): 0% on judgment tasks. Task framing within a single session doesn't create the cognitive separation needed.
- **Text instructions/skills/tools**: 0% across all attempts (KE-413 exhaustive table).

## Proposed Design: `auditor-preflight` Workflow Step

### Architecture

Add an optional `auditor-preflight` step to `master-worker` and `implement-and-verify` workflows:

```
[Detect trigger] → [Run auditor agent] → [Inject AUDIT-REPORT.md] → [Run primary agent]
```

### Trigger Conditions

Run auditor preflight when:
1. **Repeated failure**: Primary agent has failed the same task ≥2 times (session-recovery already tracks this)
2. **Structural scenario tag**: Task involves multi-file changes with ordering dependencies
3. **Manual flag**: `**Auditor**: enabled` in project.md

Don't run when:
- First attempt (let primary agent try unassisted — 44% benefit doesn't justify 2x cost on every task)
- Judgment/creative tasks (EXP-245 null result)
- Simple single-file tasks

### Auditor Agent Configuration

```typescript
// In workflow, before primary agent dispatch:
const auditResult = await dispatch({
  agent: "coder",  // or dedicated "auditor" role
  task: `You are a STRUCTURAL AUDITOR. Do NOT fix anything.
    Read all files related to: ${taskDescription}
    Produce AUDIT-REPORT.md containing:
    1. File dependency graph (what imports/calls what)
    2. Execution ordering analysis
    3. Data flow: where values are created vs consumed
    4. Any ordering violations or missing dependencies
    Write ONLY the report. Do not modify source files.`,
  timeout: 300
});
```

### Integration Points

1. **session-recovery.ts**: After 2nd failure on same task, set `auditor_preflight: true` flag
2. **master-worker.ts**: Check flag before dispatching worker; if set, run auditor first
3. **implement-and-verify.ts**: Same check in verify-fail-retry loop

### Cost Analysis

- Extra session cost: ~$0.05-0.10 per auditor run
- Only triggers on repeated failures (estimated <5% of tasks)
- Net cost: ~$0.50/day for 44% recovery on the hardest bugs

## Scope Limitation

This is **not** a general-purpose multi-agent pattern. Per EXP-245, it works specifically for:
- Structural/ordering bugs (mechanical audit)
- Cases where single-agent detection is 0%

It does NOT work for:
- Judgment tasks (code vs test decisions)
- Arithmetic reasoning gaps
- Tasks requiring domain knowledge the model lacks

## Implementation Plan

1. **Phase 1**: Add `auditor-preflight` flag to project.md schema (backward-compatible)
2. **Phase 2**: Implement auditor dispatch in `implement-and-verify.ts` retry path
3. **Phase 3**: Wire session-recovery auto-trigger after 2 failures
4. **Validation**: Run cascading-fix-trap-v2 through the production workflow to confirm the gym result transfers

## Open Questions

- Should the auditor be `coder` with reframed task, or a new `auditor` role? (EXP-242 used coder)
- Should AUDIT-REPORT.md be injected as a file or as context in the task description?
- EXP-245b (separate agent for judgment tasks) still untested — worth doing before or after shipping Phase 1?

## Decision Needed

Tech-lead: approve scope and integration points. Key question is whether to start with Phase 2 (manual flag) or jump to Phase 3 (auto-trigger).
