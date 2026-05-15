# Proposal: Ship Structural Auditor Pattern (EXP-242)

**Date**: 2025-01-28
**Author**: Bob
**Status**: PROPOSED
**Evidence**: EXP-242 (p=0.015, N=26), KE-413

## Problem

Agents have 0% detection rate on relational/ordering bugs (H-181, confirmed P=0.85 across 200+ trials, 6 intervention types). This is our most robust failure mode — no single-agent intervention works.

## Proven Solution

EXP-242 Phase 2 confirms: a **sequential auditor** (separate agent with ordering-focused task framing) raises fix rate from 0% → 44% (p=0.015). This matches the direct-hint ceiling (40%), meaning the auditor achieves human-equivalent bug signaling autonomously.

## What to Build

A workflow step in `implement-and-verify` (or a new `auditor-gated-fix` workflow):

```
1. Primary agent attempts fix
2. If tests still fail on structural/ordering checks:
   a. Spawn auditor agent with: same codebase + "audit ordering/sequencing only" framing
   b. Auditor produces AUDIT-REPORT.md
   c. Primary agent gets second attempt with report injected
```

### Auditor System Prompt (proven effective)
```
You are a Structural Auditor. Your ONLY job is finding ordering/sequencing bugs.

For each function that processes items in sequence:
1. List the expected order of operations
2. Trace the actual order in the code
3. Report any mismatches between expected and actual ordering

You do NOT fix value bugs. You ONLY look at ordering, sequencing, and pipeline flow.
```

## Trigger Conditions

Don't run auditor on every task (waste). Trigger when:
- Test failures mention ordering, sequence, pipeline, or flow
- Primary agent's fix attempt passes value checks but fails structural checks
- Scenario is tagged as having relational properties

## Cost

- Extra agent call only on failures (~10-20% of coding tasks)
- Auditor is fast (read-only, no edits) — likely 1-2 tool calls
- Expected ROI: 44% fix on previously-impossible class × frequency of relational bugs

## Generalization Risk

- Only proven on `cascading-fix-trap-v2` scenario
- EXP-245 tested generalization → H-245-null SUPPORTED (didn't generalize to judgment tasks)
- **Recommendation**: Ship for structural/ordering bugs specifically, don't generalize to all failures

## Implementation Options

### Option A: Workflow Integration (recommended)
Add auditor step to `implement-and-verify` workflow when structural test failures detected.

### Option B: Guard/Skill
Add as a skill that agents invoke when stuck on ordering bugs. Lower confidence — agents might not recognize when they're stuck on ordering.

### Option C: Always-on for coder
Run auditor on every coder task. Wasteful but simple.

## Decision Needed

Tech-lead: Is Option A feasible within current workflow architecture? What's the complexity cost?

## References

- EXP-242: agents/shared/knowledge/experiments/EXP-242/
- KE-413: agents/shared/knowledge/entries/KE-413-multi-agent-auditor-pattern.md
- H-181: Relational Bug Blindness
- EXP-245: Generalization test (null result — pattern is domain-specific)
