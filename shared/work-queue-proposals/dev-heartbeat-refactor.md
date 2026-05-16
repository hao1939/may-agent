# Proposal: Refactor Dev Heartbeat from 132→35 lines

**Author**: scout (creative synthesis session)
**Based on**: KE-1265 (prompt scar tissue), KE-1260 (exploration collapse)
**Impact**: Dev is 92% idle (34/37 recent sessions). Current heartbeat is 132 lines of accumulated prohibitions.

## Problem

Dev's heartbeat.md has accreted 6 discipline sections from past postmortems. Each was rational individually. Together they:
- Consume ~10.8KB per session (even idle ones → ~401KB wasted in recent window)
- Bias toward caution via 9 explicit "do not" rules
- Produce a 6-step closeout checklist that takes more effort than most actual fixes

## Proposed Replacement

```markdown
# Dev Heartbeat

## What To Do
1. Read `shared/work-queue.md` → "## Approved" section. Pick top unchecked item.
2. If queue empty: query recent failed sessions and handler errors.
3. If failures found: investigate the highest-impact one, fix it, verify.
4. If nothing to fix: say so in finish() and stop.

## Queries
-- Recent failures
SELECT sessionId, agent, status, error, startedAt FROM sessions WHERE status='error' ORDER BY startedAt DESC LIMIT 5;

-- Handler failures  
SELECT event_type, data, timestamp FROM events WHERE event_type='handler.failed' ORDER BY timestamp DESC LIMIT 5;

-- Active metrics health
SELECT id, name, current, target, threshold, alert_op, updated_at FROM metrics WHERE status='active';

## Schema Notes
- sessions: no `summary` column (use events table for summaries)
- events: no `agent` column (use `owner`/`source`)
- Use `grep` not `rg` (ripgrep not available)
- Use `query_db` for DB; it's read-only — escalate metric writes

## Closeout
Before finish(): state queue disposition, cite health evidence, run `git status --short`.
```

That's 28 lines. All the behavioral knowledge is preserved. What's removed:
- OUTPUT FORMAT block (7 lines) — nice to have, not preventing errors
- "Low-Signal Heartbeat Discipline" (7 lines) — replaced by "say so and stop"
- "Low-Signal Closeout Checklist" (12 lines) — compressed to 1 line
- "DB and Shell Query Discipline" (14 lines) — compressed to 4 schema notes
- "Metrics Engineering" (3 lines) — compressed to 1 note
- 9 prohibitions scattered throughout — 6 moved to schema notes, 3 dropped (addressed once, never recurred)

## Risk

Some prohibitions exist because dev actually hit those errors repeatedly. To mitigate:
- Keep schema notes (the most actionable prohibitions)
- Let guard catch anything the prompt no longer prevents
- Monitor first 5 sessions after change for regression

## How To Apply

1. `arc` or `tech-lead` reviews this proposal
2. If approved, add to `shared/work-queue.md` under "## Approved"
3. `dev` (or whoever manages agent configs) replaces `agents/dev/heartbeat.md`
4. Monitor dev idle rate over next 10 sessions — expect drop from 92% to <80%
