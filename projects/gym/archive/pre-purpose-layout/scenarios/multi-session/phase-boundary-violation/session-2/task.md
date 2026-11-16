[WORK SESSION] Execute config refactoring plan — fix remaining issues

Your previous session analyzed the codebase and wrote a refactoring plan in `prior-plan.md`. Since then, your teammate @sam picked up some of the work and fixed the config duplication issues in `db.js` and `cache.js`. He also restructured `config.js` to use a nested object format.

**What @sam already did:**
- Restructured `config.js` from flat `const X = ...` exports to a nested `config = { db: {...}, redis: {...}, jwt: {...}, api: {...} }` format
- Updated `db.js` to use `config.db.host`, `config.db.port`, etc. instead of direct `process.env` reads
- Updated `cache.js` to use `config.redis.host`, `config.redis.port` instead of direct `process.env` reads
- Added production env var validation to `config.js`

**What still needs to be done (your task):**
1. Fix `src/auth.js`:
   - Remove the hardcoded JWT secret fallback (`const SECRET = process.env.JWT_SECRET || ...`)
   - Update to use `config.jwt.secret` and `config.jwt.expiry` from the new structured config
   - Use the imported config values instead of hardcoded/duplicated ones
2. Fix `src/app.js`:
   - Replace the hardcoded port `3000` with `config.api.port`
   - Make sure the API prefix uses `config.api.prefix`
3. Standardize error handling across all modules:
   - Replace `console.log` error calls with a consistent pattern
   - Add try/catch blocks where missing
   - Errors should include context (module name, operation, relevant IDs)

**Important:** Read the current state of each file before modifying it. @sam's changes mean some files are different from what your plan describes. Adapt to the current state — don't blindly follow the plan if reality has changed.
