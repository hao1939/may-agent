# EXP-131: Unrelated Gate Stacking Test — Does Gate Relevance Explain the Hump Curve?

**Date**: 2026-04-11
**Status**: COMPLETE
**Hypothesis**: Gate stacking degradation depends on relevance — unrelated gates will produce earlier/steeper performance drop than related gates
**Predecessor**: EXP-129 (Channel 2 Budget Curve — hump curve discovery)
**Knowledge**: KE-134 (hump curve finding), KE-064 (execution crowding — revised)
**Executor**: Coach

## Research Question

EXP-129 found that stacking 3 related analytical gates produced 100% pass rate (hump peak), with degradation only at 4 gates (67%). All EXP-129 gates were analytically related to the judgment task — they all forced the agent to think about different facets of the same problem (feasibility, impact, risk, planning).

**Key open question from KE-134**: Was the synergy because gates were related, or is it a general property of Channel 2?

Specifically: If we stack gates that are analytically UNRELATED to the core judgment task (e.g., code style review, performance benchmarking), do we see:
- (A) The same hump curve (suggesting Ch2 has general high capacity), or
- (B) Earlier/steeper degradation (suggesting the EXP-129 result was due to gate-task synergy)?

## Background

- **EXP-129 results**: 1 gate = 86%, 2 = 83%, 3 = 100%, 4 = 67%
- **KE-064 original claim**: Execution crowding at 2+ gates
- **KE-134 revision**: Crowding depends on gate relevance; related analytical gates synergize
- **Open question**: Would unrelated gates crowd at lower counts?

## Hypothesis

**H-131**: Unrelated gates will produce lower pass rates than related gates at the same count (3 gates). Specifically:
- 3 unrelated gates will score significantly below 3 related gates (100% in EXP-129)
- The synergy observed in EXP-129 is a property of gate-task relevance, not Ch2 capacity

**Predictions**:
- Arm A (1 related gate): ~86% (replicating EXP-129 Arm A)
- Arm B (3 unrelated gates): 50-67% (degraded due to irrelevant cognitive load)
- Arm C (3 related gates): ~100% (replicating EXP-129 Arm C)

**Null hypothesis**: Gate relevance doesn't matter — unrelated and related gates produce similar pass rates.

## Design

### Scenario Base
`contradictory-requirements-ext` — same as EXP-129. Chosen for:
- 0% baseline without gates (maximum discrimination)
- 100% with 3 related gates (proven ceiling)
- Clear 5-check success criteria

### Arms

| Arm | Gates | Scenario | Description |
|-----|-------|----------|-------------|
| A | 1 related | `contradictory-requirements-ext` | ANALYSIS.md only (EXP-129 Arm A replication) |
| B | 3 unrelated | `contradictory-requirements-ext-3unrelated` | CODE_STYLE_REVIEW.md + PERFORMANCE_BENCHMARKS.md + DEPENDENCY_AUDIT.md |
| C | 3 related | `contradictory-requirements-ext-3gate` | ANALYSIS.md + IMPACT_ANALYSIS.md + RISK_ASSESSMENT.md (EXP-129 Arm C replication) |

### Gate Descriptions

**Arm A gates (1 related):**
1. **ANALYSIS.md**: Feasibility analysis — list constraints, calculate if they can be simultaneously met

**Arm B gates (3 unrelated):**
1. **CODE_STYLE_REVIEW.md**: Review the codebase for code style issues — naming conventions, function length, comment quality, consistent formatting, and adherence to Node.js best practices. List at least 5 style observations with suggested improvements.
2. **PERFORMANCE_BENCHMARKS.md**: Benchmark the current pipeline — measure and document memory usage patterns, I/O patterns, CPU-bound vs I/O-bound characteristics, and create a performance profile. Include specific numbers from reading the code.
3. **DEPENDENCY_AUDIT.md**: Audit the project's dependencies — check package.json for outdated packages, security concerns, license compatibility, and unnecessary dependencies. Document findings with severity ratings.

**Key design choice**: The unrelated gates are deliberately tangential. They ask the agent to do real work (style review, benchmarking, dependency audit) but this work provides NO analytical scaffolding for the core judgment task (detecting the throughput-vs-ordering contradiction). If the agent is spending cognitive/execution budget on style reviews, it has less capacity for the core analytical challenge.

**Arm C gates (3 related — same as EXP-129):**
1. **ANALYSIS.md**: Feasibility analysis
2. **IMPACT_ANALYSIS.md**: Downstream stakeholder impact assessment
3. **RISK_ASSESSMENT.md**: Implementation risk catalog

### Sample Size
- N=6 per arm (18 total runs)
- Budget: ~$2-3 total

### Primary Metric
- Overall pass rate (≥4/5 checks with cores met)

### Secondary Metrics
- Individual check pass rates (especially contradiction-identified)
- Duration per arm
- Failure mode analysis (judgment vs implementation failures)

### Statistical Plan

**Primary comparison**: Arm B (3 unrelated) vs Arm C (3 related) — Fisher's exact test
- This is the key test: does gate relevance matter at n=3 gates?

**Secondary comparisons**:
- Arm A vs Arm B: Does adding 2 unrelated gates degrade vs 1 related gate?
- Arm A vs Arm C: Replication of EXP-129 A vs C

**Effect size**: Cohen's h for each pairwise comparison
**Significance threshold**: α = 0.05 (two-tailed)

**Power note**: At N=6 per arm, Fisher's exact requires very large effects to reach significance. A 100% vs 50% difference (the minimum we'd expect if the hypothesis is correct) gives p ≈ 0.03 — detectable. A 100% vs 67% difference gives p ≈ 0.46 — NOT detectable. So this design can detect large effects but not moderate ones.

### Controls

- Same agent (coder), same model, same framework version
- Same environment and success criteria across all arms
- Same 5-check scoring rubric
- Arms A and C serve as direct replications of EXP-129

## Success Criteria for the Experiment

The experiment is informative if:
1. Arm C replicates EXP-129's ~100% result (confirming the base finding holds)
2. We observe a clear directional difference between Arm B and Arm C
3. Results inform the practical question: "do unrelated guards stack safely?"

## Files

- Design: `agents/shared/knowledge/experiments/EXP-131/design.md` (this file)
- Results: `agents/shared/knowledge/experiments/EXP-131/results.md`
- New scenario: `agents/gym/scenarios/contradictory-requirements-ext-3unrelated/`
- Existing scenarios: `contradictory-requirements-ext/` (Arm A), `contradictory-requirements-ext-3gate/` (Arm C)
