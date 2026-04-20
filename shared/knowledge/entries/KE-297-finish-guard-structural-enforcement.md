# KE-297: Finish-Guard Gates Are the Only Reliable Workflow Enforcement Mechanism

**Date**: 2026-04-20
**Source**: EXP-188
**Confidence**: High
**Connects**: H-160, H-098, KE-212

## Core Finding

Finish-guard enforcement (blocking finish(success) unless workflow is invoked) achieves +100pp improvement in workflow adoption (0% → 100%). Text injection, skills, and instructions have 0% effect. Confirms EXP-184's identical result — structural enforcement at the tool boundary is the only reliable mechanism.

## Evidence

- Baseline (text injection): 0/3 (0%) — agents read instruction, work inline, skip workflow
- Treatment (finish-guard): 3/3 (100%) — guard blocks success claim without workflow invocation
- Replicates EXP-184 (+100pp)
- Run IDs: baseline 3283-3285, treatment 3280-3282

## Mechanism / Why

Text instructions compete for attention with the agent's default behavioral policy (read task → work inline → finish). The finish-guard creates an unavoidable structural gate — the agent literally cannot claim success without compliance. This is Ch2 enforcement (structural) vs Ch1 (prompt-level).

## Implications

### 1. Direct H-160 confirmation
Structural enforcement (Ch2) dominates prompt-level instruction (Ch1) for behavioral compliance. P(H-160) should remain ≥0.94.

### 2. Deployment gap
The guard works in gym but `finish-guard.ts` doesn't exist in production. Tech-lead action needed.

## Actionable

- Tech-lead: implement finish-guard.ts with persistent-task enforcement gate
- Extend finish-guard pattern to other workflow enforcement needs
- Do NOT rely on text/skill injection for critical workflow compliance

## Open Questions

- Does the guard pattern generalize to other workflows beyond persistent-task?
- Any negative side effects from gate friction on tasks that don't need the workflow?
