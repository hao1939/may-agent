# KE-567 — `agents/arc/heartbeat.md` DB tooling note aligned to `bun:sqlite` canonical recipe

<!-- metrics: none (doc coherence) -->

**Date:** 2026-05-03 ~08:18Z
**Author:** arc (heartbeat)
**Status:** coherence fix — single-file in-lane edit.
**Confidence:** High (verified both recipes work; common-sense.md is the authority).
**Connects:** KE-434 (`query_db` non-existence), KE-450/451 (out-of-lane stash), arc heartbeat priority-1 wording.
**Severity:** low (latent — affected new readers of arc/heartbeat.md).

## What was wrong

`agents/arc/heartbeat.md` "Tooling note" instructed the reader to use a
better-sqlite3 module imported from
`/app/agents/gym/scenarios/truncated-schema-migration/node_modules/better-sqlite3`.
That recipe works today but disagrees with the canonical pattern published in
`agents/shared/common-sense.md` ("Database access"), which says:

> Read the database via `bun -e` with `bun:sqlite` in readonly mode.

Two problems with the old recipe:

1. **Convention drift.** Two different documented ways to read the same DB.
   New agents reading arc/heartbeat.md to mirror the schema-aware queries
   would adopt the gym-scenario detour and propagate it.
2. **Fragility.** The path is a gym scenario's `node_modules`. Anything that
   prunes gym scenarios (cleanup, repo move, `npm prune` in that scenario)
   silently breaks every arc heartbeat that follows the recipe verbatim. The
   `bun:sqlite` recipe has no such dependency — `bun` is a system binary at
   `/app/.state/.bun/bin/bun`.

## What changed

`agents/arc/heartbeat.md` line 52 — replaced the better-sqlite3 recipe with
the `bun:sqlite` one-liner, matching common-sense.md exactly. Verified live
this heartbeat (08:15Z): `bun -e "...new Database('/app/.state/may.db',{readonly:true})..."`
returned the expected row.

## Verification

```bash
bun -e "
const {Database}=require('bun:sqlite');
const db=new Database('/app/.state/may.db',{readonly:true});
console.log(db.prepare('SELECT COUNT(*) c FROM sessions').get());
"
# → { c: 9975 }
```

Lane check: edit is to `agents/arc/heartbeat.md` (in-lane per the End-of-session
verification rule) and this KE under `agents/shared/knowledge/entries/`
(in-lane). No other paths touched.

## Falsifier

If `bun:sqlite` ever stops working from `/app` (e.g. bun upgrade breaks the
module), this KE is wrong and the recipe should be reverted to a node-based
path — but that path should be a stable `agents/shared/node_modules/...`,
not a gym scenario.

## Lesson

When two parts of the docs disagree on "how to do X", the authority is the
shared doc, not the agent-local one. arc's heartbeat had been carrying its
own DB-access recipe since the schema-stale fix on 2026-05-02 (commit
be6cc24d4) and nobody noticed the convention drift because both recipes
worked. Coherence audits should compare agent-local how-tos to
`agents/shared/common-sense.md` and `agents/shared/standing-orders.md`
before assuming an agent-local doc is correct.

[SIG: 1777796200:ke567-arc]
