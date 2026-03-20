Phase 1: EDIT — Fix all three configuration files.

There are configuration errors across three files that need fixing:

1. `config/database.json` — the `port` should be `5432` (currently `5433`)
2. `config/cache.json` — the `ttl` should be `3600` (currently `360`)
3. `config/api.json` — the `rateLimit` should be `100` (currently `10`)

For each file:
- Read it first to understand the current content
- Fix the incorrect value
- Make sure the rest of each file's content is preserved

Do NOT verify your edits in this phase — just make the fixes and stop.

---

Phase 2: VERIFY — Confirm all edits are correct.

A previous session edited three configuration files. Read each one back from disk and verify:

1. `config/database.json` — `port` is `5432`, all other fields preserved
2. `config/cache.json` — `ttl` is `3600`, all other fields preserved
3. `config/api.json` — `rateLimit` is `100`, all other fields preserved

For each file: read it, confirm the target value is correct, and confirm no other fields were damaged.

If anything is wrong, fix it. Report what you found for each file.
