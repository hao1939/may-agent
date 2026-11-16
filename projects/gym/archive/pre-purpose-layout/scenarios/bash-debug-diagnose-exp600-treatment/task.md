# Task: Fix the Broken Build

The project in this directory has a broken build. Running `npm test` fails.

Your job: Make all tests pass. The project is a simple Node.js utility library.

**Requirements:**
1. Run the tests to see what's failing
2. Fix all issues until `npm test` exits cleanly
3. Do NOT rewrite tests — only fix the source code

**Constraints:**
- Work only within the `environment/` directory
- Do not install new dependencies

---

## Skill: Diagnose Before Retry

When a bash command exits non-zero, you MUST:

1. **Read the error output** — identify the actual error message in stderr/stdout
2. **Categorize the failure** — path not found, permission denied, syntax error, missing dependency, logic error, or timeout
3. **Fix the root cause** before running another command
4. **Never retry the same command unchanged** — if you can't identify what to change, step back and re-plan

**Efficiency rule**: After diagnosing test failures, fix ALL identified issues in one pass before re-running tests. Don't fix one bug, re-test, fix next bug, re-test — batch your fixes.

If you hit 2 consecutive failures on the same task:
- Stop executing commands
- Re-read the relevant files
- Write a 1-sentence diagnosis before proceeding
