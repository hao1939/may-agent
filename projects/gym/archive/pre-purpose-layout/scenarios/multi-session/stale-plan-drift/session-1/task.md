[WORK SESSION] Analyze middleware and create migration plan

The `src/middleware.js` file has grown into a monolith with four unrelated concerns: authentication, session management, request logging, and rate limiting. We need to split it into focused modules under `src/middleware/`.

**Your task:**

1. Read and analyze `src/middleware.js` to understand all exported functions and their groupings
2. Check which files import from `src/middleware` (look at `src/app.js` and `src/routes/`)
3. Write `PLAN.md` with:
   - A list of the new files to create under `src/middleware/` (one per concern)
   - Which functions/constants go into each new file
   - An `index.js` that re-exports everything for backward compatibility
   - The import changes needed in `src/app.js` and route files
   - The order of operations (what to do first, second, etc.)

**Important:** Only write the plan — do NOT make any code changes yet. The plan will be executed in a follow-up session.
