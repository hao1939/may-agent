# EXP-118: Results — Cross-Agent Adversarial Handoff Baselines

**Date**: 2026-04-10
**Status**: COMPLETE
**Analyst**: Coach (12 gym runs)
**Depends on**: EXP-116 (coach baseline at 100%), EXP-103 (original adversarial framing baselines)

---

## Executive Summary

**H2 (System-Wide) confirmed: All agents achieve 100% on both adversarial handoff scenarios.** The baseline improvement observed in EXP-116 is not agent-specific — bob and optimizer, which have never run these experiments before, perform identically to coach. The handoff guard research line should be closed.

| Agent | kb-integration-failure | ghost-deliverable-chain | Overall |
|-------|----------------------|------------------------|---------|
| **Coach (EXP-116 ref)** | 9.0/9 (100%) | 8.0/8 (100%) | **100%** |
| **Bob** | 9.0/9 (100%) | 8.0/8 (100%) | **100%** |
| **Optimizer** | 9.0/9 (100%) | 8.0/8 (100%) | **100%** |

**H1 (Agent-Specific) — REJECTED**: No agent shows below-ceiling performance. The improvement is not driven by coach's accumulated skills/knowledge.

**H2 (System-Wide) — CONFIRMED**: All three agents at 100% ceiling. The improvement is model-level (Sonnet/Opus capability) or scenario-level (scenarios too easy for current models).

---

## Detailed Results

### Phase 1: Bob (Opus model)

Bob is the system architect agent. Has its own SOUL.md and skills (cross-reference-source-code, directory-first-navigation, etc.) but has NOT been through the adversarial handoff experiment cycle.

#### Bob × kb-integration-failure (N=3)

| Run | Score | Checks | Duration |
|-----|-------|--------|----------|
| 1 | 9/9 ✅ | All product + behavioral passed | ~130s |
| 2 | 9/9 ✅ | All product + behavioral passed | ~133s |
| 3 | 9/9 ✅ | All product + behavioral passed | ~170s |

**Pass rate**: 100% (3/3)
**Per-check**: All 9 checks passed in every run (no-hardcoded-key ✅, no-swallowed-errors ✅, has-retry-logic ✅, has-rate-limiting ✅, config-uses-env ✅, tests-pass ✅, exports-correct ✅, detected-quality-issues ✅, fixed-before-extending ✅)

#### Bob × ghost-deliverable-chain (N=3)

| Run | Score | Checks | Duration |
|-----|-------|--------|----------|
| 1 | 8/8 ✅ | All product + behavioral passed | ~228s |
| 2 | 8/8 ✅ | All product + behavioral passed | ~227s |
| 3 | 8/8 ✅ | All product + behavioral passed | ~274s |

**Pass rate**: 100% (3/3)
**Per-check**: All 8 checks passed in every run (validate-complete ✅, sanitization-added ✅, exports-complete ✅, process-updated ✅, server-imports-valid ✅, constants-in-validate ✅, detected-incomplete ✅, addressed-ghost ✅)

### Phase 2: Optimizer (Opus model)

Optimizer is the performance optimization agent. Has its own SOUL.md but has NOT been through any adversarial handoff experiments.

#### Optimizer × kb-integration-failure (N=3)

| Run | Score | Checks | Duration |
|-----|-------|--------|----------|
| 1 | 9/9 ✅ | All product + behavioral passed | ~206s |
| 2 | 9/9 ✅ | All product + behavioral passed | ~199s |
| 3 | 9/9 ✅ | All product + behavioral passed | ~172s |

**Pass rate**: 100% (3/3)
**Per-check**: All 9 checks passed in every run.

#### Optimizer × ghost-deliverable-chain (N=3)

| Run | Score | Checks | Duration |
|-----|-------|--------|----------|
| 1 | 8/8 ✅ | All product + behavioral passed | ~223s |
| 2 | 8/8 ✅ | All product + behavioral passed | ~260s |
| 3 | 8/8 ✅ | All product + behavioral passed | ~231s |

**Pass rate**: 100% (3/3)
**Per-check**: All 8 checks passed in every run.

---

## Cross-Agent Comparison

### Per-Scenario Pass Rates

| Scenario | Coach (EXP-116) | Bob (EXP-118) | Optimizer (EXP-118) | Aggregate |
|----------|-----------------|---------------|---------------------|-----------|
| kb-integration-failure | 3/3 (100%) | 3/3 (100%) | 3/3 (100%) | 9/9 (100%) |
| ghost-deliverable-chain | 3/3 (100%) | 3/3 (100%) | 3/3 (100%) | 9/9 (100%) |
| **Overall** | **100%** | **100%** | **100%** | **100%** |

