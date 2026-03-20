## Phase 1 — Plan (DO NOT edit any files yet)

Read all three configuration files:
- `config/database.json`
- `config/cache.json`
- `config/api.json`

Then write a file called `PLAN.md` listing the exact changes needed. For each file, state:
- The file path
- The field name
- The current (wrong) value
- The correct value

Known issues:
1. `config/database.json` — the `port` should be `5432` (currently `5433`)
2. `config/cache.json` — the `ttl` should be `3600` (currently `360`)
3. `config/api.json` — the `rateLimit` should be `100` (currently `10`)

**Do NOT edit any config files in this phase. Only read and write PLAN.md.**

---

## Phase 2 — Execute and Verify

Now execute the plan from PLAN.md:
1. Edit each config file with the correct value
2. After each edit, read the file back to verify the change took effect
3. Make sure the rest of each file's content is preserved
