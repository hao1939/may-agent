# KE-434: `query_db` tool is canon in docs but unimplemented in runtime

**Date:** 2026-05-01
**Author:** arc (heartbeat coherence audit)
**Confidence:** High — verified across docs, agent.json files, runtime bash
hint, and direct grep for any TS implementation.
**Connects:** KE-426 (project-location-doc-drift), KE-415 (designed-but-unwired-sync-paths)

## Observation

Five docs / configs treat `query_db` as the canonical, mandatory way for
agents to read the database. One doc admits it isn't implemented. The
runtime never actually exposes it, and the bash sandbox actively
*recommends the opposite path*.

| File | What it says | Treats `query_db` as |
|------|-------------|----------------------|
| `agents/shared/common-sense.md` §Database access | "Use the `query_db` tool. Do NOT open the database file directly from bash — it causes corruption." | Required |
| `agents/shared/db-schema.md` line 5 | "Database accessible via `query_db` tool. Do not open the file directly." | Required |
| `agents/arc/SOUL.md` Constraints | "Never open DB directly — use `query_db` tool" | Required |
| `agents/arc/context.md` Resources | Examples like `query_db("SELECT * FROM metrics WHERE status='active'")` | Required |
| `agents/arc/agent.json`, `agents/dev/agent.json` | Lists `"query_db"` in `tools` | Declared available |
| `agents/shared/may-agent-docs/evolution.md:152` | `\| query_db \| database querying (placeholder — not yet implemented) \|` | **Admits unimplemented** |

## Evidence

```bash
$ find /app -path '*/node_modules' -prune -o -name '*.ts' -print \
    | xargs grep -l 'query_db\|query-db\|queryDb' 2>/dev/null
# (empty — zero TS implementations under /app)

$ grep -n 'query_db' agents/shared/may-agent-docs/evolution.md
152:| `query_db` | database querying (placeholder — not yet implemented) |
```

This heartbeat session's actual tool set is `bash, read, edit, write,
finish` — no `query_db`. When I tried `sqlite3` the runtime hint
explicitly said:

> 💡 Hint: sqlite3 CLI is not available. Use `bun -e` with bun:sqlite. DB is at .state/may.db.

So the runtime *blesses* a direct-from-bash path the docs forbid.
Every recent arc heartbeat (including the session that produced KE-433)
queried the DB via `bun -e` + bun:sqlite with `readonly:true` and
worked correctly — no corruption, no errors, ~10 sessions over 12 h.

`agent.json` listing `"query_db"` in arc's and dev's tools array is also
non-functional — it's accepted at config-load but no tool gets wired in,
because no implementation exists.

## Implication

This is the same shape as KE-426 (project-location drift) and KE-415
(designed-but-unwired). A future arc following SOUL.md literally would
either:

1. Refuse to query the DB at all ("constraints say I can't"), losing the
   single most important input for synthesis — **and producing the
   "nothing to do" failure mode KE-432 warns about**, or
2. Try to call `query_db(...)` as a function, get a tool-not-found
   error, and waste a turn discovering the doc is lying.

Both paths burn the heartbeat. Worse, the "do NOT open the database
file directly from bash — it causes corruption" line is overbroad —
read-only bun:sqlite access is the system's own recommended fallback.
The corruption risk is real only for **write-mode** direct access (a
second writer can race the in-process DB connection and brick the WAL).
Read-only opens are fine and have been used by arc continuously.

## Recommendation

Three small doc fixes that don't require any code change:

1. **`agents/shared/common-sense.md` §Database access** — replace the
   `query_db` claim with the actual working pattern:

   > Read the DB via `bun -e` with `bun:sqlite` in **readonly mode**
   > (`new Database('.state/may.db', {readonly: true})`). Never open
   > the DB read-write from bash — that races the in-process writer
   > and can corrupt the WAL. To write data, emit events.

2. **`agents/shared/db-schema.md` line 5** — same fix.

3. **`agents/arc/SOUL.md` and `agents/arc/context.md`** — replace
   `query_db` references with the bun:sqlite readonly pattern.

4. **`agents/shared/may-agent-docs/evolution.md`** — either drop the
   `query_db` row from the tools table entirely, or rename it to
   "(removed; use bun:sqlite readonly)" so future agents don't try it.

5. **`agents/arc/agent.json`, `agents/dev/agent.json`** — remove
   `"query_db"` from the `tools` array so config matches reality.

All five fixes are mechanical text edits in arc's editable scope (1–4)
plus two `agent.json` changes that human-or-dev should make (5).

I'll do (1)–(4) in this heartbeat. (5) goes to a proposal.

## Falsifier

If someone wires up a real `query_db` tool that actually appears in
arc's tool list, **this entry becomes wrong** and the docs were right
all along. To check: in a future session, look at the tool roster — if
`query_db` is there, ignore this KE and revert the doc edits. Until
then, the docs are aspirational and the bun:sqlite pattern is the
truth.
