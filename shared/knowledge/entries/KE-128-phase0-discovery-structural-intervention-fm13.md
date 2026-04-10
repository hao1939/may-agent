# KE-128: Phase 0 Discovery — Structural Intervention for FM-1.3 (Exhaustive Reading) — NULL RESULT

**Date**: 2026-04-10 (v1), **Corrected**: 2026-04-10 (v2 post-runner-fix)
**Source**: EXP-124 (Structural Intervention for FM-1.3, N=6+6 v2)
**Confidence**: ★★ (Low — **null result after runner fix; v1 findings invalidated**)
**Connections**: KE-007 (structural enforcement only), KE-034 (forced externalization), KE-006 (skills don't fix tool patterns), KE-126 (soft interventions fail), H-095 (agent-specific interventions), H-085 (forced externalization boundaries)

---

## ⚠️ CORRECTION NOTICE

**This entry was originally written based on EXP-124 v1 results which showed 0% baseline → 100% treatment (+100pp). The v1 results were invalidated by a critical gym runner bug**: `syncNewFilesFromRoot` only synced NEW files, not modified files in existing directories. The agent's output (synthesis.md) was being produced but not captured for scoring, causing ~67-75% false negatives in BOTH arms.

**EXP-124 v2** (post-fix, N=6+6) shows: **83% baseline vs 83% treatment, p=1.0. No treatment effect detected.**

---

## Core Finding (CORRECTED)

**The Phase 0 directory-discovery step that produces a navigation map (`nav-map.md`) before the main task shows NO measurable improvement over baseline on the knowledge-base-navigation scenario.**

| Metric | Baseline (v2) | Treatment (v2) | Δ |
|--------|---------------|----------------|---|
| Pass rate | 5/6 (83%) | 5/6 (83%) | 0pp |
| Product score (avg) | 4.17/5 | 4.50/5 | +0.33 (NS) |
| Completion rate | 5/6 (83%) | 6/6 (100%) | +17pp (NS) |
| Mean duration (completed) | 150.9s | 126.9s | -24s (NS) |

## Why v1 Results Were Wrong

The v1 results showed apparent +100pp because:
1. The gym runner's `syncNewFilesFromRoot` only synced NEW files, not modified files in existing directories
2. Both baseline and treatment agents were actually producing synthesis.md, but in the baseline arm the file wasn't being captured for scoring
3. The `deepSnapshotDir` fix (capturing file mtimes before/after agent runs) resolved this
4. Post-fix, BOTH conditions achieve 83% — the original "failure" was measurement error, not agent failure

## What This Means for FM-1.3 Research

1. **Bob is already succeeding 83% of the time on this scenario** — the scenario may not strongly trigger FM-1.3
2. **The discovery intervention is not needed for this task** — Bob's existing skills and navigation behavior are sufficient
3. **A harder scenario is needed** to test FM-1.3 interventions — deeper nesting, more ambiguous paths, stricter tool-call budgets

## Remaining Observations

- Treatment may be slightly faster (117.3s vs 150.9s for completed trials) — but not statistically significant with N=6
- Treatment had 0 agent errors vs 1 baseline error (B6 timeout) — but N too small to conclude
- Convention scores were uninformative (all trials get 3/5 due to transcript capture limitations)

## Predictions (REVISED)

- **P-128a (WITHDRAWN)**: Cannot predict FM-1.3 reduction from a null-result intervention
- **P-128b**: Phase 0 overhead appears minimal (~2 min), but no demonstrated benefit to justify deployment
- **P-128c**: Untestable — intervention doesn't work on Bob, so specificity prediction is moot

## Implications for H-085 and H-095

- **H-085**: EXP-124 can NO LONGER be cited as evidence that structural forced externalization works on discovery tasks. The "text fails but structural succeeds" narrative was based on v1 results that were artifacts of the runner bug. The 5th boundary condition ("text-only instructions on discovery tasks") stands, but the claimed resolution via structural enforcement is unvalidated.
- **H-095**: EXP-124 can NO LONGER be counted as the "third validated agent-specific structural guard." The evidence chain for agent-specific interventions loses this data point.

## Limitations

- N=6+6 — low statistical power (can only detect effects ≥50pp)
- Scenario may have ceiling effects (83% baseline)
- Transcript capture still broken — can't measure actual navigation behavior
- Only tested on knowledge-base-navigation scenario — doesn't rule out benefit on harder scenarios

---
*Originally written as "Validated Structural Intervention" based on EXP-124 v1. Corrected to "Null Result" after EXP-124 v2 (post-runner-fix) showed 83% vs 83% (p=1.0). The v1 results were dominated by a gym runner file-sync bug, not by any treatment effect. Corrected by Bob, 2026-04-10.*
