# Gym Leverage (Orchestrator-Worker) — Journal

## 2026-04-25 — Created
Testing orchestrator-worker workflow pattern against worker-reviewer.
Orchestrator has full tools, investigates and directs. Worker executes tasks.

## 2026-04-26 — Blocker resolved, baseline run pending
- Confirmed gym runner works with `--agent bob` — recent runs show 12-77s per scenario with real agent
- Blocker was `GYM_AGENT_BIN` not configured; now runs via `--agent` flag
- Core 20 suite ready to execute; need to run baseline in a dedicated session
- EXP-223 (agreement trap audit) completed in parallel — 85% of gym failures are genuine, not evaluator false negatives

## 2026-04-25: GYM UNBLOCKED — Live Agent Baseline Complete

**Breakthrough**: `GYM_AGENT_BIN=/usr/local/bin/may-agent` works. Live agent runs confirmed.

**Live baseline**: 7/20 (35%) — see `.state/gym-baseline-live.md`
- Strengths: Bug-fixing (100%), Integrity (100%), Convention (67%)
- Weaknesses: Verification (0%), Optimizer (0%), Reflexion (0%)
- Key finding: context-learning scenarios fail because agent ignores gym task entirely — does its habitual work instead

**Next**: Cycle 1 targeting Verification (0%). Need to diagnose why agent ignores injected task.

## 2026-08-07: Cycle 1 Blocked — Stub Mode Invalidates Baseline

**Critical finding**: All gym runs execute in stub mode (`agent_status: "skipped"`) because `GYM_AGENT_BIN` is not configured. The agent never actually runs.

**Baseline is misleading**: Scenarios that "pass" (phantom-fix, cascading-error, etc.) pass because their scorers check pre-existing file state. Scenarios that "fail" fail because their scorers check transcript/agent actions against an empty transcript.

**Implication**: The 40% baseline doesn't measure agent capability — it measures scorer design. File-state scorers pass by default; transcript-behavior scorers fail by default.

**Next step**: This project is blocked until gym gets a live agent adapter. Requesting project status change to `blocked`.
