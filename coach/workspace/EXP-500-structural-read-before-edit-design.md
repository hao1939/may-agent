# EXP-500: Structural Read-Before-Edit via Workflow Injection

**Date**: 2028-07-10
**Status**: DESIGNED
**Author**: coach
**Predecessor**: EXP-490 (read-before-edit 0% via text), KE-480 (text coaching dead)

## Problem

read-before-edit compliance is 0% across 6 trials (EXP-490 Phase 1 + Phase 2). Text skill demoted. But the underlying behavior gap remains: agents edit files without reading them first, leading to overwrites and missed context.

KE-480 proves only scaffold/structural interventions work. EXP-495 proved scaffold templates work for write-first. Can the same pattern work for read-before-edit?

## Hypothesis

A workflow-level injection that automatically reads target files before presenting the edit task to the agent will achieve 100% "informed edits" — not by changing agent behavior, but by ensuring the file content is in context.

**Alternative**: A pre-edit hook in the tool layer that auto-reads the file and injects its content into the conversation before the edit executes.

## Design

### Approach A: Prompt Injection (testable in gym)
- Modify scenario's `task.md` to include file contents inline ("Here is the current content of X:")
- Measure: does agent produce correct edits (no overwrites) more often?
- Baseline: standard read-before-edit scenario (0% read compliance, but edits may still be correct)
- Treatment: file contents pre-injected into task prompt

### Approach B: Workflow Pre-Read Step (production deployment)  
- In master-worker.ts, before dispatching edit tasks, read target files and include content in worker prompt
- Similar to EXP-495 scaffold but focused on input context rather than output structure

## Method

**Phase 1** (gym — Approach A):
1. Create scenario variant: `read-before-edit-preloaded` 
2. task.md includes actual file contents inline
3. Run 3 trials, measure edit correctness (not read behavior — that's structural now)
4. Compare to baseline edit correctness

**Phase 2** (production — Approach B):
- If Phase 1 shows improved edit correctness, implement in master-worker.ts

## Success Criteria

- Phase 1: Edit correctness ≥90% with preloaded content (vs baseline TBD)
- If edit correctness is ALREADY high without reading (agent just writes correct edits regardless), then close as UNNECESSARY — the read-before-edit behavior gap has no production impact

## Key Question

Does NOT reading before editing actually cause worse edits? Or is it just a "best practice" that doesn't affect outcomes? If edits are correct anyway, the skill was correctly demoted and no structural fix is needed either.

## Next Steps

1. Run baseline: measure edit CORRECTNESS (not read behavior) in read-before-edit scenario
2. If correctness is already high → close as UNNECESSARY
3. If correctness is low → create preloaded variant and test
