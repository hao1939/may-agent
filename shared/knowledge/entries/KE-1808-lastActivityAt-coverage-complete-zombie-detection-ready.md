<ai_context>
sessions.lastActivityAt column has reached 100% coverage in the 6h window across all 7 agents as of 2026-06-11. The precondition for pure-SQL zombie detection is now met for windows ≤6h. The design doc sessions.md was updated from stale ~33.5% figures.
Triggers: lastActivityAt, zombie detection, sessions.md, coverage, design doc update
</ai_context>

# KE-1808: `lastActivityAt` Coverage Complete — Pure-SQL Zombie Detection Ready

**Status**: verified
**Discovered**: 2026-06-11
**Agent**: arc (heartbeat coherence audit)
**Scope**: design doc accuracy, system capability
**Related**: KE-1558 (error column race), sessions.md design doc

## Claim

The `sessions.lastActivityAt` column has silently reached **100% coverage**
for all new sessions, but the `sessions.md` design doc still claimed ~33.5%
24h coverage and "well below the ~80% threshold needed for pure-SQL zombie
detection." The doc was stale by ~36h.

## Evidence

### Measured 2026-06-11 00:12 UTC

| Window | Total | Populated | Coverage |
|--------|-------|-----------|----------|
| 6h     | 292   | 292       | **100%** |
| 12h    | 555   | 386       | 69.5%    |
| 24h    | 994   | 386       | 38.8%    |

### Per-agent (6h window)

| Agent | Sessions | Populated | Coverage |
|-------|----------|-----------|----------|
| aks-explorer | 73 | 73 | 100% |
| arc | 12 | 12 | 100% |
| dev | 12 | 12 | 100% |
| evaluator | 157 | 157 | 100% |
| may | 19 | 19 | 100% |
| scout | 14 | 14 | 100% |
| tech-lead | 5 | 5 | 100% |

The 24h figure (38.8%) is an artifact of older sessions from before full
activation rolling through the window. Any query window starting after
~2026-06-10 18:00Z sees 100% coverage.

## Consequence

1. **Zombie detection can now use pure SQL** for windows ≤6h:
   ```sql
   SELECT sessionId, agent, lastActivityAt
   FROM sessions
   WHERE status = 'running'
     AND lastActivityAt < strftime('%s','now')*1000 - 1800000
   ```
   This eliminates the disk `statSync` dependency in `metrics-snapshot.ts`.

2. **sessions.md updated**: Corrected the stale coverage numbers and marked
   the precondition as met. The doc now correctly states the column is
   functionally complete for new sessions.

3. **Implementation note**: Switching `capability.zombie-session-count` from
   `statSync` to the SQL query is a `src/` change requiring Hao approval
   (ORDER-010). Filed as actionable next step.

## Doc update

Updated `shared/may-agent-docs/2a-design/sessions.md` §`lastActivityAt`
to reflect current coverage data and mark the SQL-zombie-detection
precondition as met.
