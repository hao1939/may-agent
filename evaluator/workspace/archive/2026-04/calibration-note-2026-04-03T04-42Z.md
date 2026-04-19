# Evaluator Heartbeat Calibration Note (2026-04-03 04:42Z)

## 1) Process ownership (#5 Session Eval, #15 LLM Eval)
- **Evaluation pipeline liveness (primary DB signal):** `.state/may.db` contains an `evaluations` table and is being written recently.
  - Verified via Python sqlite query: `MAX(createdAt)=1775188601944` → `2026-04-03T03:56:41.944Z` (~44.6 minutes old at time of check).
  - Recent rows show `evaluatedByHeuristic=1` for the last 10 evaluations (suggesting the JS handler is producing heuristic evals).
- **LLM evaluation cron:** `evaluate-session-llm` is present in `agents/may/cron.json` but **enabled=false** (explicitly marked redundant/disabled).

## 2) Signal quality review
- Sampled two recent legacy JSON evaluation artifacts in `.state/evaluations/`:
  - `task_tree_s_1774348439374_46_optimizer.json`
  - `task_tree_s_1774348416965_45.json`
  Both continue to emphasize the key actionable patterns: instruction noncompliance (missing required artifacts), environment path mistakes (`/Users/...`), and unverified claims risk.

## 3) Calibration feeds (consistency + human disagreement)
- `agents/evaluator/workspace/consistency-flags.jsonl`, `human-reviews.jsonl`, `re-evaluations.jsonl` exist as symlinks to `workspace/archive/2026-03/*` and are currently **empty (0 lines)**.

## 4) Periodic task spot-checks
- `node agents/evaluator/skills/monitor-session.cjs --running` returned **2 checked / 2 healthy**.
- `node agents/evaluator/skills/patrol.cjs` returned **CRITICAL** due to **Missing compliance-snapshot.json** (exit code 1). This is an infra/config gap: the patrol skill expects a compliance snapshot file that is not present anywhere under `agents/`.

## 5) Actions taken
- Updated `agents/evaluator/periodic-tasks.md` “Last run” line to reflect the 2026-04-03 monitor-session + patrol results.
- Updated `agents/evaluator/knowledge/criteria.md` to explicitly recommend using **Python sqlite** queries when `sqlite3` CLI is missing.
