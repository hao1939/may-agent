# Lens A — Evaluator Subsystem Cohesion

**Session:** s_1776479545256_794 · 2026-04-18
**Scope:** evaluator core files + 4 review branches (analysis only, no code changes)

## 1. Subsystem Map

| Artifact | Location | 1-line role |
|---|---|---|
| Core library | `src/lib/evaluator.ts` (954 lines, top of file verified; symbol index at `evaluator.ts:69,449,797`) | Pure functions: `extractUsage`, `evaluateTask` (child-session tree), `evaluateStandaloneSession` (single session via LLM) |
| Handler A | `agents/may/handlers/evaluator-heartbeat.ts` (313 lines) | Cron handler: (1) samples ≤3 heuristic-only top-level sessions per run and upgrades them to LLM eval (`evaluator-heartbeat.ts:181` `sampleAndEvaluateTopLevel`), (2) runs evaluator-agent calibration spawns |
| Handler B | `agents/may/handlers/evaluation-sync.ts` (**not on main**, only in `review/sync-gate-skip-evaluator`, 439 lines) | Cron handler: independent heuristic evaluator writing directly to `may.db` via its own `bun:sqlite` connection; **also** samples ~30% (≤5/run) for LLM upgrade (`evaluation-sync.ts:409`) |
| Dispatch point | `src/app/may.ts:417-451` | Auto-eval on child-session finish via `evaluateTask()` — requires `parentSessionId`, skips evaluator children (`may.ts:425`) |

### Review branches

| Branch | Commits ahead of main | Core payload |
|---|---|---|
| `review/evaluator-standalone-retry` | 1 commit `d503f2fd` | `src/lib/evaluator.ts` +37/-5: retry + parse-error verdict in `evaluateStandaloneSession` |
| `review/evaluator-source-tag` | 4 commits (includes standalone-retry as base) | Adds `{source:"standalone-eval"}` to 2 `manager.run("evaluator", …)` calls (`evaluator.ts:859,869` on that branch); also drags in optimizer workspace, coder last-session, create-tool test fixes, KE-212/213/214 wiring — **9 files unrelated to evaluator logic** |
| `review/evaluator-quality` | **does not exist** (listed in brief; `git rev-parse` fatal) | — |
| `review/sync-gate-skip-evaluator` | 3 commits, 952 lines | Introduces the whole `evaluation-sync.ts` (439 lines, new file), plus unrelated `src/lib/citations.ts` (267 lines) + `test/citations.test.ts` (187 lines) + cron/agent-loader wiring |

## 2. Overlap Findings

**F1 — Duplicate constant in two handlers.** Both handlers declare an identical skip-set:
- `evaluator-heartbeat.ts:39` → `const SKIP_LLM_EVAL_AGENTS = new Set(["evaluator", "may"]);`
- `evaluation-sync.ts:44` (branch `review/sync-gate-skip-evaluator`) → `const SKIP_LLM_EVAL_AGENTS = new Set(["evaluator", "may"]);`
Comment at `evaluation-sync.ts:42-43` explicitly says "Keep in sync with evaluator-heartbeat.ts" — i.e., the code documents its own fragmentation.

**F2 — Two parallel LLM-upgrade sampling pipelines.** The same operation (pick heuristic-evaluated sessions and re-run through `evaluateStandaloneSession`) is implemented twice with different policies:
- `evaluator-heartbeat.ts:181` — lowest-LLM-rate agent first, `MAX_LLM_EVALS_PER_RUN=3` (`evaluator-heartbeat.ts:33`), filters via SQL `WHERE e.agent NOT IN ('evaluator','may')` (`evaluator-heartbeat.ts:196`).
- `evaluation-sync.ts:391-432` (branch) — random 30% sample, `MAX_LLM_PER_RUN=5`, filters in JS via `SKIP_LLM_EVAL_AGENTS.has(s.agent)` (`evaluation-sync.ts:395`).
If both cron handlers land and run, effective LLM-eval budget is **3+5=8/run** not 3 or 5, and agent-priority selection fights random selection.

