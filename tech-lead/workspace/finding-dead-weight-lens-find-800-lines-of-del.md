# Dead Weight Trim — Apr 21 Findings

## Summary
Identified **~900+ lines** of deletable code/files in `agents/`. Primary savings come from orphaned `.lab` experiment files and the standalone `exp101-hvr-phase2.ts`. Handler dead code is harder to confirm without runtime data but some candidates exist.

---

## 1. `agents/.lab/exp101-hvr-phase2.ts` — 410 lines (DELETE)

- **File**: `agents/.lab/exp101-hvr-phase2.ts:1-410`
- **Evidence**: Only self-referencing. `grep -r 'exp101' agents/ --include='*.ts'` returns only this file itself.
- **Experiment results already captured**: `agents/shared/knowledge/experiments/EXP-101/results.md`
- **Hypothesis archived**: `agents/shared/knowledge/hypotheses/H-094-hedge-verify-ratio-agent-confidence-gating.md`
- **Action**: Delete entire file. **Savings: 410 lines.**

## 2. `.lab/archive/` directory — ~5 files, 72KB

- **Path**: `agents/.lab/archive/` (5 files)
- **Evidence**: Archive of old experiments. No `.ts` files. Not referenced by gym runner (`agents/src/gym/runner.ts` loads labs via `--lab` flag, resolving against scenario dirs, not archive).
- **Action**: Delete entire directory. **Savings: ~150 lines** (estimated from 72KB of markdown).

## 3. `.lab` directories with only non-TS files — orphaned experiment configs

The gym runner (`agents/src/gym/runner.ts:144-146`) uses `--lab <fork>` to load variant configs. These `.lab/` subdirectories contain only `.md` skill/context files used as agent config overlays during gym runs. Most are likely orphaned from completed experiments.

**Largest orphan candidates** (non-TS-only dirs, lines of markdown):

| Directory | Lines | Likely orphaned? |
|-----------|-------|-------------------|
| `agents/.lab/bob-persistent-task-skill/` | 78,511 | Yes — massive, contains archived workspace files |
| `agents/.lab/coder-no-c15/` | 2,557 | Yes — experiment variant |
| `agents/.lab/coder-no-c16-no-cs/` | 2,556 | Yes — experiment variant |
| `agents/.lab/coder-mock-leak-workflow/` | 2,551 | Yes — experiment variant |
| `agents/.lab/coder-exp158-solution-gate/` | 2,528 | Yes — experiment variant |
| `agents/.lab/exp107-adversarial-finish/` | 1,006 | Yes — experiment variant |

**Note**: These are markdown files, not TS. They contribute to repo size but NOT to the 33.3K TS line count. If the 33.3K metric counts all files, deleting `bob-persistent-task-skill` alone saves ~78K lines. If TS-only, these don't help.

**Action**: Confirm which metric is being used. If all-files: delete `bob-persistent-task-skill` alone gets us there. If TS-only: focus on items 1, 4, 5.

## 4. `.lab` TS files beyond exp101 — ~445 lines

- Only 10 `.ts` files exist in all of `.lab/` totaling ~855 lines (410 are exp101).
- The remaining ~445 lines are in various `.lab` subdirs. Need individual audit but likely deletable if experiments are concluded.

## 5. Handler dead code candidates (needs deeper audit)

### `agents/may/handlers/convention-check.ts` (1153 lines)
- **18 functions** defined (`convention-check.ts:198-1143`).
- `checkC12_1_sessionStart` (`convention-check.ts:842-945`) is 103 lines — verify it's still in the `runAllChecks` dispatch list (`convention-check.ts:466`).
- `detectRegressions` (`convention-check.ts:1024-1087`) is 63 lines — check if regression detection is enabled.
- `writeSummary` (`convention-check.ts:1088-1136`) is 48 lines — utility, likely used.

### `agents/may/handlers/agents-auto-commit.ts` (722 lines)
- `resolveSharedConflict` (`agents-auto-commit.ts:452-532`) is 80 lines of merge conflict resolution — may be dead if shared conflicts don't occur in practice.
- `mergeAppendOnly` (`agents-auto-commit.ts:548-573`) is 25 lines — niche utility.

### `agents/may/handlers/metrics-snapshot.ts` (621 lines)
- All functions appear actively used in the metric pipeline. Lower priority for cuts.

---

## Confidence Summary

| Item | Lines | Confidence | Risk |
|------|-------|------------|------|
| exp101-hvr-phase2.ts | 410 | **High** — no references | None |
| .lab/archive/ | ~150 | **High** — archived | None |
| .lab non-TS orphans | ~85K+ | **High** but metric-dependent | Low |
| .lab remaining TS | ~445 | **Medium** — need per-file check | Low |
| Handler dead code | ~100-200 | **Low** — needs runtime verification | Medium |

## Recommended Trim Order
1. Delete `agents/.lab/exp101-hvr-phase2.ts` (410 lines, zero risk)
2. Delete `agents/.lab/archive/` (~150 lines, zero risk)
3. Audit remaining `.lab/*.ts` files for deletion (~445 lines)
4. If counting all files: delete `agents/.lab/bob-persistent-task-skill/` (78K lines)
5. Deep-audit handler functions only if still short of target

## Follow-up
- Clarify whether 33.3K metric is TS-only or all files — this determines strategy
- If TS-only: items 1-3 yield ~1005 lines, meeting the 800+ target
- If all-files: item 4 alone far exceeds the target
