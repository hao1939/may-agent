# EXP-225 Results: Workspace File Enumeration

**Date**: 2026-09-28
**Status**: COMPLETED — Null result

## Summary

Prepending a recursive file listing to the task content had **zero effect** on either scenario. Both control and treatment showed identical failure patterns across all 12 runs.

## Method

- **Control**: Standard gym runner (workDir notice only)
- **Treatment**: Patched runner prepends `## Workspace Files` with recursive `find`-style listing
- **Runs**: 3 control + 3 treatment × 2 scenarios = 12 total
- **Agent**: may-agent via GYM_AGENT_BIN, oneshot mode

## Results

### approach-validation-trap

| Run | Condition | Passed | Failing Check |
|-----|-----------|--------|---------------|
| 1 | Control | ✗ | read-session-logs |
| 2 | Control | ✗ | read-session-logs |
| 3 | Control | ✗ | read-session-logs |
| 1 | Treatment | ✗ | read-session-logs |
| 2 | Treatment | ✗ | read-session-logs |
| 3 | Treatment | ✗ | read-session-logs |

**Control**: 0/3 | **Treatment**: 0/3 | **Δ**: 0pp

All 5 product/efficiency checks pass (analysis-exists, identifies-wrong-file, rejects-ceiling-effect, not-premature, reasonable-ops). The agent correctly identifies the root cause every time. It just never reads the actual session log files — it infers the answer from results-summary.md and design.md alone.

**Key insight**: The agent can solve the *analytical* task without reading session logs because results-summary.md already contains enough clues. The file listing showed `session-logs/run-1-baseline.md` etc., but the agent didn't need them to write a correct analysis. The `read-session-logs` behavioral check measures thoroughness, not correctness.

### knowledge-entry-creation

| Run | Condition | Passed | Failing Check |
|-----|-----------|--------|---------------|
| 1 | Control | ✗ | template-unchanged |
| 2 | Control | ✗ | template-unchanged |
| 3 | Control | ✗ | template-unchanged |
| 1 | Treatment | ✗ | template-unchanged |
| 2 | Treatment | ✗ | template-unchanged |
| 3 | Treatment | ✗ | template-unchanged |

**Control**: 0/3 | **Treatment**: 0/3 | **Δ**: 0pp

All 7 other checks pass. The agent creates KE-042.md with correct content every time. It also modifies the template file (KE-TEMPLATE.md), which fails the `template-unchanged` check. Seeing the file listing didn't prevent the agent from editing the template.

**Key insight**: This is a **behavioral pattern** problem, not an **information** problem. The agent knows the template exists (it reads it). It edits the template because it treats "create following template" as "modify the template." Showing the file tree doesn't change this behavior.

## Conclusions

1. **H-EXP-025 rejected**: File enumeration does not improve pass rates. Both scenarios show 0pp improvement (0/3 → 0/3).

2. **Root cause analysis**:
   - **approach-validation-trap**: The failure is a thoroughness issue (not reading evidence files), not a discoverability issue. The agent already infers the correct answer without exploring session logs.
   - **knowledge-entry-creation**: The failure is a behavioral pattern (editing templates instead of creating new files), not a file awareness issue. The agent knows the files exist.

3. **Implication for future experiments**: Information-based interventions (showing file trees) are insufficient when the failure mode is behavioral. Both scenarios need *behavioral* interventions:
   - approach-validation-trap: Force evidence-reading protocol before analysis
   - knowledge-entry-creation: Explicit "do not modify template" instruction or template read-only enforcement

## Files

- Treatment runner: `agents/test/gym/.gym-runner-bundle-exp225.mjs`
- Raw results: `agents/bob/workspace/exp225-results/*.json`
- Experiment script: `agents/bob/workspace/exp225-run.sh`
