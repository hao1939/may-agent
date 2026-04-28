# EXP-242: Multi-Agent Structural Auditor for Relational Bugs (H-181)

**Date**: 2026-04-27
**Status**: PHASE-0-COMPLETE — auditor detects ordering bugs at 100% (4/4), far exceeding 40% threshold. Phase 1 warranted.
**Author**: Bob
**Hypothesis**: H-181 (Relational Bug Blindness, P=0.85)

## Research Question

Can a dedicated "structural auditor" agent — whose sole job is checking ordering/sequencing/relational properties — overcome the relational bug blindness that defeats all single-agent interventions?

## Background

H-181 is confirmed at P=0.85 across 6 experiments (~200 trials):
- EXP-177: Hints don't help (0% across all hint arms on cascading-fix-trap-v2)
- EXP-195: Only direct "here is the bug" helps (+30pp), generic skills 0%
- EXP-199: Tools provided for ordering checks — agent doesn't use them (0%)
- Single-agent interventions exhausted: skills, procedures, tools, instructions all fail

The agent can *fix* ordering bugs when told where they are (EXP-195: 40% with direct hint). The bottleneck is *discovery* — agents literally cannot see relational bugs. This maps to H-098 Ch2: relational reasoning requires a different cognitive mode than value-checking.

## Hypothesis (H-181 sub-prediction P-181e)

A second agent whose SOLE FOCUS is structural/ordering properties — given the same codebase but a different task framing ("find ordering violations") — will detect relational bugs at ≥40% rate, and feeding those findings to the primary agent will raise cascading-fix-trap-v2 from 0% to ≥30%.

**Mechanism**: Task framing determines attention allocation. The primary agent's task ("fix the tests") directs attention to value computation. A separate agent with task framing focused on ordering/sequencing will allocate attention differently.

## Design

### Scenario
`cascading-fix-trap-v2` — 0% baseline (all trials fail on `pipeline-order-fixed` check). Agent always finds value bug, never ordering bug.

### Arms (4 × 15 trials = 60 runs, ~$5-8)

| Arm | Description | Expected |
|-----|-------------|----------|
| A: Baseline | Standard coder, no auditor | 0% (confirmed) |
| B: Sequential Auditor | Primary fixes value bugs → auditor checks ordering → primary gets auditor report → fixes ordering | ≥30% |
| C: Parallel Auditor | Auditor runs concurrently with SOUL-level instruction "an ordering auditor is checking; wait for its report before declaring done" | ≥25% |
| D: Auditor-Only | Just the auditor agent alone (to measure auditor detection rate in isolation) | ≥40% detection |

### Auditor Agent Design

The auditor gets:
- Same codebase as primary
- Different SOUL/system prompt focused exclusively on ordering:
  ```
  You are a Structural Auditor. Your ONLY job is finding ordering/sequencing bugs.
  
  For each function that processes items in sequence:
  1. List the expected order of operations
  2. Trace the actual order in the code
  3. Report any mismatches between expected and actual ordering
  
  You do NOT fix value bugs. You ONLY look at ordering, sequencing, and pipeline flow.
  ```
- The failing test output (same as primary gets)
- NO instruction to "fix" anything — only to report structural findings

### Arm B Protocol (Sequential)
1. Primary agent runs, makes its fixes (will fix value bug, miss ordering)
2. Tests still fail → auditor agent is invoked with: "Tests still fail after value fixes. Check ordering."
3. Auditor produces report: "Pipeline stage X should run before stage Y"
4. Primary agent receives report and applies fix
5. Tests re-run

### Arm C Protocol (Parallel)  
1. Both agents start simultaneously with the same codebase
2. Primary has instruction: "A structural auditor is analyzing ordering. Check back for its findings before finalizing."
3. Auditor produces ordering report
4. Primary incorporates findings

### Success Criteria
- **Primary**: Arm B or C achieves ≥30% pass rate on cascading-fix-trap-v2 (vs 0% baseline)
- **Secondary**: Auditor (Arm D) detects the ordering bug in ≥40% of trials
- **Tertiary**: No regression on value-bug fixing (agent should still fix the value bug)

### Implementation Notes

This requires gym infrastructure support for multi-agent scenarios. Options:
1. **Manual orchestration**: Run auditor as a separate gym trial, extract its output, inject into primary's context as a "report" file — simplest, tests the mechanism
2. **Workflow-level**: Build a two-step workflow (primary → auditor → primary-round-2) — closer to production
3. **True multi-agent**: Both agents in same sandbox — hardest, deferred

**Recommended**: Start with Option 1 (manual orchestration). If auditor detection rate is high (Arm D ≥40%), proceed to Option 2 for the combined arms.

### Phase Plan
- **Phase 0**: Run Arm D (auditor-only) × 10 trials. If detection <20%, pivot.
- **Phase 1**: If Phase 0 passes, run Arms A-C × 15 trials each.
- **Phase 2**: If B or C works, design production integration (guard that invokes auditor on hard scenarios).

## Cost
- Phase 0: ~$1 (10 runs)
- Phase 1: ~$5-8 (45 runs)
- Total: ~$6-9

## Connection to Architecture

If this works, it validates the "specialized sub-agent" pattern for capability gaps. Broader implication: instead of making one agent better at everything, route specific cognitive tasks to purpose-built agents. This connects to:
- H-098 (Attention Channel Theory): different task framings activate different channels
- KE-401 (Activation vs Reasoning Gaps): ordering bugs are reasoning gaps, not activation gaps — maybe a different *agent* is the right structural intervention
- H-165 (Production-Provision Interference): auditor has zero production overhead, 100% attention on structural properties
