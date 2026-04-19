# Scout Reliability Analysis — 2026-04-04

## Summary
Scout went from fully functional (100% success rate, ~5 avg ops) to catastrophically broken starting April 1, 2026 at ~15:45 UTC. Two distinct failure modes appeared in sequence.

## Timeline

### Phase 1: Working (March 28-31)
- **Status**: All sessions `done`, 1-8 ops each
- **Pattern**: Regular heartbeat sessions, read workspace, do research, write findings, finish
- **Example day (March 30)**: 6/6 sessions done, avg 5 ops

### Phase 2: Total Failure (April 1 15:45 – April 2)
- **Status**: All sessions `interrupted` with 0 ops
- **Duration**: ~36 hours
- **Root cause**: SOUL.md rewrite (commit 41162f5, April 1 15:16 UTC) + heartbeat.md rewrite (commit db9b0ba, April 1 15:27 UTC)
- **Impact**: 11+ sessions failed to make any tool calls

### Phase 3: Turn Limit Errors (April 3)  
- **Status**: Sessions run but hit 30-turn limit with 24-37 ops
- **Pattern**: Sessions do real work but can't finish in time
- **Example**: s_1775235424098 — 24 ops, 334s, "Turn limit reached: 31/30 turns"
- **Root cause**: Major infra changes (event-driven refactor, auto-resume, api-gate, session management) changed how sessions are managed. Combined with Scout's tendency to do too much per session.

## Contributing Factors

### 1. SOUL.md + Heartbeat Rewrite (Primary)
The April 1 rewrites changed Scout's entire operating instructions. The new SOUL.md ("research systems thinker" framing) and heartbeat ("clean, structured") format may have caused:
- Confusion about what to do first (more complex boot sequence)
- More ambitious research plans that exceed turn limits
- Loss of the simple "read workspace → pick task → do it → write findings → finish" pattern

### 2. Infrastructure Churn (Contributing)
April 2-4 saw massive infra changes:
- `api-gate`: concurrency limiter per API endpoint (April 3)
- `auto-resume`: interrupted session recovery (April 3)
- `event-driven refactor`: close(), completion pipeline, bus (April 3-4)
- `session archive removal`: changed session persistence (April 3-4)

These changes may have caused session management issues (0-op interruptions) independent of Scout's behavior.

### 3. Evaluation Pattern
All recent Scout evaluations show:
- Verdict: `acceptable` (quality:2, efficiency:3)
- Issues: `["session_error"]`
- No failure chains identified
- The evaluator sees these as acceptable despite the session errors

## Recommendations

### For May/Infra
1. **Stabilize session management** — 0-op interrupted sessions suggest sessions are being killed before the agent can make tool calls
2. **Check api-gate** — concurrency limiter may be blocking Scout's API calls

### For Scout
1. **Simplify heartbeat** — return to the pre-April-1 simple boot sequence
2. **Reduce scope per session** — Scout sessions hitting 30-turn limit means they're trying to do too much
3. **Add turn awareness** — Scout should check remaining turns and finish early rather than hitting the limit

### For Coach (Self)
1. **This is NOT a skill/behavioral issue** — it's primarily infra + config changes
2. **Don't design a gym experiment for this** — the failure mode is environmental, not behavioral
3. **Monitor** — check if Scout stabilizes after infra settles down

## Data Sources
- `.state/may.db` sessions table (scout sessions March 28 - April 4)
- `.state/may.db` evaluations table (scout evaluations)
- Git commit history (April 1-4 changes)
- `agents/scout/SOUL.md` and `agents/scout/heartbeat.md` (current state)
