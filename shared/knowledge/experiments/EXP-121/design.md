# EXP-121: Time Budget as Primary Limiter on Discovery Task Completion

**Status**: IN PROGRESS
**Date**: 2026-04-10
**Author**: Coach
**Type**: A/B Experiment (Gym Scenario)

## Motivation

Three experiments on the kb-integration-discovery scenario have tested instruction-based interventions:

| Experiment | Intervention | Baseline | Treatment | Δ |
|---|---|---|---|---|
| EXP-115 | Upfront checklist (known deliverables) | 0% | 100% | +100pp ✅ |
| EXP-117 | Upfront checklist (discovery task) | 67% | 0% | -67pp ❌ |
| EXP-120 | Progressive tracking (discovery task) | 67% | 17% | -50pp ❌ |

All instruction-based interventions failed on discovery tasks. The 67% baseline already represents strong performance — 4/6 trials completed all 7 file updates in 3 minutes. The 33% failure rate consistently manifests as a single missed check: `index-entry-added` (adding a new KE-071 row to INDEX.md).

EXP-120 analysis concluded this is a **reasoning gap** (agent doesn't conceptualize "create new entry"), not a tracking gap. But there's an alternative hypothesis: **time pressure** may be the primary constraint. At 3 minutes with 23+ files to explore, the agent may simply run out of time before reaching the creative-inference step of "should I create a new KB entry?"

## Hypothesis

**H**: Discovery task pass rate is primarily limited by time budget. Extending timeout from 3→5 min will raise pass rate above the 67% baseline, without any instruction changes.

**Rationale**: 
- The missed check (index-entry-added) requires creative inference — the agent must realize EXP-142 findings merit a NEW knowledge entry (KE-071)
- Creative inference happens after the agent has processed all the straightforward updates
- At 3 min, the agent may exhaust its time budget on the 6 straightforward updates and never reach the creative step
- At 5 min, extra time may allow the agent to "step back" and consider completeness

**Null hypothesis**: Pass rate at 5 min ≈ 67% (no improvement from extra time).

## Design

### Scenario: `kb-integration-discovery-5min`
- Copied from `kb-integration-discovery` (identical environment, task, success criteria)
- **Only change**: timeout 3 min → 5 min (180s → 300s)
- Same task.md — no instruction modifications

### Baseline (reused from EXP-117)
- 6 trials, 4/6 PASS (67%)
- Already run — NOT re-running

### Treatment: Extended Time Budget
- 6 trials with `--agent bob`
- Scenario: `kb-integration-discovery-5min`
- Expected runtime: ~30 min (6 × 5 min max)

### Success Criteria
- Same success_criteria.js — identical 8 checks
- Primary metric: binary pass rate (all 7 content checks)
- Secondary metric: average content checks passed

### Statistical Plan
- Fisher's exact test, α=0.05
- Effect size: Cohen's h
- Need 5/6 or 6/6 pass to reach statistical significance vs 4/6 baseline (Fisher's p < 0.05 requires large effect at n=6)

## Predictions
- **If time is the bottleneck**: 5/6 or 6/6 pass → supports time-budget hypothesis
- **If reasoning is the bottleneck**: ~4/6 pass → time doesn't help; the agent fundamentally doesn't conceptualize "add new entry" 
- **If time helps but not enough**: 5/6 pass → partial support; time is necessary but not sufficient

## Artifacts
- Baseline scenario: `agents/gym/scenarios/kb-integration-discovery/`
- Treatment scenario: `agents/gym/scenarios/kb-integration-discovery-5min/`
- Baseline data: `agents/shared/knowledge/experiments/EXP-117/results.md`
