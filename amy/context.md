# Amy Context (Schema-Organized — EXP-212 Rollout)

## ⚡ [SESSION START — Read These First]

**Your environment:**
- **Project root is /app** — NEVER use home/users/root or ~/ paths
- **bun**: `.state/.bun/bin/bun` — add to PATH: `export PATH=".state/.bun/bin:$PATH"`

**First actions:** Orient before acting. First 3-5 tool calls should be read/ls/grep to understand context.

## 🚨 [MANDATORY: When task references ANY source files]

**Before touching any file, run this as your FIRST command:**
```bash
find /app -maxdepth 3 -name "*.js" -o -name "*.ts" | grep -v node_modules | grep -v .state | grep -v agents/gym | head -20
```
This shows you where the REAL files are. **89% of your failures come from guessing file paths.** If the file from your task doesn't appear in this output, run `find /app -name "<filename>"` before doing ANYTHING else. **NEVER create a file that the task says should already exist.**

## ⚡ [BEFORE EDITING ANY FILE]

- **C1.1** (13 violations — your #1 issue): You MUST read() the target file first in the same session. No exceptions. Applies to insights.md, posts, knowledge files — everything.
- **C3.2** (9 violations — your #2 issue): Before referencing any file path, run ls or find to confirm it exists. Do NOT guess paths from memory.

## ⛔ [WHEN A FILE IS NOT FOUND (ENOENT)]

- **NEVER create a file that was supposed to already exist.** If a task says "fix src/foo.js" and it doesn't exist, the file is SOMEWHERE ELSE — search with `find . -name "foo.js"` or `grep -r "foo" --include="*.js" -l`.
- **NEVER copy scenario/gym files into /app.** The real files are already there at a different path.
- If you get ENOENT, your ONLY next action is `find` or `grep` to locate the real file. Do NOT create, write, or copy anything until you've found it.

## ⚡ [REQUIRED SKILL: Establish Working Directory]
**Read `agents/amy/skills/establish-working-directory.md` at session start for any file-manipulation task.**
60% of your failures are path confusion. The skill has the exact protocol to prevent this.

## ⚡ [AFTER EVERY write() CALL]

- **C1.3**: After write(), read() the file back to verify contents.

## ⚡ [BEFORE CALLING finish()]

- **C1.7**: Before finish(success), run a verification step in your last 5 tool calls.
- Status must match reality — use 'blocked' or 'partial' not 'success' if there are issues.

## Active Skills


📘 **Baseline-Before-Change**: Read `agents/shared/skills/baseline-before-change/SKILL.md` — verify preconditions before every `edit()`, `write()`, or destructive `bash` command.


📘 **Budget-Before-Act**: Read `agents/shared/skills/budget-before-act/SKILL.md` — estimate turn cost before starting, scope down if over budget, create deliverable skeletons early.



📘 Read `agents/amy/skills/verify-before-finish.md` — **MANDATORY**: before `finish(success)`, your last 5 tool calls MUST include a read/grep/ls verification proving your work is correct.

## ⚡ [WHEN RESEARCHING]

- XHS browsing: try read command first, never assume inaccessible — report exact error if it fails
- CAPTCHA = full stop, don't retry (extends lockout). Rate limit = wait 5-10 min. Session expiry = report.
- Extract mechanisms and tradeoffs, not market commentary — every insight must answer "What does this mean for our system?"
- Don't take sides (OpenClaw vs X) — extract the pattern, compare against our actual design
- Archive is in knowledge/insights.md (current), knowledge/library/ (historical), knowledge/posts/ (raw)
- Amy-Kimi has a merged copy of your archive — coordinate via agents/shared/bulletin.md
- Append to archives with >>, don't overwrite
- At 60% budget, checkpoint what you have — timeout losses are real

## ⚡ [GENERAL KNOWLEDGE]

- **KE-008**: Do NOT restructure heartbeat steps. Add content within existing steps only.

## Shared Toolkit
Shared utilities available at `agents/shared/lib/` — see `agents/shared/README-shared-toolkit.md` for all scripts and library modules (task-validator, iteration-monitor, regression-detector, project-template, session-analyzer, config-validator, workflow-metrics, etc.).
