# Proposal: Remove dead `query_db` tool reference from configs and SOULs

**For:** Hao / dev
**From:** arc heartbeat 2026-05-01 ~07:55Z
**Urgency:** LOW — coherence cleanup; no current breakage
**See:** KE-434

## Problem

`query_db` is referenced in five places as the canonical DB-access path
for agents, but it has no implementation in `/app` (zero TS files match)
and is not exposed at runtime. Heartbeats this session got `read, bash,
edit, write, finish` — no `query_db`.

I've fixed the docs in arc's editable scope (common-sense.md,
db-schema.md, evolution.md, arc/context.md, plus KE-434 documenting
the drift). The remaining two references are in agent configs and a
SOUL.md that arc doesn't own:

1. **`agents/arc/SOUL.md`** — line in Constraints says
   `"Never open DB directly — use query_db tool"`.
   Should become: `"Read DB via bun:sqlite in readonly mode; never open
   read-write from bash"`.

2. **`agents/arc/agent.json`** and **`agents/dev/agent.json`** —
   each lists `"query_db"` in its `tools` array. The config-load is
   silent when the tool isn't registered, so these are **dead config**.
   Drop them.

## Evidence

```bash
$ find /app -path '*/node_modules' -prune -o -name '*.ts' -print \
    | xargs grep -l 'query_db\|queryDb' 2>/dev/null
# (empty)

$ grep -n query_db agents/shared/may-agent-docs/evolution.md
152:| `query_db` | DB query tool — listed in some `agent.json` configs but
    **not currently wired in at runtime**; use `bun:sqlite` readonly from bash.
    See KE-434. |
```

This heartbeat session's bash hint:
> 💡 Hint: sqlite3 CLI is not available. Use `bun -e` with bun:sqlite. DB is at .state/may.db.

i.e. the runtime explicitly recommends what the docs forbade.

## Proposed Change

A: Either implement `query_db` (small wrapper around bun:sqlite that
takes a SQL string and returns rows), wire it into the tool registry,
and add it to all agents that need DB access (arc, dev, coach, may,
optimizer, evaluator). Then revert KE-434's doc edits.

**OR**

B: Delete the dead references:
- `agents/arc/SOUL.md`: replace the `query_db` constraint with the
  bun:sqlite readonly guidance.
- `agents/arc/agent.json`: remove `"query_db"` from `tools`.
- `agents/dev/agent.json`: remove `"query_db"` from `tools`.
- Optional: drop the row from `evolution.md` entirely.

## Expected Impact

- New agents won't be told to use a tool that doesn't exist.
- One fewer place where docs lie about runtime capability — reduces
  the same trust-erosion KE-426 (project-location drift) flagged.

## Risks

- A: Implementing `query_db` is the more honest fix but means src/
  changes (gatekeeper review per ORDER-009 if the registry counts as
  guard-adjacent). It's the better long-term move because every agent
  currently has to recreate the same bun:sqlite boilerplate.
- B: If someone later wires up `query_db`, configs will need to be
  re-added. Cheap to redo.

Recommend **B for now, A as a follow-up project**. If A happens, it
should come with a `tools/query-db.ts` that just `new
Database(path,{readonly:true})` and a `prepare(sql).all(params)` —
~20 lines.

## Related
- KE-434 (this drift)
- KE-426 (doc-drift class)
- KE-415 (designed-but-unwired-sync-paths)
