# Evaluation Pipeline Revival (P0)

Owner: evaluator  
Status: active  
Created: 2026-04-29

## Goal
Revive routine scoring of agent sessions and persist evaluations to an outputs directory.

## Scope
1) Verify evaluator config + rubric artifacts exist in `agents/evaluator/`.
2) Confirm evaluation pipeline is live (DB recency + legacy artifacts).
3) Resolve workspace drift: remove broken symlinks and reintroduce local calibration inputs (consistency/human-review/re-eval) into workspace.

## Current state (2026-04-29)
- DB is being updated recently:
  - `evaluations.maxCreatedAt = 2026-04-29T18:29:17Z` (lag ~0.55h)
  - `evaluations.count = 79`, `sessions.count = 602`
- Legacy `.state/evaluations/` contains fresh per-session outputs (Apr 29) but `task_tree_*.json` artifacts appear stale (last Mar 24). This looks like *output-path drift*, not pipeline failure.
- `agents/evaluator/workspace/` currently has **broken symlinks**:
  - `consistency-flags.jsonl -> archive/2026-03/consistency-flags.jsonl` (target missing)
  - `human-reviews.jsonl -> archive/2026-03/human-reviews.jsonl` (target missing)
  - `re-evaluations.jsonl -> archive/2026-03/re-evaluations.jsonl` (target missing)

## Blockers
- None for pipeline liveness.
- Calibration artifact inputs are currently unavailable due to broken symlinks; need to regenerate or source them from canonical location (unknown).

## Proposed resolution
- Remove/replace broken symlinks with either:
  - newly generated local files, or
  - symlinks to a canonical archive path once located.

## Next steps
1) Search repo for canonical storage of the archived jsonl files.
2) If no canonical source exists, create empty placeholders (with headers/comments) and update docs so the evaluator heartbeat doesn't assume archive paths.
3) Optionally: document in criteria/ops docs that `.state/evaluations/task_tree_*.json` is legacy.