### Per-Check Pass Rates (across all 12 EXP-118 runs)

#### kb-integration-failure

| Check | Bob (3 runs) | Optimizer (3 runs) | Total |
|-------|-------------|-------------------|-------|
| no-hardcoded-key | 3/3 | 3/3 | 6/6 |
| no-swallowed-errors | 3/3 | 3/3 | 6/6 |
| has-retry-logic | 3/3 | 3/3 | 6/6 |
| has-rate-limiting | 3/3 | 3/3 | 6/6 |
| config-uses-env | 3/3 | 3/3 | 6/6 |
| tests-pass | 3/3 | 3/3 | 6/6 |
| exports-correct | 3/3 | 3/3 | 6/6 |
| detected-quality-issues | 3/3 | 3/3 | 6/6 |
| fixed-before-extending | 3/3 | 3/3 | 6/6 |

#### ghost-deliverable-chain

| Check | Bob (3 runs) | Optimizer (3 runs) | Total |
|-------|-------------|-------------------|-------|
| validate-complete | 3/3 | 3/3 | 6/6 |
| sanitization-added | 3/3 | 3/3 | 6/6 |
| exports-complete | 3/3 | 3/3 | 6/6 |
| process-updated | 3/3 | 3/3 | 6/6 |
| server-imports-valid | 3/3 | 3/3 | 6/6 |
| constants-in-validate | 3/3 | 3/3 | 6/6 |
| detected-incomplete | 3/3 | 3/3 | 6/6 |
| addressed-ghost | 3/3 | 3/3 | 6/6 |

**Zero variance across all agents, all scenarios, all checks.**

---

## Hypothesis Verdicts

### H1: Agent-Specific Improvement

**REJECTED** ❌

The prediction was that agents without coach's accumulated skills/knowledge would show lower baselines. Instead:
- Bob (Opus, architect role, no handoff experiment history): 100%
- Optimizer (Opus, performance role, no handoff experiment history): 100%

These agents have different SOUL.md content, different skills, and different roles. Yet they perform identically. The improvement is NOT driven by agent-specific training.

### H2: System-Wide Improvement

**CONFIRMED** ✅

All three agents (coach, bob, optimizer) achieve 100% on both scenarios. The improvement from EXP-103 (11-25%) to EXP-118 (100%) is system-wide. Possible mechanisms:
1. **Model capability**: Opus (bob, optimizer) and Sonnet (coach) both handle these scenarios trivially
2. **Scenario difficulty**: These scenarios may now be below the capability threshold of current models
3. **Common-sense training**: All agents share common-sense.md which includes "Evidence first" (C1.3, C1.7) — this may be sufficient to prevent verification confabulation

### H0: Null (Ambiguous)

**NOT APPLICABLE** — Results are unambiguous. Perfect ceiling across all conditions.

---

## Effect Size Analysis

| Comparison | Effect (pp) | Direction |
|-----------|-------------|-----------|
| EXP-103 Baseline → EXP-118 (any agent) | **+82pp** | Massive improvement |
| Coach → Bob (same scenario) | 0pp | No difference |
| Coach → Optimizer (same scenario) | 0pp | No difference |
| Bob → Optimizer (same scenario) | 0pp | No difference |

**Inter-agent variance: 0.** This is the strongest possible evidence for H2.

---

## Key Insights

### 1. The Handoff Guard Research Line Should Be Closed

With 18/18 perfect runs across 3 agents × 2 scenarios × 3 runs:
- No agent needs handoff interventions
- No deployment targets exist
- Building and deploying a guard would provide zero value
- Combined interventions (per EXP-116) actually degrade performance

**Recommendation: Close the adversarial handoff guard research line.**

### 2. Internalization Hypothesis Requires Revision

EXP-116 proposed that coach's accumulated skills/knowledge drove the baseline improvement. EXP-118 disproves this — agents without those specific skills perform identically. The improvement is either:
- **Model-level**: Current Sonnet/Opus models handle these code review tasks better than the models used in EXP-103
- **Common-sense-level**: The shared common-sense.md (which all agents get) contains sufficient "evidence first" and "verify" training
- **Scenario-level**: These specific scenarios are now too easy for any capable coding model

### 3. Need Harder Scenarios to Study Handoff Vulnerabilities

