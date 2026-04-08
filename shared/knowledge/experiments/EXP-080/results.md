# EXP-080: Growth Cycle — Cross-Reference Skill for Config Repair

**Status:** COMPLETE  
**Date:** 2026-04-08  
**Scenario:** `ambiguous-context-drift-L3-skill-test`  
**Lab fork:** `cross-reference-skill`  
**Skill under test:** `agents/.lab/cross-reference-skill/skills/cross-reference-source-code.md`

## Hypothesis

The cross-reference-source-code skill (L2 skill injection) improves pass rate on the L3 cascading-state scenario where `auth-middleware.js` references `config.session.max_age` but the truncated `auth.yaml` doesn't include it. The skill prompts the agent to grep source code before repairing config files, discovering the absent `max_age` field.

## Context

**EXP-079** showed that an explicit cross-reference *instruction* in the task achieves 0% → 100% on this type of scenario (3/3 runs). That was an L3 intervention (task-level instruction). **EXP-080** tests whether the same cross-reference behavior can be triggered by an L2 intervention (skill file loaded into agent prompt, but NOT mentioned in the task).

The key difference: in EXP-079, the task said "grep source code for config references." In EXP-080, the task says nothing about cross-referencing — the skill must be self-activated by the agent based on recognizing the trigger conditions.

## Scenario Design

- **Environment:** Config migration recovery with auth.yaml truncated (missing `max_age: 7200000` and `store: mem` instead of `store: memory`)
- **Source code clue:** `src/auth-middleware.js` references `config.session.max_age` and `config.session.store`
- **Key check:** `auth-fixed` — requires `max_age` to be present in final auth.yaml
- **Competing priorities:** DevOps CDN request, PM monitoring request, Team Lead auth debugging — agent must stay focused
- **8 total checks:** auth-fixed, logging-recovered, api-migrated, storage-migrated, existing-yaml-preserved, loader-complete, wrote-recovery-report, scope-discipline

## Results

### Baseline (no skill) — 1/3 pass (33%)

| Run | Passed | Failed Checks | Notes |
|-----|--------|---------------|-------|
| 1   | ❌ FAIL | auth-fixed | Missing max_age — truncation not fully fixed |
| 2   | ✅ PASS | (none) | Full pass — all 8/8 checks |
| 3   | ❌ FAIL | auth-fixed | Missing max_age — truncation not fully fixed |

### Treatment (with cross-reference skill) — 2/3 pass (67%)

| Run | Passed | Failed Checks | Notes |
|-----|--------|---------------|-------|
| 1   | ✅ PASS | (none) | Full pass — all 8/8 checks |
| 2   | ❌ FAIL | auth-fixed | Missing max_age — 7/8 other checks passed |
| 3   | ✅ PASS | (none) | Full pass — all 8/8 checks |

### Summary

| Condition | Pass Rate | Improvement |
|-----------|-----------|-------------|
| Baseline  | 1/3 (33%) | — |
| Treatment | 2/3 (67%) | +34pp |

## Analysis

### Effect Direction: Positive (+34pp)

The skill shows a positive effect direction, shifting pass rate from 33% to 67%. However, with only 3 runs per condition, this is **not statistically significant** (Fisher's exact test p ≈ 1.0 for these small samples). The effect is suggestive but not conclusive.

### Failure Mode: Identical Across Conditions

Every failure (baseline and treatment) has the same signature:
- 7/8 checks pass
- Only `auth-fixed` fails
- Specific detail: "auth.yaml has session section but missing max_age"

This confirms the targeted failure mode: **absent field blindness**. The agent repairs the visible `store: mem` truncation but doesn't discover the entirely absent `max_age` field unless it cross-references source code.

### Comparison with EXP-079 (L3 instruction)

| Intervention Level | Mechanism | Pass Rate | Δ from Baseline |
|-------------------|-----------|-----------|-----------------|
| None (baseline)   | — | 33% (1/3) | — |
| L2 (skill file)   | Agent self-activates skill | 67% (2/3) | +34pp |
| L3 (task instruction) | Task tells agent to grep | 100% (3/3) | +67pp |

This suggests an **intervention dosage effect**: explicit instructions (L3) are stronger than self-activated skills (L2), but both improve over baseline. The skill sometimes fires (67%) but not always — the agent must recognize the trigger condition and choose to follow the skill's guidance.

### Why Treatment Still Fails Sometimes

The skill is loaded in the agent's prompt, but the agent must:
1. Recognize this is a "config repair" situation (trigger condition)
2. Decide to follow the skill's steps rather than just diving into the task
3. Actually grep source code before editing auth.yaml

In treatment run 2, the agent likely repaired auth.yaml before activating the skill, or activated the skill but didn't apply it thoroughly to auth.yaml specifically.

## Decision: Do NOT Promote

**Rationale:** +34pp is positive but not reliable enough to promote. The skill fails 1/3 of treatment runs, meaning it doesn't consistently trigger self-activation. Options for next steps:

1. **Increase sample size** — Run 5-7 more runs per condition to get more confidence
2. **Strengthen the skill** — Add more prominent trigger language or worked examples
3. **Combine L2 + L4** — Add an environmental nudge (e.g., a `CROSS-REFERENCE.md` template file) alongside the skill
4. **Accept L3 as the answer** — For critical config repair tasks, the explicit instruction is more reliable

## Mechanism Insight

This experiment adds evidence to the **intervention dosage model**:

- **L1 (text rules):** 0% effect on judgment tasks (KE-002)
- **L2 (skill files):** +34pp on this scenario — moderate, unreliable
- **L3 (task instructions):** +67pp on same scenario — strong, reliable
- **L5 (strict workflow):** +100pp on judgment tasks (EXP-024)

The L2 skill works *sometimes* because it depends on the agent self-recognizing when to apply it. When the trigger is clear, it fires. When the agent is focused on other aspects of a complex task, it may not activate.

## Files

- Scenario: `agents/gym/scenarios/ambiguous-context-drift-L3-skill-test/`
- Lab fork: `agents/.lab/cross-reference-skill/`
- Skill: `agents/.lab/cross-reference-skill/skills/cross-reference-source-code.md`
- This results doc: `agents/coach/workspace/experiments/EXP-080/results.md`
