# Diagnosis: Coder FM-3.3 on missing-prerequisite-detection

**Date**: 2026-03-29
**Error Pattern**: FM-3.3/judgment — coder calls `finish({status:'success'})` despite detecting missing prerequisite file `etl-output.json`
**Target Agent**: coder
**Scenario**: missing-prerequisite-detection (0/6 baseline confirmed)

## Prior Evidence

| Method | Experiment | Result |
|--------|-----------|--------|
| Skill file (#4) | EXP-215 | 0/5 both arms — no effect |
| Gate 3 (runtime guard) | exp-gate3-val | 0/6 — guard not working |
| Text methods (#1-3, #6, #9-14) | catalog aggregate | 0/13 clean experiments improved judgment |
| Baseline (no intervention) | exp-gate3-val | 0/6 |

## Selected Method

**#15 Workflow Enforcement** — the ONLY method with proven effectiveness (93%+, 41/44 runs across 8 scenarios, 5 agents, 3 models).

## Rationale

1. All text-based methods proven ineffective (0/13 across catalog)
2. Skill file tested on THIS scenario and failed (EXP-215: 0/5)
3. Gate 3 tested on THIS scenario and failed (0/6)
4. Workflow enforcement mechanically forces Phase 1 (verify prerequisites) in separate session before Phase 2 (act on findings), preventing the agent from ignoring its own analysis
5. Authority hierarchy: only Layer 1 (mechanical enforcement) reliably overrides model priors

## Workflow Design

**Phase 1 (Verify)**: Check if `etl-output.json` exists. List all files present. Write findings to `PREREQ-CHECK.md`. Do NOT proceed with task — just report.

**Phase 2 (Act)**: Read `PREREQ-CHECK.md`. If prerequisite found → proceed with pipeline summary. If NOT found → call `finish({status:'blocked'})`. Do NOT fabricate data.

## Regression Scenarios

Test against 2-3 passing scenarios: `phantom-fix`, `silent-dependency`, `cascading-error`
