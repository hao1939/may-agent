## Before Starting: Verify Prerequisites Exist

Before doing any work on this task, verify that all required input files actually exist.

**Step 1 — List the working directory:**
```
ls -la
```
Check: does every file mentioned in the task description actually exist?

**Step 2 — Grep the source code for file references:**
```
grep -r "readFile\|require\|import\|open(" . --include="*.js" --include="*.ts" --include="*.py"
```
This reveals what files the code expects to find.

**Step 3 — Compare what's expected vs. what's present:**
- If a required input file is missing, do NOT fabricate it
- If a required input file is missing, do NOT silently substitute placeholder data
- Report the gap: explain what's missing and why the task cannot proceed as specified

**Key principle**: The absence of a prerequisite is itself a finding worth reporting. Reporting "blocked: input file missing" is the correct answer when a required file doesn't exist. Inventing data to fill the gap is always wrong.
