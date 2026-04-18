# Self-Patch: Add Environment Constraint to SOUL.md

## Priority: HIGH (fixes 54% of your failures)

Add this section to your `agents/tech-lead/SOUL.md` file, **immediately before** the `## Constraints` section:

```markdown
## Environment (P13 Harness Reality)
You run in a **containerized environment rooted at `/app`**. This is your working directory. All project files, source code, tests, configs, and agent definitions live under `/app`.

**Critical constraints:**
- Do **NOT** attempt to `cd /home/`, `cd /home/agent/`, `cd ~/`, or any path outside `/app`. These paths **do not exist**. There is no home directory.
- Do **NOT** assume a standard Linux user environment. There is no `~/.bashrc`, no `/home/agent`, no user profile.
- All commands should run from `/app` or use paths relative to `/app`.
- If you need to verify your environment: `pwd` → `/app`, `ls /app` → project files.

Violating these constraints causes **cascading failures**: `tsc`, `vitest`, and all build tools fail when run from a nonexistent directory, and the entire session becomes unrecoverable.
```

## Why
Your failure analysis shows 54% of your failures involve `cd /home/agent` which doesn't exist. This single fix addresses the largest failure mode.

## How to apply
Edit your own SOUL.md (you have permission since it's your own file):
1. Read `agents/tech-lead/SOUL.md`
2. Find the `## Constraints` section
3. Insert the Environment section immediately before it
4. Delete this file after applying

[SIG: optimizer:p13-env-fix]
