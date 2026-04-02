# LLM-to-JS Scan — 2026-03-27T01:03

## Session Activity (last ~6h)
- 40 sessions analyzed
- Distribution: optimizer(5), may(5), qa(5), coach(5), bob(5 error), scout(2), tech-lead(1), evaluator(2)
- Bob: 100% error rate for 6+ hours (since 19:03 UTC) — model `gemini-3-pro-preview` no longer supported
- QA: 50% of sessions are 2-3 ops (idle check → exit) — already optimized by skipIfIdle
- May: 3 ops idle checks — already optimal
- Coach: Genuine LLM work (8-59 ops), no JS candidate

## NEW CANDIDATE: Agent Error Circuit Breaker (JS Handler)

**Problem**: Bob has failed 10+ consecutive sessions with identical error: `gemini-3-pro-preview` model not supported. Each failure wastes 4 ops (~$0.50) and produces no value. The system-status handler detects "stuck sessions" but NOT "repeated model errors."

**Proposed Handler**: `agent-error-circuit-breaker.ts`
- Runs on cron (every 30 min, same as system-status)
- Checks last N sessions per agent from meta.json
- If 3+ consecutive errors with same error string → mark agent as "circuit-open"
- When circuit-open: skip heartbeat (return early with a log message)
- Auto-test recovery: every 3rd heartbeat, let one through to see if model works again
- Sends P0 alert to May on first trigger
- Estimated savings: 40+ wasted ops/day when an agent's model is down (~$5/day)

**Implementation complexity**: Medium — needs access to session history (loadAllSessionMetas) and cron skip logic.

**Alternative**: Simpler approach — extend system-status.ts anomaly detection to detect consecutive agent errors and include "agent X has failed Y consecutive sessions" in anomalies. Let May's LLM decide what to do. Lower savings but much simpler.

## Previous Candidates (still blocked on restart)
- tool-quality-trend.md auto-generation (in binary f10cfde)
- periodic-task-router (not yet proposed)

## Verdict
One new candidate identified. Bob's model failure is the biggest active waste pattern. The simpler approach (extend system-status anomaly detection) is recommended as first step.
