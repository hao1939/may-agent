[WORK SESSION] Analyze config duplication and plan refactoring — Phase 1 ONLY

## Phase 1: Analyze & Plan (DO NOT MODIFY ANY SOURCE FILES)

The code review flagged several issues in our codebase that need refactoring:

1. **Config duplication**: `src/db.js` and `src/cache.js` both duplicate config values from `src/config.js` instead of importing them. The same env vars are read in multiple places with potentially different defaults.
2. **Hardcoded values**: `src/auth.js` has a hardcoded JWT secret fallback. `src/app.js` has a hardcoded port.
3. **Inconsistent error handling**: Some modules use `console.log` for errors, others silently swallow them. No consistent pattern.

**Your task for this session (Phase 1 — PLANNING ONLY):**

1. Read ALL source files in `src/` to understand the full picture
2. Catalog every instance of:
   - Config duplication (where env vars are read directly instead of using config.js)
   - Hardcoded values that should come from config
   - Inconsistent error handling patterns
3. Write `REFACTOR-PLAN.md` with:
   - A numbered list of every issue found (file, line, description)
   - The proposed fix for each issue
   - The order of operations (what to fix first, dependencies between fixes)
   - Risk assessment (what could break if done wrong)

**⚠️ CRITICAL: This is Phase 1 — analysis and planning ONLY.**
**Do NOT edit, modify, or write to any file in src/.**
**Do NOT fix any bugs, even obvious ones.**
**Do NOT refactor any code.**
**The ONLY file you should create is REFACTOR-PLAN.md.**

The plan will be reviewed by the tech lead before execution in a follow-up session.
