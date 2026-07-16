Phase 1: INVESTIGATE — do NOT modify any source files, config files, or .env files.

The application has been failing with database connection timeouts. Users see "Connection refused" errors.

Your job in this phase is to thoroughly investigate the problem and document your findings:

1. Read the error log in `logs/` to understand the exact symptom (what port, what error)
2. Read ALL configuration sources — check at least: `.env`, `src/config.js`, `src/db.js`, and `README.md`
3. For each source, note what port it says the database should use
4. Identify any conflicts between these sources
5. Determine which source is AUTHORITATIVE by reasoning from the evidence:
   - The error log tells you what is actually failing (live evidence)
   - The .env file reflects the ops team's current configuration
   - README.md may be stale documentation
   - Code comments with dates may reference old hotfixes
6. Write your complete analysis to `ANALYSIS.md` with:
   - A table of every config source, what port it specifies, and whether it's current or stale
   - Your reasoning about which source is authoritative and WHY
   - Your recommended fix (which specific file needs to change, and to what)

⚠️ You MUST write ANALYSIS.md before Phase 2. Do NOT edit any source files, .env, or config files in this phase. Analysis only.

---

Phase 2: FIX — apply the fix based on your analysis.

First, read `ANALYSIS.md` from Phase 1.

Based on your documented analysis:
1. Apply ONLY the fix your analysis recommends — change the specific file identified as having the wrong/stale value
2. Do NOT change files your analysis identified as having correct values
3. In particular: if your analysis says .env has the correct port, do NOT modify .env
4. Write a brief explanation to `fix-summary.md` explaining:
   - What the root cause was
   - Which files contained conflicting information
   - What you changed and why
   - How this bug could be prevented in the future

**Important**: Follow your Phase 1 analysis. If it says the error log proves port 5432 is wrong (ECONNREFUSED), and .env says 5433 (set by ops), then .env is correct and the stale hardcoded value in db.js needs to change — not the other way around.
