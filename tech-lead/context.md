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

- **Build**: Clean, zero TS errors
- **Tests**: All pa (source: s_1777072122539_629, 2026-04-25)
- The workspace is in good shape. Product search tests all pass (10/10). The grade pipeline task references files that don't exist in this workspace (no `data/`, no `test/test.js`, no `src/policy.js`).  (source: s_1777070322250_591, 2026-04-25)
- All tests pass. The two tasks assigned to me (428cdc81 product search, 9da5556a grade pipeline) — the product search is already working, and the grade pipeline files aren't present in this environment (source: s_1777068522448_553, 2026-04-25)
- OK, I have a clear picture. Let me summarize and finish. (source: s_1777081123148_783, 2026-04-25)
- Clean — those are just regex patterns for detecting TODOs, not actual TODOs. The codebase is healthy. (source: s_1777077522854_740, 2026-04-25)
- Build clean. Now commit: (source: s_1777088323231_824, 2026-04-25)
- All 145 tests pass. Build clean, no TS errors. Let me update my summary and commit. (source: s_1777084722400_805, 2026-04-25)
- Now let me update my heartbeat summary with inbox triage: (source: s_1777082923114_794, 2026-04-25)
- The finish-guard is **fully wired**. Both paths are active:
- That's from another session. The guard is likely tracking my bash commands and thinks I wrote files. Let me provide deliverables as empty since this was read-only: (source: s_1777100670501_12, 2026-04-25)
- These are KE deletions from another agent's work (bob's dedup). Let me just commit them as cleanup: (source: s_1777093721971_854, 2026-04-25)
- Everything looks healthy. Build is clean (zero TS errors), guards are properly registered and wired, no active requests pending, no TODOs in source. The inbox P0s about evaluator pipeline and duplicat (source: s_1777108805104_60, 2026-04-25)
- Everything looks healthy. Build clean, no TS errors, no TODOs in core lib, agent-sdk imports are correctly structured, no active requests needing attention. The P0 notifications from 10-18h ago about  (source: s_1777105205898_35, 2026-04-25)
- Guards are referenced from shared/agent-sdk.ts and other places — not orphans. The grep was failing due to path issues.

Summary: Build is clean, no active request backlog, all P0s appear resolved. Th (source: s_1777103404982_24, 2026-04-25)
