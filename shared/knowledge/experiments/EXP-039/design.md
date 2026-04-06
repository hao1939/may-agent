# EXP-039: Informationally Isolated Verification Protocol

**Date**: 2026-04-05
**Author**: Bob (Architect)
**Status**: DESIGNED — protocol specified, awaiting implementation
**Tests**: H-009 (evaluator rubber stamp), H-001 (adversarial framing)

## Question

Does **informationally isolated verification** — where the verifier cannot see the producer's reasoning, only its outputs — detect more issues than contextual verification where the verifier has full access?

## Background

Three independent evidence streams converge on this design:

### Internal Evidence
- **H-009**: Evaluator is a rubber stamp (90.7% "good"). It sees the agent's `finish()` summary and deliverables — both **produced by the agent to describe its own work**. The evaluator evaluates the agent's self-description, not its actual work.
- **KE-005**: QA detects issues in only 14% of reviews. QA reads the same coder summary the evaluator sees.
- **KE-019**: Materialization gates (0%→100%) work because they create a **written commitment** that's structurally separate from the action. The commitment can be evaluated independently.

### External Evidence
- **DD-532 (EvoSkills)**: Informationally isolated Surrogate Verifier outperforms contextual verification. Key mechanism: *information isolation prevents confirmation bias*. The verifier can't be fooled by the generator's reasoning because it never sees it.
- **DD-528 (SEVerA)**: Formal output contracts work because they evaluate outputs against specifications, not against the producer's intent.
- **Process-critics synthesis**: Outcome critics fail because agents learn to produce outcome patterns (good summaries) without producing good outcomes.

### The Core Problem

Our current verification pipeline passes the producer's **self-description** to the verifier:

```
Producer → {code + summary + deliverables + evidence} → Verifier
```

The summary, deliverables, and evidence fields are **agent-authored narratives about its own work**. They create a confirmation frame: the verifier reads "I did X, here's evidence Y" and evaluates whether the narrative is coherent, not whether X was actually done or Y is actually evidence.

EvoSkills proves this is a general phenomenon: when a verifier has access to the producer's reasoning, it inherits the producer's biases.

## Design

### Protocol: Isolated Verification

Strip the agent's self-description from the verification input. Give the verifier ONLY:
1. The **task specification** (what was requested)
2. The **output artifacts** (files modified, code written)
3. The **tool execution log** (what commands were run, what they returned)

Do NOT give the verifier:
- The agent's summary
- The agent's claimed deliverables
- The agent's self-reported evidence
- The agent's reasoning or planning

### Concrete Implementation

**Phase A: Controlled Comparison (Gym)**

Use a gym scenario with known bugs (e.g., `qa-evidence-discipline`):

| Condition | Verifier Input | N |
|-----------|---------------|---|
| **Control** (current) | Full session output including agent summary, deliverables, evidence | 10 |
| **Isolated** (treatment) | Task spec + modified files + tool log ONLY (no agent narrative) | 10 |

Both conditions use the same verifier prompt (evaluator heuristic). The only difference is what information the verifier receives.

**Measure**: 
- Issue detection rate (% of reviews finding ≥1 planted bug)
- False positive rate
- Verdict distribution (does isolation break the 90.7% "good" pattern?)

**Phase B: Evaluator Redesign**

If Phase A confirms isolation helps, redesign the production evaluator:

1. **Step 1**: Evaluator receives task description + file diffs + test results
2. **Step 2**: Evaluator independently assesses whether the task was accomplished
3. **Step 3**: Compare evaluator's independent assessment against agent's self-report
4. **Step 4**: Discrepancies trigger deeper review

### Predictions

**P-A1** (Strong): Isolated verification will detect ≥2x more issues than contextual verification in the gym scenario.
*Basis*: EvoSkills showed information isolation is the primary mechanism. Our 90.7% rubber stamp rate leaves enormous room for improvement.

**P-A2** (Moderate): Isolated verification will produce a wider verdict distribution (breaking the "everything is good" pattern).
*Basis*: Without the agent's optimistic self-description, the verifier must form its own judgment from raw artifacts.

**P-A3** (Weak): False positive rate will increase slightly (<2x) in isolated condition.
*Basis*: Some agent context is genuinely useful (e.g., "I intentionally didn't change X because..."). Isolation removes this signal.

### Controls

- Same verifier model and prompt for both conditions
- Same gym scenario and planted bugs
- Randomized order of conditions
- Blind: verifier doesn't know which condition it's in (both get structured input, just different fields)

## Connection to Existing Work

| Existing | How EXP-039 Extends It |
|----------|----------------------|
| EXP-036 (H-009 Phase 1 fix) | EXP-036 improved the evaluator's scoring logic. EXP-039 changes what information reaches the evaluator — a more fundamental intervention. |
| EXP-038 (adversarial QA) | EXP-038 changes the verifier's framing. EXP-039 changes the verifier's information. Orthogonal interventions — could be combined. |
| H-009 Phase 2 (semantic signals) | Phase 2 added heuristic detection of hollow summaries. EXP-039 removes summaries entirely — doesn't try to detect hollow ones, just doesn't pass them. |

## Success Criteria

1. Phase A shows statistically significant improvement in issue detection (p<0.05 or ≥2x effect size with N=10)
2. Verdict distribution in isolated condition has entropy >1.0 (vs ~0.3 in current rubber stamp distribution)
3. Protocol is implementable in production evaluator without breaking existing workflow

## Risk Assessment

- **Risk**: Isolation removes genuinely useful context, making the verifier worse at understanding complex tasks.
  **Mitigation**: Phase A is controlled. If isolated verification is worse, we don't deploy.

- **Risk**: Verifier without context produces many false positives, creating alert fatigue.
  **Mitigation**: Track false positive rate explicitly. If >30%, the protocol needs context back for specific categories.

- **Risk**: Agents learn to encode their narrative in code comments or file names, circumventing isolation.
  **Mitigation**: This is a longer-term concern. For Phase A, it's not an issue (gym scenarios are one-shot).

## Files

- This design: `agents/shared/knowledge/experiments/EXP-039/design.md`
- Depends on: Gym scenario `qa-evidence-discipline`
- Will produce: Results in `EXP-039/results.md`
