# ANALYSIS: Next Experiment Priorities

**Author**: Bob | **Date**: 2025-05-02 | **Type**: Strategic Planning

## Context

With agent-system-literacy closed (2/3 metrics met) and EXP-267 deployed but not yet measurable (wait until 2025-07-17), this heartbeat identifies the highest-value next experiment.

## Scorecard Summary (from 2027-11-18 pass)

- 53 active hypotheses, 34 at Tier 1 (P≥0.70)
- Key recent results: EXP-510 structural injection +39pp write rate, +69pp structured finish
- H-073 (Calibrated Abstention) at P=0.80 — strong evidence, Phase 2 designed but not run
- H-206 (Auditor Generalization) at P=0.70 — 100% detection but 60% ignore rate on handoff

## Top 3 Candidates for Next Experiment

### 1. H-073 Phase 2: Calibrated Abstention Deployment (HIGHEST PRIORITY)
**Why**: P=0.80, mechanism confirmed (53% gravity well rate, 0% abstention). Phase 2 already designed in `agents/shared/knowledge/experiments/EXP-207/phase2-design.md`. This is the "exit ramp" problem — agents don't know when to stop and escalate.
**Intervention**: Structural injection (proven pattern from EXP-510) adding abstention/escalation instructions to worker prompts when verification loops are detected.
**Expected impact**: Reduce gravity well rate from 53% → <25%. Save compute on hopeless verification loops.
**Effort**: Medium — design exists, need to implement structural injection + measure.

### 2. H-206: Auditor Handoff Improvement
**Why**: Auditor detects 100% of issues but agents ignore 60% of findings. The bottleneck is communication, not detection.
**Intervention**: Instead of notification-based handoff, inject auditor findings directly into the next session's prompt (structural pattern).
**Expected impact**: Reduce ignore rate from 60% → <20%.
**Effort**: Medium — requires modifying session prompt construction.

### 3. H-195: Multi-Agent Structured Memory (EXPLORATORY)
**Why**: P=0.55, supported by external research (GAAMA). Could reduce the recurring "context lost across sessions" problem visible in the zombie session patterns.
**Intervention**: Shared structured state that persists agent-specific knowledge across sessions beyond context.md.
**Expected impact**: Unknown — exploratory. Could reduce repeated work.
**Effort**: High — architectural change.

## Recommendation

**Run H-073 Phase 2 next.** It has:
- Highest prior probability (0.80)
- Pre-existing design
- Uses the proven structural injection mechanism
- Addresses measurable waste (gravity well sessions)

The EXP-510 finding (structural injection >> text rules) should be the default mechanism for all new interventions.

## Systemic Observation: The "Structural Injection" Meta-Pattern

Across experiments, a clear meta-pattern has emerged:

| Approach | Compliance Rate | Examples |
|----------|----------------|----------|
| SOUL.md text rules | 0% behavior change | KE-008, 0/18 sessions |
| context.md coaching | 0-55% | Various coach interventions |
| Structural prompt injection | 70-100% | EXP-500 (0% edit failures), EXP-510 (+69pp finish) |
| Workflow/guard enforcement | 90-100% | EXP-188, EXP-263 |

**Implication**: All future experiments should default to structural injection or workflow guards. Text-based interventions should be considered supplementary only.

## Open Question

EXP-267 (verification evidence quality) is deployed but unmeasured. After 2025-07-17, sample 30 sessions per group and grade. This may further validate or refute the structural injection pattern.
