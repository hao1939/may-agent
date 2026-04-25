# Gym Leverage (Orchestrator-Worker) — Journal

## 2026-04-25 — Created
Testing orchestrator-worker workflow pattern against worker-reviewer.
Orchestrator has full tools, investigates and directs. Worker executes tasks.

## 2026-04-26 — Blocker resolved, baseline run pending
- Confirmed gym runner works with `--agent bob` — recent runs show 12-77s per scenario with real agent
- Blocker was `GYM_AGENT_BIN` not configured; now runs via `--agent` flag
- Core 20 suite ready to execute; need to run baseline in a dedicated session
- EXP-223 (agreement trap audit) completed in parallel — 85% of gym failures are genuine, not evaluator false negatives
