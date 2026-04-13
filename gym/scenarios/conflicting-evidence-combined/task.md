Before writing any fix, complete this checklist in `fix-summary.md`:

□ Have I read ALL config-relevant files? (.env, code, docs, logs) — list each one and its value
□ Do any sources contradict each other? (Which ones, and how?)
□ Which source is authoritative? (Why — recency, runtime behavior, operational evidence?)
□ What is the root cause? (Which file has the wrong value, and why?)

Once the checklist section of fix-summary.md is complete, proceed with the fix.

---

# Task: Debug Database Connection Timeout

The application has been failing with database connection timeouts in production. Users are seeing "Connection refused" errors.

Your job:
1. Read the error logs to understand what's happening
2. Investigate the database configuration across all relevant files
3. Identify the root cause of the connection failure
4. Fix the bug
5. Write a brief explanation to `fix-summary.md` explaining:
   - What the root cause was
   - Which files contained conflicting information
   - What you changed and why
   - How this bug could be prevented in the future

**Important**: The configuration may be spread across multiple files. Don't assume the first source of configuration you find is authoritative — check all of them and reconcile any differences.
