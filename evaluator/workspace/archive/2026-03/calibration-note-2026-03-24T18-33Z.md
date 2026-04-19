# Calibration note — 2026-03-24T18:33Z

## Inputs checked
- `agents/evaluator/workspace/consistency-flags.jsonl` → ENOENT (read tool error)
- `agents/evaluator/workspace/human-reviews.jsonl` → ENOENT
- `agents/evaluator/workspace/re-evaluations.jsonl` → ENOENT
- `.state/evaluations/` present (14 files). Sample read: `.state/evaluations/task_tree_s_1774348416965_45.json`.

## Signal-quality review (what’s working / what to tweak)
- Recent evaluations are generally actionable: they include FM/FC tags and cite concrete tool evidence (e.g., in task_tree_s_1774348416965_45.json, issues reference specific tool-call failures: `read({path:"...sprint-plan.md"})→ENOENT`, schema errors `read({})`/`bash({})`, and missing C40 promise/report structure).
- However, recurring ENOENT for the three calibration inputs suggests the heartbeat is pointing at non-existent paths in this repo checkout. Consider updating heartbeat to: (a) look for these files first, else (b) fall back to `agents/evaluator/workspace/activity.jsonl` + `.state/evaluations/` sampling for calibration.

## Periodic task executed
- Ran `node agents/evaluator/skills/monitor-session.cjs --running`.
  - Result: sessionsChecked=4, healthy=4, unhealthy=0.
  - Evidence: bash output JSON timestamp 2026-03-24T18:33:43.581Z.
