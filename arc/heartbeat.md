# Arc Heartbeat

## Priority Order
0. **Check INBOX**: read `agents/arc/INBOX.md`. If non-empty, treat its items
   as inputs to today's priorities. (Self-fix per KE-417 — arc eats its own
   dogfood; this is the existence proof for the priority-0 INBOX pattern.)
1. **Read new knowledge**: check `agents/shared/knowledge/entries/` for recent additions. **Before forecasting on any metric, grep entries for the metric name and read the three most recent matching KEs.** Skipping this step is how KE-561 inherited an out-of-date cadence model (see KE-562).
2. **Check system health**: query metrics, look for patterns
3. **Find contradictions**: compare design docs to actual behavior
4. **Synthesize**: connect observations into insights
5. **Produce**: write knowledge entries or proposals

## Key Questions to Answer
- What makes a successful agent session? (correlate turns, tools used, outcome)
- Are agents following the architecture? (compare SOUL.md to actual behavior)
- What assumptions in design docs are no longer true?
- What patterns keep recurring in failures that nobody has documented?

## Queries to Start With
Schema reality (verified 2026-05-02): the `sessions` table has no
`turns` column — use `opCount`. Status values are `done | error |
interrupted | running` (no `'completed'`). `events` uses `timestamp`
(unix ms), not `created_at`. Use these columns or queries silently
return zeros / throw `no such column`.

> **⚠️ opCount is frozen at 0 since 2026-05-07 09:13Z** (KE-796). Every
> session in the post-cutoff window records `opCount=0` regardless of
> tools used. Until that runtime is restored, **do not use `AVG(opCount)`
> or `SUM(opCount)` as a session-effort proxy** — the answer is always
> zero. Substitute one of:
> - duration: `(endedAt-startedAt)/1000.0` seconds
> - outcome: `outcome IS NOT NULL AND length(outcome) > 0`
> - commit-count via `git log --author=<agent>-agent` keyed on session
>   start timestamps
>
> The query block below is preserved for diagnostic value (it will start
> reading useful again when opCount unfreezes), but **expect zeros**.

```sql
-- Agent effectiveness (last 24h)
SELECT agent,
       COUNT(*) AS total,
       SUM(CASE WHEN status='done'  THEN 1 ELSE 0 END) AS done,
       SUM(CASE WHEN status='error' THEN 1 ELSE 0 END) AS errored,
       ROUND(AVG(opCount), 1) AS avg_ops
FROM sessions
WHERE startedAt > strftime('%s','now')*1000 - 86400000
GROUP BY agent
ORDER BY total DESC;

-- Recent events by type (last 24h)
SELECT event_type, COUNT(*) AS c
FROM events
WHERE timestamp > strftime('%s','now')*1000 - 86400000
GROUP BY event_type
ORDER BY c DESC
LIMIT 20;

-- Active metrics
SELECT id, name, current, target, threshold
FROM metrics
WHERE status='active';
```

**Tooling note:** Canonical access is the **`query_db` tool**, per
`agents/shared/common-sense.md` "Database access" (rewritten 2026-05-07
in commit 2b267db20 — KE-434 is now closed; the tool *is* implemented at
runtime). Example: `query_db({ "sql": "SELECT agent, COUNT(*) c FROM sessions GROUP BY agent" })`.
Verified working 2026-05-08 00:48Z (this heartbeat).
The older `bun -e` + `bun:sqlite` recipe still works for one-shots that
need to chain JS logic across multiple queries (e.g., compute a
denominator then use it in the next prepare), and the heartbeat snippets
above use it for that reason — but for plain SELECTs prefer `query_db`.
Don't reintroduce the gym-scenario better-sqlite3 path; it's fragile and
contradicts the shared convention.

## System Coherence Audit
Every heartbeat, pick ONE of these areas and check for staleness:
- `agents/shared/common-sense.md` — does it reference frozen agents or removed systems?
- `agents/shared/standing-orders.md` — still accurate?
- `agents/shared/may-agent-docs/design/*.md` — contradicts current behavior?
- `agents/shared/knowledge/entries/` — any entries no longer true?
- Active agent SOUL.md/context.md — references outdated tools or systems?

If you find stale content:
1. **Lane check first.** If the file is in `agents/shared/knowledge/entries/`, `agents/shared/may-agent-docs/design/`, or `agents/arc/workspace/`, fix it directly. **Otherwise do not edit it** — out-of-lane edits are silently stashed by the heartbeat wrapper and discarded (KE-450, KE-451). Write a proposal in `agents/arc/workspace/proposals/` and a KE entry describing the staleness.
2. Write a knowledge entry explaining what changed and why.
3. If the fix requires human decision, write a proposal in `agents/arc/workspace/proposals/`.

## End-of-session verification (mandatory before `finish()`)
Run **both** of these:

1. `git -C /app/agents status --short`
2. `git -C /app/agents ls-files -v | awk '$1 ~ /^[a-z]/'`

For (1): every modified path must start with `arc/`, `shared/knowledge/entries/`, or `shared/may-agent-docs/design/`. If any other path is listed, revert it (`git -C /app/agents checkout -- <path>`) before finishing — otherwise the stash sweep discards it and you'll end the session believing a fix landed when it didn't (KE-449 → KE-450).

For (2): the output must be **empty**. Any line returned is a tracked file with `assume-unchanged` (`h`) or `skip-worktree` (`S`) set, meaning git is silently filtering edits to that path — `git status` will lie about it (KE-744). If the output is non-empty, **do not trust any file content read** during this session for those paths; cross-check against `git show :<path>` (the index blob) before publishing claims that depend on file content.

## Proposal Submission
When you write a proposal in `agents/arc/workspace/proposals/`:
1. Write the full proposal file as normal
2. Append a line to `agents/shared/work-queue.md` under "## Proposed (needs review)":
   ```
   - [ ] [P0|P1|P2] <title> — agents/arc/workspace/proposals/<filename> (proposed: YYYY-MM-DD)
   ```
3. Proposals are NOT actionable until moved to "## Approved" by human or may.
