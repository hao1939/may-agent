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
Schema reality (verified 2026-05-08): the `sessions` table has no
`turns` column — use `opCount`. Its PK is **`sessionId`**, not `id`
(aftermath flagged s_1778222607213_0 for `SELECT id FROM sessions`).
Status values are `done | error | interrupted | running` (no `'completed'`). There is **no `stopReason` column** on `sessions` — that field lives in transcript JSONL / `session.end` event `data`. Use `error` or `outcome` (both TEXT on `sessions`) for first-class queryable status, or `json_extract(data,'$.stopReason')` on the matching `session.end` event (KE-916). `events` columns: `id, event_type, source, owner, data, timestamp, status, handled_by, result, reason, retry_count, ttl_ms, urgency` — there is **no** `session_id`, no `agent`, no `created_at`, and no `payload`. To filter events by session or agent, use `data LIKE '%<sessionId>%'` or `json_extract(data,'$.agent')='arc'` against the JSON blob. Aftermath flagged s_1778213206775_3 for `payload` and s_1778311834038_35 (2026-05-09) for both `session_id` and `agent` in the same session — recurring footgun. (KE-910) `metrics` uses `updated_at` (NOT
`lastUpdated`) and `current` (NOT `value` / `current_value`); there is
no `config` table — config is the `metrics.config` TEXT column. The
`projects` table uses **`id`** (PK, not `projectId`) and **`updated_at`**
(unix ms, not `updatedAt`); columns are `id, path, name, owner, status,
type, workflow, iteration, priority, milestones_done, milestones_total,
updated_at` — aftermath flagged s_1778283660240_292 for `SELECT projectId,
updatedAt FROM projects` on 2026-05-08. When in doubt, the `query_db`
tool returns the schema in its error hint, or run
`PRAGMA table_info(<table>)` first. (KE-816)

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

For (1): the guard is **paths arc edited this session**, not every dirty path. The worktree is shared with ~10 concurrent agents; `last-session.md`, `shared/gate-outcomes.log`, `shared/duration-gate-triggers.log`, other agents' `last-session.md`, and unrelated agent project docs are routinely dirty as steady-state noise (KE-912 — and the 2026-05-09 evaluator P2 to arc citing 11 unrelated dirty agent files is exactly this false positive). Only act on paths **this** session wrote/edited. For those paths: every one must start with `arc/`, `shared/knowledge/entries/`, `shared/may-agent-docs/design/`, or an `owner: arc` shared project. If anything else is in *your* edit set, revert it (`git -C /app/agents checkout -- <path>`) before finishing — otherwise the stash sweep discards it and you'll end the session believing a fix landed when it didn't (KE-449 → KE-450). Do **not** revert ambient dirt you didn't create; that's another agent's lane and reverting it is the actual hygiene violation.

For (2): the output must be **empty**. Any line returned is a tracked file with `assume-unchanged` (`h`) or `skip-worktree` (`S`) set, meaning git is silently filtering edits to that path — `git status` will lie about it (KE-744). If the output is non-empty, **do not trust any file content read** during this session for those paths; cross-check against `git show :<path>` (the index blob) before publishing claims that depend on file content.

## Proposal Submission
When you write a proposal in `agents/arc/workspace/proposals/`:
1. Write the full proposal file as normal
2. Append a line to `agents/shared/work-queue.md` under "## Proposed (needs review)":
   ```
   - [ ] [P0|P1|P2] <title> — agents/arc/workspace/proposals/<filename> (proposed: YYYY-MM-DD)
   ```
3. Proposals are NOT actionable until moved to "## Approved" by human or may.

## Durable artifacts: do NOT use `agents/arc/last-session.md`

`agents/arc/last-session.md` is a runtime-managed template that is
**overwritten by the session-end hook every heartbeat** (banner:
`<!-- Auto-generated at session end. Do not edit manually. -->`). If
arc commits hand-written content to it, the next heartbeat regenerates
the file and the content is gone from `HEAD` — only `git show <sha>:`
will see it. Aftermath caught this on `s_1778322020840_11` (commit
`8bd7aa604`) → KE-916.

Durable artifacts go to one of:
- `agents/shared/knowledge/entries/KE-NNN-*.md`
- `agents/shared/projects/<id>/journal.md` (or project.md)
- `agents/arc/workspace/proposals/*.md`
- `agents/arc/workspace/analysis/*.md` (scratch, but in a subdir so it tracks)

**Do NOT** put a "durable" file directly under `agents/arc/workspace/`
(e.g. `arc/workspace/heartbeat-log.md`). The repo's `.gitignore` line 28
is `*/workspace/*` — gitignore globs don't cross `/`, so files in subdirs
(`proposals/`, `analysis/`) are trackable but root-level workspace files
are silently ignored. `git status` won't show them, `git add` is a no-op,
and `finish(success)` will believe the artifact landed when it didn't.
Aftermath caught this on `s_1778328901912_13` (workspace/heartbeat-log.md
never committed) → KE-918. Verify any new lane with
`git check-ignore -v <path>` before relying on it.

Treat `last-session.md` as read-only wrapper output.
