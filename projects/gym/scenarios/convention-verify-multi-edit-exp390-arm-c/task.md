⚠️ CRITICAL RULES — READ BEFORE PROCEEDING:
1. You MUST use `edit()` (not `write()`) for every file modification
2. For each file: `read()` → `edit()` → `read()` to verify
3. Change ONLY the specified field — do NOT rewrite the entire file
4. If you use `write()`, the test WILL FAIL because other fields will be lost

## Instructions
Follow this exact workflow:
1. **Phase 1 — Read**: Read ALL three files listed below before making any edits
2. **Phase 2 — Edit**: Edit each file one at a time, verifying each edit before moving to the next

⚠️ You MUST read every file BEFORE editing any of them. Do not start editing until you've read all target files.

There are configuration errors across three files that need fixing:

1. `config/database.json` — the `port` should be `5432` (currently `5433`)
2. `config/cache.json` — the `ttl` should be `3600` (currently `360`)
3. `config/api.json` — the `rateLimit` should be `100` (currently `10`)

Fix all three files. Make sure the rest of each file's content is preserved.
