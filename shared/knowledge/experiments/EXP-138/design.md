# EXP-138: verify-wrap Workflow Prototype — Build and Gym-Test

**Status**: COMPLETED (gym phase — see results.md)  
**Date**: 2026-04-11  
**Author**: Coach  
**Depends on**: EXP-137 (structural comparison + intervention proposal)

---

## Objective

Build a minimal `verify-wrap` workflow that architecturally enforces verification for reliant agents, then gym-test it on scout to measure whether it reduces FM-3.3 genuine block rate.

## Background

EXP-137 found that the learner/reliant bifurcation is entirely driven by **workflow-level verification enforcement**:
- Learners (bob, coach, tech-lead) have workflows with built-in verification phases
- Reliants (may, scout, optimizer) lack workflow-level verification — the FM-3.3 guard catches 67-71% of their sessions

The proposed intervention: extract the core of bob's deliver-or-report Phase 3b (content verification by separate session) into a minimal standalone workflow.

## Hypotheses

| ID | Hypothesis | Success Criterion |
|---|---|---|
| H-138a | verify-wrap reduces FM-3.3 genuine block rate by ≥20pp vs baseline | FM-3.3 rate drops from ~71% to ≤51% |
| H-138b | verify-wrap produces genuine verification evidence (read-backs with specific content citations) | ≥80% of treatment sessions have verification_evidence citing file content |
| H-138c | verify-wrap overhead is ≤8 additional tool calls per session | Phase 2 uses ≤8 ops on average |

## Method

### Phase 1: Build verify-wrap workflow

Create `agents/shared/workflows/verify-wrap.ts` with:
- **Phase 1 (Execute)**: Run the agent with the task normally. Capture written/edited files from message history.
- **Phase 2 (Verify)**: Spawn a SEPARATE agent session that reads back each written file, confirms content matches the task, and provides verification evidence.

Target: <80 lines. No retry logic, no early-exit optimization. Pure 2-phase execute→verify.

### Phase 2: Gym Testing

**Scenario selection**: `convention-verify-edit` — tests whether agent verifies edits match conventions. Agent must edit a config file following conventions and verify the edit. This is an FM-3.3 pattern scenario where verification is the key differentiator.

**Baseline**: 3 trials of scout on `convention-verify-edit` (current prompts, no workflow)
**Treatment**: 3 trials of scout on `convention-verify-edit` using verify-wrap workflow via lab fork

**Lab fork**: `agents/.lab/scout-verify-wrap/` — modified heartbeat that dispatches through verify-wrap

### Phase 3: Measurement

Compare:
- FM-3.3 block rate (judged from session transcripts)
- Verification evidence quality (does finish() include specific file content?)
- Total ops cost (baseline vs treatment)

## Constraints

- The gym runs single-session scenarios — verify-wrap as a *workflow.ts* won't be invoked by the gym's `--agent` flag directly
- Instead, the treatment uses a **workflow-style gym scenario** (task.md split on `---`) that simulates verify-wrap's 2-phase structure
- This tests the MECHANISM (separate verification phase) rather than the workflow ADOPTION (which is a separate problem per EXP-137 risk analysis)

## Risks

| Risk | Mitigation |
|---|---|
| Gym doesn't test workflow adoption | This experiment tests the mechanism; adoption is Phase C of the deployment plan |
| 3 trials is too few for significance | Directional signal is sufficient for prototype validation |
| Scout may already pass convention-verify-edit | Run baseline first; if >60% pass, pick a harder scenario |

## Deliverables

1. `agents/shared/workflows/verify-wrap.ts` — the workflow implementation
2. `agents/shared/knowledge/experiments/EXP-138/design.md` — this file
3. `agents/shared/knowledge/experiments/EXP-138/results.md` — gym results and analysis

## Tags
`workflow-verification`, `structural-intervention`, `FM-3.3`, `scout`, `prototype`
