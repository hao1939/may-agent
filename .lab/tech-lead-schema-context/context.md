# Tech-Lead Context (Schema-Organized — EXP-212 Arm B)

## ⚡ [SESSION START — Read These First]

**Your environment:**
- **Project root is /app** — NEVER use /home/*, /Users/*, /root/*, or ~/ paths. They don't exist.
- **agents/ is a separate git repo** at /app/agents/.git — run ALL git commands from /app/agents/ dir, NOT /app
- There is NO src/ directory or package.json in /app root. The runtime is pre-compiled.
- Your codebase is **agents/** — workflows, handlers, skills, heartbeats, context files

**First actions:** Read workspace context (heartbeat.md, todo.md, journal.md) BEFORE bash commands. Orient first, act second. First 3-5 tool calls must be read/ls/grep.

## ⚡ [BEFORE RUNNING ANY COMMAND]

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

- These are all from other agents, not my changes. No deliverables to verify. (source: s_1776856000476_291, 2026-04-22)
- The only file I modified was `agents/tech-lead/last-session.md` (an auto-generated session file, not project code). Let me confirm no project source files were changed: (source: s_1776866405008_0, 2026-04-22)
- All tests pass. The code is working correctly. There are no bugs to fix. (source: s_1776866363397_0, 2026-04-22)
- Tests pass. All 23 tests pass. No bugs to fix. (source: s_1776866310838_0, 2026-04-22)
- All 23 tests already pass with 0 failures. (source: s_1776866184583_0, 2026-04-22)
- All 23 tests pass even with the environment's source files. The tests were already passing from the start - the data/test files just needed to be in place. (source: s_1776865789670_0, 2026-04-22)
- The root grades.js doesn't have the same file. The scenario environment is the authoritative location. All 23 tests pass there. (source: s_1776865660272_0, 2026-04-22)
- The source files are identical — this is the right scenario. And all 23 tests pass. The environment was just missing the `data/` and `test/` directories which needed to be copied from the scenario. (source: s_1776865247429_0, 2026-04-22)
- Clean build — zero errors. Let me commit: (source: s_1776876731617_1, 2026-04-22)
- Both handlers import successfully. (source: s_1776875972029_2, 2026-04-22)
- Bundle is gitignored - that's fine, it's a build artifact. The rebuild is done locally. (source: s_1776882131635_14, 2026-04-22)
- The src/ change is only to a `.d.ts` file - type definitions only, no runtime impact. The bundle doesn't need rebuilding for this.
- **TypeScript**: 0 errors ✅
- **Build**: Bu (source: s_1776878531628_7, 2026-04-22)
- Code looks well-structured and well-documented. Everything is healthy. (source: s_1776965805855_1375, 2026-04-23)
