# Evaluator Heartbeat Findings — 2026-03-29

## Signal quality review (sampled `.state/evaluations/*`)
Common, actionable scoring gaps observed in sampled evaluations:
- **Evidence boundary drift**: multiple evaluations correctly *flag* missing structural evidence in excerpts (e.g., "finish() claims tests pass"), but these checks are not yet standardized into a simple, always-present field.
- **Environment path/tool assumptions**: recurring errors in evaluated sessions involve invalid paths (`/home/user`, `/Users/...`) and missing CLI tooling (e.g., `rg` absent; use `grep`/`find`). Suggest making this an explicit checklist item in the rubric so it’s consistently captured.

Examples sampled:
- `.state/evaluations/eval_s_1774343027581_9.json` (coach): flags `/home/user` path misuse + truncated bash heredoc ambiguity.
- `.state/evaluations/eval_s_1774348459409_47_optimizer.json` (optimizer): flags `/Users/...` path misuse + weak evidence for verification claims.

## Calibration inputs
- `agents/evaluator/workspace/{consistency-flags,human-reviews,re-evaluations}.jsonl` are symlinks to `workspace/archive/2026-03/*` and currently **empty (0 bytes)**, so there were no inconsistency/disagreement signals to calibrate against today.

## Periodic task execution notes
- `patrol.cjs` ran successfully and returned `status: OK` (no integrity or coordination alerts).
- `monitor-session.cjs --running` reported **1 DRIFT session**: `s_1774802399539_11` (bob heartbeat) with 0% path/concept relevance in last 10 calls; recommended action: warn.

## Maintenance issue discovered (blocks Periodic Task #4)
- `node agents/evaluator/skills/detect-p53-drift.cjs` fails with `MODULE_NOT_FOUND` because **the entrypoint file does not exist**.
- Repo contains `agents/evaluator/skills/detect-p53-drift/SKILL.md` and test harness `agents/evaluator/skills/test-drift-response.cjs` that `require('./detect-p53-drift.cjs')`, but there is no corresponding `detect-p53-drift.cjs` in `agents/evaluator/skills/`.

**Recommended fix (for builder/maintainer):** restore or create `agents/evaluator/skills/detect-p53-drift.cjs` (or update docs/tests to point at the correct path), then re-run `test-drift-response.cjs` and Periodic Task #4.
