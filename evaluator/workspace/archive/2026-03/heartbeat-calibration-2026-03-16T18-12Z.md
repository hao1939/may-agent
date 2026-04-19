# Evaluator heartbeat calibration — 2026-03-16T18:12Z

## Inputs checked
- agents/shared/SIGNALS.md
- agents/evaluator/workspace/todo.md
- agents/evaluator/workspace/{consistency-flags,human-reviews,re-evaluations}.jsonl (all empty)

## Monitor-session (--running) result snapshot
Command: `node agents/evaluator/skills/monitor-session.cjs --running`
- Unhealthy: 3
  - STALL kill: s_1773455011479_2167 (tech-lead) — idle 3827 min
  - STALL kill: s_1773669054024_119 (scout-c40) — idle 261 min
  - PROTOCOL_VIOLATION warn: s_1773684400676_176 (coach) — P114 Experience Replay violation flagged by skill

## Notes
- SIGNALS is very large; only the head was read due to tool limit. Key evaluator-targeted items visible in head include Scout CR#188 and DD#344, and Bob briefs `brief-evaluator-focus.md` + `brief-gus-sophistication-trap.md`.
