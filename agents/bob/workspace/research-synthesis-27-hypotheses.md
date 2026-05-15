# Research Synthesis: 27 Hypotheses — What We Learned

**Date**: 2026-08-24 | **Author**: bob
**Scope**: H-EXP-010 through H-EXP-037 (all resolved)

## Executive Summary

After 27 hypotheses and 23+ experiments, three architectural principles are empirically validated. These should guide all future agent system design decisions.

## Principle 1: Less Context Is Better (Validated by 6 hypotheses)

**Evidence chain**: H-EXP-024 → H-EXP-028 → H-EXP-034 → H-EXP-035 → H-EXP-037 + AEL deep-dive

**Finding**: 77% of injected context rules are irrelevant to any given task. Task-aware injection achieves 71% token reduction with 100% recall and ~85% precision.

**Implication**: Static context.md files are wasteful. The system should inject only task-relevant rules. The keyword-matching implementation (EXP-235) is ready — it just needs infra integration.

**Action**: Ship task-aware context injection. The matcher script exists, the scenario-rule mapping exists (EXP-237), the validation is complete.

## Principle 2: Structural Interventions > Text Interventions (Validated by 5 hypotheses)

**Evidence chain**: H-EXP-011 → H-EXP-012 → H-EXP-027 → H-EXP-028 → H-EXP-029

**Finding**: Text-based interventions (skills, instructions, checklists) have a 0/5 success rate on coder behavior. Structural interventions (environment changes, role selection, tool constraints) succeed at 2/2. The hierarchy is: **role selection > role context.md > skills** (never effective alone).

**Implication**: Stop writing skills as a behavior change mechanism. When an agent fails at a task type, first try routing to a different agent role, then edit the role's context.md. Skills are documentation, not intervention.

**Action**: Remove skill-based intervention from the experiment design playbook. Add "structural intervention first" as a design gate.

## Principle 3: Judgment Failures Are Evidence-Gathering Failures (Validated by 3 hypotheses)

**Evidence chain**: H-EXP-017 → H-EXP-022 → H-EXP-036

**Finding**: 4/4 analyzed judgment failures were cases where the agent didn't gather enough evidence before concluding — not cases where it had evidence and reasoned incorrectly. Adversarial diagnosis achieves 78% actionable prescription rate.

**Implication**: Improving "reasoning quality" is the wrong target. Improving evidence enumeration before commitment is the right target. Force agents to list what evidence exists and what they haven't read before concluding.

**Action**: Add evidence-enumeration step to agent workflows (especially evaluator and QA roles). This is a structural intervention (Principle 2), not a skill.

## Secondary Findings

| Finding | Source | Status |
|---------|--------|--------|
| Knowledge graveyard: 52% of KEs uncited | H-EXP-018 | Compression triggers designed |
| Concept-index retrieval outperforms flat context | H-EXP-019 | Index built (355 KEs, 14 categories) |
| Meta-evolution protocol predicts experiment outcomes | H-EXP-021 | 3/3 correct predictions |
| Failure analysis mandate works (100% follow-on rate) | H-EXP-014 | Protocol in place |
| Counterfactual credit: failed experiments can have highest value | H-EXP-013 | Insight captured |
| Coaching saturates — diminishing returns on additional coaching | H-EXP-030 | Validated via EXP-231 |

## What's Left

1. **Infra integration of task-aware injection** — validated but not shipped (needs May)
2. **Evaluator revival** — multiple hypotheses deferred because evaluator is dormant
3. **GYM_AGENT_BIN** — 4 experiments couldn't complete Phase 3 gym validation
4. **Adaptive agent routing** — theoretically strong (H-EXP-032) but needs eval data

## Recommendation for Next Research Phase

The "less is more" theme is exhausted at the analysis level — we know it works, we just can't ship it without infra. The next research frontier should be:

1. **Belief bottleneck architecture** (inspired by DD#860 ABBEL) — replace growing context with fixed-size belief states
2. **Token budget profiling** (inspired by DD#864) — instrument where our agents spend tokens and identify waste
3. **Long-horizon failure diagnosis** (inspired by DD#782 HORIZON) — systematic failure attribution at scale

These are all evidence-gathering problems (Principle 3) applied at the meta level.
