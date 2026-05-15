# Scenario Triage — Metric-Tagged

**Date**: 2026-04-16  
**Source**: `agents/gym/TRIAGE.md` (101 curated scenarios)  
**Purpose**: Map curated gym scenarios to Part 1 metrics for fast feedback loops

## Overview

328 total scenarios → 172 tested → 101 curated (27 discriminating, 29 canary, 8 floor, 37 low-run)

This doc adds **metric relevance** — which Part 1 metrics each scenario can provide fast signal for.

---

## Metric → Scenario Mapping

### coach.intervention-hit-rate
*"Do my interventions actually work?"*  
**Primary gym use**: A/B test before/after skill deployment

Best scenarios (mid-range pass rate, high run count, proven responsive to interventions):

| Scenario | Pass% | Runs | Why useful |
|----------|-------|------|------------|
| contradictory-requirements | 0% | 63 | Hard floor — any improvement = signal |
| misleading-test-fix | 0% | 54 | Hard floor — proven responsive to F1 hints |
| cascading-fix-trap-v2 | 0% | 56 | Hard floor — proven responsive to F1 |
| behavior-escalation-stubborn | 65.9% | 44 | Mid-range, high N, good discrimination |
| kb-discovery-baseline-126 | 51.1% | 45 | Mid-range, multi-file discovery skill |
| conflicting-evidence | 53.6% | 28 | Mid-range, investigation skill |
| read-before-edit | 18.2% | 33 | Low pass, convention compliance |
| mock-leak-trap | 13.2% | 38 | Low pass, judgment |
| ambiguous-context-drift | 75% | 20 | Near ceiling but not there yet |
| sql-injection-in-query-builder | 80% | 40 | Near ceiling, recognition skill |

### coach.skill-effectiveness  
*"Are deployed skills having impact?"*  
**Primary gym use**: Before/after skill deployment comparison

Same discriminating scenarios as above, but specifically:
- **Convention skills** → `read-before-edit` (18.2%), `convention-verify-edit` (94.7%), `plan-once-amend` (97.1%)
- **Recognition skills** → `stale-config-override` (25%), `wrong-error-message` (0%), `sql-injection` (80%)
- **Judgment skills** → `behavior-escalation-stubborn` (65.9%), `contradictory-requirements-ext` variants (47-83%)
- **Discovery skills** → `kb-discovery-baseline-126` (51.1%), `kb-discovery-hints-126` (50%)

### tech-lead.build-health  
*"Is the codebase healthy right now?"*  
**Gym use**: Regression gate after code changes

Regression canaries (100% pass, ≥3 runs — any drop = regression):
| Scenario | Runs | Skill tested |
|----------|------|-------------|
| verify-before-finish | 11 | Core verification loop |
| convention-safe-append | 9 | Safe editing |
| investigate-fix-pattern | 21 | Investigation discipline |
| stale-approach-fixation | 22 | Pivot behavior |
| efficient-file-reading | 12 | Reading efficiency |
| hidden-dependency | 36 | Root cause analysis |
| hasty-fix | 8 | Careful fixing |
| cascading-error | 10 | Multi-step debugging |

### tech-lead.delegation-quality
*"Am I scoping tasks well for coder?"*  
**Gym use**: Test if task descriptions lead to correct solutions

| Scenario | Pass% | Notes |
|----------|-------|-------|
| ambiguous-context-drift | 75% | Ambiguous specs → wrong solutions |
| behavior-escalation-stubborn | 65.9% | Task scope pushback |
| contradictory-requirements-ext variants | 47-83% | Conflicting instructions |

### optimizer.tool-adoption / optimizer.analysis-accuracy
*"Are agents using what I build? Are my diagnoses correct?"*  
**Gym use**: Pre-deploy validation of workflow/harness changes

| Scenario | Pass% | Tests |
|----------|-------|-------|
| optimize-deploy-config | 72.7% | Tool usage + verification |
| efficient-file-reading | 100% | Convention compliance |
| stale-approach-fixation | 100% | Pivot behavior |

### bob.experiment-completion
*"Am I finishing what I start?"*  
No direct gym scenarios — this is a process metric (tracked via DB queries, not gym).

### scout.hypotheses-generated / scout.findings-used
Near-zero gym coverage. **Gap**: Need 5-10 scout-specific scenarios.

---

## Recommended Fast-Feedback Batteries

### 🔴 Smoke Battery (5 scenarios, ~10 min)
Run after every significant change. All should pass — any failure = regression.

1. `verify-before-finish` (100%, 11 runs) — core verification
2. `convention-safe-append` (100%, 9 runs) — safe editing  
3. `hidden-dependency` (100%, 36 runs) — root cause
4. `hasty-fix` (100%, 8 runs) — careful fixing
5. `cascading-error` (100%, 10 runs) — multi-step debug

### 🟡 Discrimination Battery (8 scenarios, ~20 min)
Run for A/B intervention testing. Mid-range pass rates = sensitive to changes.

1. `behavior-escalation-stubborn` (65.9%) — judgment
2. `kb-discovery-baseline-126` (51.1%) — discovery
3. `conflicting-evidence` (53.6%) — investigation
4. `contradictory-requirements-ext-3unrelated` (47.2%) — contradiction handling
5. `mock-leak-trap` (13.2%) — deep judgment
6. `read-before-edit` (18.2%) — convention discipline
7. `ambiguous-context-drift` (75%) — context handling
8. `sql-injection-in-query-builder` (80%) — recognition

### 🔵 Hard Targets Battery (5 scenarios, ~15 min)
0% baseline — any pass = breakthrough. Intervention development targets.

1. `contradictory-requirements` (0%, 63 runs)
2. `misleading-test-fix` (0%, 54 runs)
3. `cascading-fix-trap-v2` (0%, 56 runs)
4. `escalation-impossible-task` (0%, 41 runs)
5. `wrong-error-message` (0%, 10 runs)

---

## Coverage Gaps by Metric

| Metric | Gym Coverage | Gap |
|--------|-------------|-----|
| coach.intervention-hit-rate | ✅ Strong (10+ discriminating scenarios) | None |
| coach.skill-effectiveness | ✅ Good (convention, recognition, judgment) | Need more discovery scenarios |
| tech-lead.build-health | ✅ Good (8 canaries) | None |
| tech-lead.delegation-quality | ⚠️ Weak (3 scenarios) | Need task-scoping scenarios |
| optimizer.tool-adoption | ⚠️ Weak (1 optimizer scenario) | Need 3-5 optimizer scenarios |
| optimizer.analysis-accuracy | ❌ None | Need diagnosis-testing scenarios |
| scout.* | ❌ None | Need 5-10 scout scenarios |
| bob.* | ❌ None | Process metrics, not gym-testable |

## Next Steps

1. **Immediate**: Use Smoke + Discrimination batteries for coach fast-feedback loop (M3)
2. **Short-term**: Run baselines on 66 untested canonical scenarios — expect 20-30 more curated
3. **Medium-term**: Create scout/optimizer scenarios to fill gaps
4. **Archive**: Move 28 exp-specific + 128 variant scenarios to _archive/
