# EXP-204: Closing the Breadcrumb Gap (Production 54% → 80%)

**Date**: 2026-04-23
**Status**: PHASE-1-COMPLETE (see results.md)
**Predecessor**: EXP-189 (G' question-framing: gym 100%, production 54%)

---

## Research Question

Why does G' question-framing achieve 100% in gym but only 54% in production? Can we close the gap?

## Background

EXP-189 deployed G' question-framing to all agent heartbeats. Gym: 100%. Production breadcrumb-action-rate: 0.54. The 46pp gap is the largest known gym→production transfer loss.

## Hypotheses

### H-204a: Attention Competition
Metric breadcrumbs get deprioritized when agents have projects/alerts/inbox competing for attention.

### H-204b: Structural Enforcement Ceiling  
Prompt-only interventions cap at ~54%. Need workflow gates. (KE: "SOUL.md text changes don't fix judgment failures — use workflow enforcement.")

### H-204c: Breadcrumb Quality
Some breadcrumbs suggest vague/unactionable steps agents can't execute.

## Phase 1: Data Analysis (no gym needed)

1. Sample 20 recent heartbeat sessions across agents
2. For each: was a red metric present? Did breadcrumb suggest action? Was action taken?
3. Categorize non-actions: competing priority, vague breadcrumb, already addressed, or ignored
4. Score breadcrumb actionability (1-5)

## Phase 2: Intervention (based on Phase 1 findings)

- If H-204a dominant: add priority weighting so metric actions compete with other tasks
- If H-204b dominant: add workflow gate blocking finish() until red metric addressed  
- If H-204c dominant: improve breadcrumb generation specificity

## Success Criteria

- [ ] Phase 1: Categorize 20 sessions, identify dominant non-action reason
- [ ] Phase 2: Deploy intervention
- [ ] Move breadcrumb-action-rate from 0.54 → 0.70+
