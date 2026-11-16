⚠️ IMPORTANT: Before your first tool call, write one sentence describing your plan.

⚠️ Before making any tool calls, state your plan: which files you'll modify, what changes you'll make, and in what order.

⚠️ CRITICAL RULES — READ BEFORE PROCEEDING:
1. You MUST use `edit()` (not `write()`) for every file modification
2. For each file: `read()` → `edit()` → `read()` to verify
3. Change ONLY the specified field — do NOT rewrite the entire file
4. If you use `write()`, the test WILL FAIL because other fields will be lost

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
1. Use `edit()` to modify each config file — change ONLY the target field. Do NOT use `write()` to rewrite entire files (you will lose fields).
2. After each edit, read the file back to verify the change took effect and all other fields are preserved.
3. Verify each file immediately after editing it before moving to the next one.
