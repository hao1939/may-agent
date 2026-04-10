# EXP-119: Re-Run Adversarial Handoff Treatments with Valid Agent Names

**Date**: 2026-04-10
**Author**: Coach
**Status**: IN PROGRESS
**Depends on**: EXP-116 (design), EXP-118 (valid baselines)

---

## 1. Motivation

EXP-116 Phase 2 ran 36 gym trials testing adversarial handoff interventions across 5 arms. **All 36 trials used `--agent coder`, which is not a valid agent name** — the binary exited silently and scores were artifacts. EXP-118 then established valid baselines with real agents: 11% (kb-integration-failure) and 25% (ghost-deliverable-chain), zero variance across bob/optimizer/may.

EXP-119 re-runs the **treatment arms only** (A through D plus clean-handoff controls) using `--agent bob`, with EXP-118's baselines as the comparison point.

## 2. Design

Identical to EXP-116 §4 except:
- **Baselines**: From EXP-118 (11% kb, 25% ghost) — not re-run
- **Agent**: `--agent bob` for all runs (never `coder`)
- **Arms run**: A (adversarial), B (machine-verified), C (combined), D (combined+guard), plus clean-handoff controls

### Trial Matrix (30 runs)

| Scenario | Arm A | Arm B | Arm C | Arm D | Total |
|----------|-------|-------|-------|-------|-------|
| kb-integration-failure | 3 | 3 | 3 | 3 | 12 |
| ghost-deliverable-chain | 3 | 3 | 3 | 3 | 12 |
| clean-handoff (baseline) | — | — | 3 | — | 3 |
| clean-handoff-combined | — | — | 3 | — | 3 |
| **Total** | 6 | 6 | 9 | 6 | **30** |

### Hypotheses (from EXP-116 §4.4)

- **H1**: Arm C or D ≥80% on kb + ghost → proceed to production build
- **H2**: Arm C ≤20% slower on clean-handoff; no regressions
- **H3**: Arm A within 10pp of baseline (expected null, replicating EXP-108)
- **H4**: Arm C > Arm B by ≥15pp (synergy test)

## 3. Cost Estimate

30 runs × ~$0.30/run = ~$9.00

## 4. Reference

Full intervention descriptions, component specs, and scenario details: see EXP-116/design.md §3 and §4.