**F3 — `evaluation-sync.ts` duplicates `evaluator.ts` scoring vocabulary.** The file header (`evaluation-sync.ts:18-33`) re-specifies verdict thresholds (good/acceptable/needs_improvement at 0.7/0.4) that already live in `src/lib/evaluator.ts` (`parseTaskEvaluation` at `evaluator.ts:240`). Two sources of truth for the same enum — if DOMAIN.md changes, both must update.

**F4 — Branches bundle unrelated work.** `review/sync-gate-skip-evaluator` mixes (a) introducing the evaluation-sync handler, (b) the one-line `NOT IN ('evaluator','may')` fix (`66dfdebb`), and (c) an entirely unrelated bidirectional-citations feature (`2854dedf`, +509 lines across `src/lib/citations.ts` + tests + cron.ts). `review/evaluator-source-tag` similarly mixes a 2-line source-tag change with 7 workspace/knowledge files and an unrelated test fix (`33150a57` create-tool notify-split). Neither branch is reviewable as-is.

## 3. Consolidation Recommendation

**These are 1 subsystem fragmented into 2+ handlers, not 3 overlapping ones.** Concrete actions (each a separate session):

1. **Decide one home for LLM-upgrade sampling.** `evaluator-heartbeat.ts:181` (priority-based) is the better policy; `evaluation-sync.ts:391-432` (random 30%) should be deleted when that branch lands. Pick one; don't ship both.
2. **Extract the skip-set and verdict thresholds to `src/lib/evaluator.ts`** as exported constants so F1 and F3 collapse to imports. Single edit, ~10 lines.
3. **Split `review/sync-gate-skip-evaluator`** into three branches before review: (a) `evaluation-sync.ts` introduction, (b) citations feature, (c) the 1-line skip-evaluator fix. The one-line fix can probably just be cherry-picked to main today.
4. **Split `review/evaluator-source-tag`**: the `{source:"standalone-eval"}` tag (2 lines at `evaluator.ts:859,869` on-branch) is trivially mergeable; the knowledge/workspace noise should go to its own branch.
5. **`review/evaluator-standalone-retry`** is clean (1 file, 42 lines) — merge as-is once F1–F3 are resolved or independently.
6. `review/evaluator-quality` is listed in the brief but the branch does not exist locally or in `git branch -a | grep review/` — prompt source is stale. No action.

## 4. Verification

- File line counts: `wc -l` → `evaluator-heartbeat.ts=313`, `evaluator.ts=954`, `may.ts=1247`. `evaluation-sync.ts` absent from main (`find agents/may -name 'evaluation-sync*'` returned nothing); present on `review/sync-gate-skip-evaluator` via `git show`, line count 439.
- Branch diff stats via `git diff main...<branch> --stat`: numbers quoted verbatim in §1 table.
- Symbol locations in `src/lib/evaluator.ts` via `grep -nE "^export|^function"`: `extractUsage:69`, `evaluateTask:449`, `evaluateStandaloneSession:797`.
- Duplicate `SKIP_LLM_EVAL_AGENTS`: grep on both files returned identical `new Set(["evaluator", "may"])` literals at `evaluator-heartbeat.ts:39` and `evaluation-sync.ts:44`.
- `may.ts` evaluator dispatch points located via `grep -nE "evaluator|evaluat"` → lines 9, 417, 425, 429, 559.
- `review/evaluator-quality` non-existence: `git log main..review/evaluator-quality` returned `fatal: ambiguous argument … unknown revision`.

## 5. Follow-ups (do NOT execute in this session)

- FU-1: Cherry-pick `66dfdebb` (skip-evaluator 1-liner) to main once `evaluation-sync.ts` is committed, or merge it into the file in one shot.
- FU-2: Extract shared evaluator constants (skip-set, verdict thresholds) into `src/lib/evaluator.ts` exports.
- FU-3: Before merging `review/sync-gate-skip-evaluator`, decide fate of duplicate LLM-sampling loop (F2) — delete one.
- FU-4: Ask human/Bob to split the two omnibus branches, or do it mechanically via `git rebase -i`.
