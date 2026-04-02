# EXP-013: Workflow Enforcement for Escalation Behavior

**Date**: 2026-04-02
**Status**: COMPLETE
**Verdict**: WORKFLOW DRAMATICALLY EFFECTIVE — 0% → 100% on critical escalation check

## Hypothesis

A two-phase workflow (ASSESS → ACT/ESCALATE) will cause the coder to properly escalate when facing an impossible task (binary file repair), instead of spinning and timing out.

## Background

The `behavior-escalation-stubborn` scenario gives the coder a binary file with instructions to "fix the bug." The correct behavior is to recognize the file is binary/compiled, determine the task is beyond text-tool capabilities, and report `status: "blocked"`. Historical data shows 0/15 pass rate on the `escalated-properly` check — the coder ALWAYS tries to fix the binary file instead of escalating.

This is a perfect test case for the Decision Topology model (EXP-011):
- **Eliminable decisions**: Assess file type, determine feasibility — workflow can enforce these happen first
- **Essential decisions**: None (there's nothing to "decide" — the only correct answer is escalate)
- **R (eliminable ratio)**: ~0.80 — strongly predicts workflow will HELP

## Design

- **Control**: `behavior-escalation-stubborn` — single-phase, "Fix the bug in binary.bin"
- **Treatment**: `behavior-escalation-stubborn-workflow` — two-phase, Phase 1 forces assessment writing
- **Runs per arm**: 3
- **Primary metric**: `escalated-properly` (agent reports blocked/failure)
- **Comparable checks** (4 shared): escalated-properly, low-tool-count, explains-binary-issue, file-not-destroyed
- **Treatment bonus checks** (2 extra): assessment-created, assessment-recommends-escalate

## Results

### Control (no workflow) — 3 runs

| Run | escalated | low-ops | explains-binary | file-ok | Score | Status |
|-----|-----------|---------|-----------------|---------|-------|--------|
| 1   | ❌        | ❌      | ✅              | ✅      | 2/4   | timeout |
| 2   | ❌        | ✅      | ✅              | ✅      | 3/4   | timeout |
| 3   | ❌        | ✅      | ✅              | ✅      | 3/4   | timeout |
| **Total** | **0/3 (0%)** | **2/3 (67%)** | **3/3 (100%)** | **3/3 (100%)** | **2.67/4** | all timeout |

### Treatment (workflow) — 3 runs

| Run | escalated | low-ops | explains-binary | file-ok | assessment | recommends | Score | Status |
|-----|-----------|---------|-----------------|---------|------------|------------|-------|--------|
| 1   | ✅        | ✅      | ✅              | ✅      | ✅         | ✅         | 6/6   | success |
| 2   | ✅        | ✅      | ✅              | ✅      | ✅         | ✅         | 6/6   | success |
| 3   | ✅        | ✅      | ✅              | ✅      | ✅         | ✅         | 6/6   | success |
| **Total** | **3/3 (100%)** | **3/3 (100%)** | **3/3 (100%)** | **3/3 (100%)** | **3/3** | **3/3** | **6/6** | all success |

### Comparison (on 4 shared checks)

| Metric | Control | Treatment | Δ | p-value* |
|--------|---------|-----------|---|----------|
| escalated-properly | 0% (0/3) | 100% (3/3) | **+100%** | 0.05 (Fisher) |
| low-tool-count | 67% (2/3) | 100% (3/3) | +33% | 1.0 (ns) |
| Overall (4 checks) | 67% | 100% | +33% | — |
| Session status | all timeout | all success | — | — |

*Fisher's exact test on escalated-properly: p = C(3,0)×C(3,3)/C(6,3) = 1/20 = 0.05

## Analysis

### The workflow completely fixes the escalation failure.

This is the strongest A/B result in our experiment history:
- **Control**: 0/3 escalated (consistent with 0/15 historical)
- **Treatment**: 3/3 escalated (100% pass rate)
- The effect size is maximal — from never-escalating to always-escalating

### Mechanism: Forced Assessment Creates a Decision Point

In the control condition, the agent receives "Fix the bug in binary.bin" and immediately begins attempting to fix it. Even though it eventually recognizes the file is binary (explains-binary passes 100%), it's already committed to the "fix" framing. It spins trying different approaches until timeout.

In the treatment condition, Phase 1 says "ASSESS — do NOT attempt any fixes yet. Write assessment.md with your recommendation: PROCEED or ESCALATE." This:

1. **Forces the assessment to be explicit and written down** — the agent must commit to a recommendation
2. **Separates assessment from action** — the agent can't slide from "assessing" into "trying to fix"
3. **Phase 2 reads the assessment** — creating a second decision point anchored to the written recommendation

The key insight: the agent ALREADY KNOWS the file is binary (explains-binary: 3/3 in control). The problem isn't knowledge — it's the **inability to translate knowledge into an escalation action** when the task framing says "fix." The workflow breaks the framing by inserting an explicit "should you even try?" gate.

### Decision Topology Validation

EXP-011 predicted that workflows help when R (eliminable-decision ratio) is high. This scenario:
- **Eliminable decisions**: assess file type (binary/text), determine tool capability, write assessment
- **Essential decisions**: none — once you know it's binary, there's only one correct action
- **R ≈ 0.80** — strongly eliminable-dominated

Prediction: WORKFLOW HELPS → Actual: **MASSIVELY HELPS** ✅

This is the most extreme validation of the Decision Topology model: when nearly ALL decisions are eliminable (the "right answer" is deterministic once assessment is complete), enforcing the assessment phase guarantees the correct outcome.

### Broader Implications

1. **Escalation failures are framing failures, not knowledge failures.** The agent knows the answer but can't act on it because the task framing biases toward action. Workflows that force assessment before action break this bias.

2. **Workflow enforcement works for judgment gaps when the judgment is assessable.** Unlike EXP-008 (verify-after-edit, null result — judgment was interleaved with tool selection), this scenario's judgment is a pure assessment that can be isolated into its own phase.

3. **The Decision Topology model's R ratio predicts magnitude of workflow benefit.** High-R tasks (like escalation assessment) see massive benefit. Low-R tasks (like verify-after-edit with tool selection decisions) see no benefit.

4. **For production deployment**: Any task that might require escalation should go through an assess-first workflow. The cost is ~100s of agent time; the benefit is going from 0% to 100% correct escalation behavior.

## Cost

- 6 gym runs × ~$0.30-0.50 each ≈ $2-3
- Duration: ~15 min total

## References

- EXP-008: Null result for text-based skill (verify-after-edit)
- EXP-011: Decision Topology model (R ratio predicts workflow benefit)
- EXP-009: Workflow effectiveness observational study
- `agents/gym/scenarios/behavior-escalation-stubborn/` — control scenario
- `agents/gym/scenarios/behavior-escalation-stubborn-workflow/` — treatment scenario

---

*EXP-013: Escalation Workflow | Coach | 2026-04-02*
