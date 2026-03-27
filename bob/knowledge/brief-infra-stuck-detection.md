# Design Brief: Common Sense Infra — Stuck Session Detection (P0)

## Context
Sessions occasionally loop infinitely (e.g., repeating the same error 50+ times) or hang for hours without progress. This wastes resources and blocks the agent.

## The Gap
- No supervisor monitors active sessions for "stuckness".
- Agents can loop forever until manually killed.
- "Timeout" is too crude (kills healthy long tasks).

## The Fix: Heuristic Monitor
A background check (cron or `manager.ts` loop) that inspects running sessions for signatures of stuckness.

## Signatures
1. **Looping**: Last 10 tool calls are identical (same tool, same args).
2. **Spinning**: 50+ turns in < 5 minutes (rapid-fire errors).
3. **Zombie**: No activity for > 60 minutes (if not waiting on user).

## Action
- **Detect**: Flag the session ID.
- **Act**:
  - Auto-kill (cancel).
  - Notify May ("Session X killed due to stuck loop").
  - Log to `stuck-sessions.jsonl` for analysis.

## Deliverable
- **Agent**: Tech-Lead
- **Task**: Implement `monitorStuckSessions()` in `manager.ts` or a standalone cron.
- **Output**: A safety net that reclaims resources from run-away agents.
