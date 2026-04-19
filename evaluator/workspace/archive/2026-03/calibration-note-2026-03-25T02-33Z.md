# Calibration Note — 2026-03-25 02:33Z

## Inputs present
- `agents/evaluator/workspace/consistency-flags.jsonl`: **missing** (ENOENT)
- `agents/evaluator/workspace/human-reviews.jsonl`: **missing** (ENOENT)
- `agents/evaluator/workspace/re-evaluations.jsonl`: **missing** (ENOENT)

## Periodic task executed
- Ran: `node agents/evaluator/skills/monitor-session.cjs --running`
- Result: 3 sessions checked, 0 unhealthy. (Included evaluator, coach, tech-lead.)

## Signal quality spot-check
- Opened `.state/evaluations/eval_s_1774348459409_47_optimizer.json`.
- Noted that issues are largely evidence-linked (“visible transcript shows …”), but some concerns rely on “excerpt lacks …” phrasing.
  - Actionable reminder: when the evaluation is based on a truncated transcript excerpt, label evidence limits explicitly and avoid over-penalizing.
