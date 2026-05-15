# Arc Heartbeat

## Priority Order
0. **Check INBOX**: read `agents/arc/INBOX.md`. If non-empty, treat its items
   as inputs to today's priorities. (Self-fix per KE-417 — arc eats its own
   dogfood; this is the existence proof for the priority-0 INBOX pattern.)
1. **Read new knowledge**: check `shared/knowledge/entries/` for recent additions. **Before forecasting on any metric, grep entries for the metric name and read the three most recent matching KEs.** Skipping this step is how KE-561 inherited an out-of-date cadence model (see KE-562).
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

### Copy-paste cheatsheet (lift verbatim, do not retype) — KE-922
You will trip a "no such column" error if you retype these from memory.
Copy the literal SELECT, then add WHERE/GROUP BY. Column lists are correct.

```sql
-- sessions: PK is sessionId (NOT id). status ∈ {done,error,interrupted,running}.
-- No stopReason column — that lives in session.end event data JSON.
SELECT sessionId, agent, status, startedAt, endedAt, opCount, outcome, error
FROM sessions
WHERE startedAt > strftime('%s','now')*1000 - 21600000
ORDER BY startedAt DESC;

-- events: NO session_id, NO agent, NO created_at, NO payload columns.
-- Filter by JSON: data LIKE '%<sessionId>%' or json_extract(data,'$.agent')='arc'.
SELECT id, event_type, source, owner, timestamp, status, urgency
FROM events
WHERE timestamp > strftime('%s','now')*1000 - 21600000
  AND json_extract(data,'$.agent') = 'arc'
ORDER BY timestamp DESC;

-- metrics: column is `current` (NOT value), `updated_at` (NOT lastUpdated).
SELECT id, name, current, target, threshold, status, updated_at
FROM metrics
WHERE status = 'active';

-- projects: PK is `id` (NOT projectId), `updated_at` (NOT updatedAt).
SELECT id, name, owner, status, priority, milestones_done, milestones_total, updated_at
FROM projects
WHERE owner = 'arc';
```

### Schema reality (the *why* behind the cheatsheet)
Verified 2026-05-08: the `sessions` table has no
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

> **opCount unfroze 2026-05-09 09:43:39Z** (KE-796 F3 falsified → KE-1236).
> The runtime now reliably writes a non-zero `opCount` for workflow sessions
> (3d window: 2141/2344 nonzero, avg ≈12, max 76). Use `AVG(opCount)` again
> as a session-effort proxy — **but only on windows that begin after
> 2026-05-09 09:43Z**; any window crossing 2026-05-07 09:13Z → 2026-05-09
> 09:43Z still mixes in structural zeros from the freeze period. For
> longer windows, prefer `(endedAt-startedAt)/1000.0` (duration) or
> `commit-count via git log --author=<agent>-agent` until the freeze
> period rolls out.

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
`shared/common-sense.md` "Database access" (rewritten 2026-05-07
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
- `shared/common-sense.md` — does it reference frozen agents or removed systems?
- `shared/standing-orders.md` — still accurate?
- `shared/may-agent-docs/design/*.md` — contradicts current behavior?
- `shared/knowledge/entries/` — any entries no longer true?
- Active agent SOUL.md/context.md — references outdated tools or systems?

If you find stale content:
1. **Lane check first.** If the file is in `shared/knowledge/entries/`, `shared/may-agent-docs/design/`, or `agents/arc/workspace/`, fix it directly. **Otherwise do not edit it** — out-of-lane edits are silently stashed by the heartbeat wrapper and discarded (KE-450, KE-451). Write a proposal in `agents/arc/workspace/proposals/` and a KE entry describing the staleness.
2. Write a knowledge entry explaining what changed and why.
3. If the fix requires human decision, write a proposal in `agents/arc/workspace/proposals/`.

## End-of-session verification (mandatory before `finish()`)
Run **both** of these:

1. `git -C /app/agents status --short`
2. `git -C /app/agents ls-files -v | awk '$1 ~ /^[a-z]/'`

For (1): the guard is **paths arc edited this session**, not every dirty path. The worktree is shared with concurrent agents; other agents' `last-session.md`, runtime-updated files, and unrelated agent project docs may be dirty as steady-state noise (KE-912 — and the 2026-05-09 evaluator P2 to arc citing 11 unrelated dirty agent files is exactly this false positive). Only act on paths **this** session wrote/edited. For those paths: every one must start with `arc/`, `shared/knowledge/entries/`, `shared/may-agent-docs/design/`, or an `owner: arc` shared project. If anything else is in *your* edit set, revert it (`git -C /app/agents checkout -- <path>`) before finishing — otherwise the stash sweep discards it and you'll end the session believing a fix landed when it didn't (KE-449 → KE-450). Do **not** revert ambient dirt you didn't create; that's another agent's lane and reverting it is the actual hygiene violation.

For (2): the output must be **empty**. Any line returned is a tracked file with `assume-unchanged` (`h`) or `skip-worktree` (`S`) set, meaning git is silently filtering edits to that path — `git status` will lie about it (KE-744). If the output is non-empty, **do not trust any file content read** during this session for those paths; cross-check against `git show :<path>` (the index blob) before publishing claims that depend on file content.

## Proposal Submission
When you write a proposal in `agents/arc/workspace/proposals/`:
1. Write the full proposal file as normal
2. Append a line to `shared/work-queue.md` under "## Proposed (needs review)":
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
- `shared/knowledge/entries/KE-NNN-*.md`
- `projects/<id>/journal.md` (or project.md)
- `agents/arc/workspace/proposals/*.md`
- `agents/arc/workspace/analysis/*.md` (scratch — files already tracked
  under here are grandfathered, but new files need `git add -f`; see
  next paragraph)

**Do NOT** put a "durable" file directly under `agents/arc/workspace/`
(e.g. `arc/workspace/heartbeat-log.md`). The repo's `.gitignore` line 31
is `*/workspace/*` and line 43 is `/workspace/` (repo-root). Gitignore
globs don't cross `/`, so files in subdirs (`proposals/`, `analysis/`)
are *grandfathered-trackable* — meaning files **already in the index**
under those dirs continue to track. **A brand-new file** under
`arc/workspace/analysis/` is still ignored by rule 31 matching the
directory; a plain `git add path/in/analysis.md` is rejected (or a
no-op via the wrapper) and you need `git add -f` to land it.
`git status` won't show ignored files, and `finish(success)` will
believe the artifact landed when it didn't. Aftermath caught the root
variant on `s_1778328901912_13` → KE-918, and the may heartbeat hit the
**repo-root** `agents/workspace/` variant 13:25Z one heartbeat later →
KE-921. Verify any new lane with `git check-ignore -v <path>` before
relying on it; if it returns a match, use `git add -f` and re-check
with `git ls-files -- <path>` that the file is now tracked.

Safer durable lanes (no `-f` needed): `shared/knowledge/entries/KE-*.md`
and `projects/<id>/journal.md`. Prefer those for any artifact
worth surviving a worktree refresh.

Treat `last-session.md` as read-only wrapper output.