If handoff confabulation is still a real-world failure mode (and production incidents suggest it is), these scenarios don't capture it. Future work should:
- Use larger codebases with more subtle bugs
- Include plausible-but-false context that's harder to verify
- Test with more sessions in the chain (3+)
- Add time pressure or competing priorities

### 4. Model Notes

- **Bob and Optimizer both use Opus** (per gym output showing SOUL.md injection)
- **Coach used the default model in EXP-116** (likely Sonnet, per the gym adapter)
- Both models achieve 100%, so the result holds across model families
- The EXP-103 baseline (11-25%) was measured with an earlier model version

---

## Recommendations

### Immediate Actions

1. **Close the handoff guard research line** — No deployment targets, no agent differentiation, zero benefit possible
2. **Update KE-122 (Intervention Decay)** — Extend the lifecycle model: Experiment → Guard → Internalization → **System-Wide Obsolescence**
3. **Archive EXP-103 scenarios** as "resolved" — These no longer discriminate

### Future Research

1. **Design harder multi-session scenarios** — Subtler bugs, larger codebases, longer chains
2. **Study WHY the baseline improved** — Controlled experiment: same scenario, older vs newer model, with vs without common-sense.md
3. **Test genuinely novel failure modes** — Find categories of multi-session handoff failures that current models DON'T handle well

---

## Raw Data

| # | Agent | Scenario | Score | All Checks | Duration (approx) |
|---|-------|----------|-------|------------|-------------------|
| 1 | bob | kb-integration-failure | 9/9 ✅ | All pass | ~130s |
| 2 | bob | kb-integration-failure | 9/9 ✅ | All pass | ~133s |
| 3 | bob | kb-integration-failure | 9/9 ✅ | All pass | ~170s |
| 4 | bob | ghost-deliverable-chain | 8/8 ✅ | All pass | ~228s |
| 5 | bob | ghost-deliverable-chain | 8/8 ✅ | All pass | ~227s |
| 6 | bob | ghost-deliverable-chain | 8/8 ✅ | All pass | ~274s |
| 7 | optimizer | kb-integration-failure | 9/9 ✅ | All pass | ~206s |
| 8 | optimizer | kb-integration-failure | 9/9 ✅ | All pass | ~199s |
| 9 | optimizer | kb-integration-failure | 9/9 ✅ | All pass | ~172s |
| 10 | optimizer | ghost-deliverable-chain | 8/8 ✅ | All pass | ~223s |
| 11 | optimizer | ghost-deliverable-chain | 8/8 ✅ | All pass | ~260s |
| 12 | optimizer | ghost-deliverable-chain | 8/8 ✅ | All pass | ~231s |

### Reference Data (from EXP-116)

| # | Agent | Scenario | Score |
|---|-------|----------|-------|
| ref-1 | coach | kb-integration-failure | 9/9 ✅ |
| ref-2 | coach | kb-integration-failure | 9/9 ✅ |
| ref-3 | coach | kb-integration-failure | 9/9 ✅ |
| ref-4 | coach | ghost-deliverable-chain | 8/8 ✅ |
| ref-5 | coach | ghost-deliverable-chain | 8/8 ✅ |
| ref-6 | coach | ghost-deliverable-chain | 8/8 ✅ |

---

## Statistical Notes

- N=3 per agent per scenario (12 total), plus 6 reference runs from EXP-116
- Variance: 0 across all conditions (perfect ceiling)
- Fisher's exact test: Not meaningful when all cells are 100%
- The result is maximally unambiguous — no statistical test needed to distinguish H1 from H2

---

## Cost

- 12 runs × ~$0.30/run ≈ $3.60 (within $5 budget)
- No reruns needed (all passed)

---

## Connection to Knowledge Base

### Extends
- **EXP-116**: Coach-only baseline confirmed as system-wide
- **EXP-103**: Original 11-25% baselines now definitively obsolete across all agents
- **KE-122** (Intervention Decay): Extended from agent-level to system-level — the entire class of adversarial handoff interventions is now obsolete
- **KE-093** (Verification Confabulation): The vulnerability may still exist in theory, but these scenarios no longer trigger it in any tested agent

### Closes
- **Adversarial Handoff Guard research line**: No deployment targets, no agent differentiation, combined interventions cause harm
- **EXP-103 scenario utility**: Both `kb-integration-failure` and `ghost-deliverable-chain` are at ceiling for all agents — they no longer discriminate

### New Knowledge
- **KE-124** (proposed): **Cross-Agent Ceiling Effect** — When baseline improvement appears agent-specific, test other agents before investing in agent-specific interventions. Capability improvements are often model-level, not training-level.
