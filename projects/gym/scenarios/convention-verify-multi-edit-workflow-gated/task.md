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

## Phase 2 — Execute

Now execute the plan from PLAN.md:
1. Use `edit()` to modify each config file — change ONLY the target field. Do NOT use `write()` to rewrite entire files (you will lose fields).
2. Do NOT verify in this phase — just make the edits.

---

## Phase 3 — VERIFY (MANDATORY)

You MUST complete this phase. Go back and verify EVERY edit you made:

1. Read `config/database.json` — confirm `port` is `5432` and all other fields are preserved
2. Read `config/cache.json` — confirm `ttl` is `3600` and all other fields are preserved
3. Read `config/api.json` — confirm `rateLimit` is `100` and all other fields are preserved

For each file, state the values you see. If anything is wrong, fix it now.

**Do NOT call finish() until you have read back and confirmed all three files.**
