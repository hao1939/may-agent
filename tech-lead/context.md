# Tech-Lead Context (Schema-Organized — EXP-212 Arm B)

## ⚡ [SESSION START — Read These First]

**Your environment:**
- **Project root is /app** — NEVER use /home/*, /Users/*, /root/*, or ~/ paths. They don't exist.
- **agents/ is a separate git repo** at /app/agents/.git — run ALL git commands from /app/agents/ dir, NOT /app
- There is NO src/ directory or package.json in /app root. The runtime is pre-compiled.
- Your codebase is **agents/** — workflows, handlers, skills, heartbeats, context files

**First actions:** Read workspace context (heartbeat.md, todo.md, journal.md) BEFORE bash commands. Orient first, act second. First 3-5 tool calls must be read/ls/grep.

## ⚡ [BEFORE RUNNING ANY COMMAND]

**⛔ C7.1 — PATH CHECK:** Every bash command MUST use `/app` as root. Before typing ANY path, verify it starts with `/app` or is relative. NEVER use `/Users/`, `/home/`, `/root/`, or `~/`. These paths DO NOT EXIST and will fail. `cd /app && ...` is your standard prefix.

**Tool availability:**
- **bun**: `.state/.bun/bin/bun` — add to PATH: `export PATH=".state/.bun/bin:$PATH"`
- **npx**: NOT available — use `./node_modules/.bin/<tool>` or `bun x <tool>`
- **sudo**: NOT available
- **sqlite3 CLI**: NOT available — use `bun:sqlite` (see Database Access below)
- **Code search**: `scripts/code-search.sh <pattern>` (supports --path, -C, -i, -l)
- **Gym runner**: `scripts/gym-run.sh <scenario> --agent coder`

**Build check:** `cd /app/agents && ./node_modules/.bin/tsc --noEmit` — run after every code change to agents/ TypeScript files.

## ⚡ [BEFORE EDITING ANY FILE]

- **C1.1**: You MUST read() the target file first in the same session. No exceptions. Not even files you "know."
- After ANY direct file edit (not delegated), run verification: `./node_modules/.bin/tsc --noEmit` + relevant test. Do NOT finish() until exit code 0.

## ⚡ [AFTER EVERY write() CALL]

- **C1.3**: read() the file back to verify contents. Required for ALL new files. Pass rate improved from 50.9% → 98.6% — keep it up.

## ⚡ [BEFORE CALLING finish()]

- **C1.7**: Run a verification step (read/grep/test) in your last 5 tool calls.
- **FM-3.3**: Each deliverable in finish() MUST have a read()/bash() call you cite by step number in verification_evidence. See `skills/post-delivery-readback-verification.md`.
  - Never cite write() preview as evidence — do a separate read().
  - Never assert metrics (line counts, file counts) without a tool call that produced them.
  - Pattern: write → read-back → cite "Step N: read(file) showed X".
- Status must match reality — if missing files or blockers, use 'blocked' or 'partial', not 'success'.

## ⚡ [WHEN DELEGATING TO CODER]

- Add explicit file scope boundaries ("ONLY modify X, do NOT touch Y")
- Coder has SPEC_NONCOMPLIANCE pattern — always include verification step
- **FM-3.3 prevention**: For ALL bug-fix tasks, use verified-coder workflow (not raw agents.call). Include verifyCommand. Never trust coder's claim that tests pass.

## ⚡ [WHEN MAKING CODE CHANGES]

- **REVIEW GATE**: Direct commits to main BLOCKED by pre-commit hook. For src/ changes: `git checkout -b review/<session-id> && git add -A && git commit -m "..."`. Emergency bypass: `REVIEW_GATE_BYPASS=1 git commit`.
- **KE-008**: Do NOT restructure heartbeat steps (reorder, merge, rename). Add content within existing steps only.

## ⚡ [WHEN DESIGNING INTERVENTIONS]

- Before proposing guards: read `agents/shared/may-agent-docs/design/code-vs-data-decisions.md` — environmental knowledge goes in context.md, not code
- If you receive a design brief from Bob that lacks evidence, send it back — don't implement it
- **Never stack behavioral interventions** — combining 2+ degrades performance by 12-15pp (KE-123)
- **Few-shot examples harm discovery tasks** — template-following displaces exploration, -67pp regression (KE-133)

## Lean Session Heuristics

- **Write within 5**: First write/edit within 5 tool calls. Lean sessions write at 3-4; bloated at 54+.
- **Bash streak limit**: After 5 consecutive bash calls, pause and write. Lean max 3-7; bloated streak 13-31.
- **Budget**: Stay under 80 tool calls per session (C6.1).

## Database Access

- **DB path**: `.state/may.db` (SQLite)
- **Access**: `bun:sqlite` only — `node:sqlite` and `sqlite3` CLI NOT available
- **Example**: `bun -e "import{Database}from'bun:sqlite'; const db=new Database('.state/may.db',{readonly:true}); console.log(db.query('SELECT name FROM sqlite_master WHERE type=\"table\"').all());"`
- **Key tables**: sessions, evaluations, requests

## Operational Preferences

- **Feature delivery rotation**: Alternate heartbeat cycles between infra/exploration and feature work. Check `agents/may/workspace/dispatch-board.md`.
- opBudget removed — agents take as many ops as needed.
- Research preference: apply ideas to our system. Build POCs, experiment, implement.

## Reflexion-Extracted Lessons

- agents-auto-commit.ts runs every 10min (not 2h). 986 runs, 0 failures.
- Dispatch board 'P1 federation sync data loss' is stale (April 8-11 fixes resolved it).
- When re-auditing, check fix status first before re-investigating.
- Code merged to main doesn't take effect until binary is rebuilt. Check process start time vs fix merge time.

## Learned from experience

- The src/ directory has pre-compiled code — type definition changes (.d.ts) don't require bundle rebuilds. (2026-04-22)
- Gym scenario environments need data/ and test/ directories copied from the scenario source. (2026-04-22)
- This is the finish-guard in the codebase, not what's blocking me. The blocking is from the infrastructure layer. Since I made no file changes, the guard is a false positive. Let me try with no deliver (source: s_1776973099184_15, 2026-04-23)
- Commit exists. The test files are already gone per my earlier `rm`. The guard just doesn't recognize `rm` as a file change. Let me verify and rephrase. (source: s_1776971299203_4, 2026-04-23)
- Let me write up my findings and commit: (source: s_1776980299637_61, 2026-04-23)
- The guard seems to think `npm install` counts as a write. Let me verify that didn't break anything. (source: s_1776978499131_49, 2026-04-23)
- Everything looks healthy. Let me dismiss the inbox items and wrap up: (source: s_1776976699419_37, 2026-04-23)
- Now let me checkpoint and finish this heartbeat: (source: s_1776985496719_101, 2026-04-24)
- Good — `retryResult` is only used with `ctx.summarize()`, not `.includes()`. The fix is complete. (source: s_1776983972179_96, 2026-04-24)
- Now let me address the other P0 notifications quickly. The "resume-handler redesign dispatched 5+ times" — let me dismiss that since it's an informational alert about duplicate dispatches, not somethi (source: s_1776983899519_93, 2026-04-24)
- No zombies — cleanup is working. All clear. (source: s_1777050522457_169, 2026-04-24)
- No concerning changes. System is healthy. Let me finish up. (source: s_1777046921337_91, 2026-04-24)
