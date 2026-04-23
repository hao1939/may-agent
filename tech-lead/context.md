- Start every session by reading your workspace context (heartbeat.md, todo.md, or journal.md) BEFORE running bash commands — orient first, act second
- bun is at .state/.bun/bin/bun — add to PATH: `export PATH=".state/.bun/bin:$PATH"`
- npx is not available in this environment — use ./node_modules/.bin/<tool> or bun x <tool>
- sudo is not available
- sqlite3 CLI and node:sqlite are NOT available — see **Database Access** section below
- There is NO src/ directory or package.json in /app root. The runtime is pre-compiled. Your codebase is agents/ — workflows, handlers, skills, heartbeats, context files
- Build check: cd agents && npx tsc --noEmit — run after every code change to agents/ TypeScript files
- agents/ is a separate git repo (gitignored from main) — commit agent changes from agents/ dir
- When delegating to coder: add explicit file scope boundaries ("ONLY modify X, do NOT touch Y")
- Coder has SPEC_NONCOMPLIANCE pattern — always include verification step in delegated tasks
- Code search: use `scripts/code-search.sh <pattern>` for searching code — replaces manual grep/find chains. Supports `--path`, `-C` (context lines), `-i`, `-l` (files-only). Examples: `scripts/code-search.sh 'Database' --path 'src/**/*.ts'`
- Gym runner: scripts/gym-run.sh <scenario> --agent coder
- Project root is /app — do not use /home/*, /Users/*, /root/*, or ~/ paths (they don't exist in this environment)
- When calling finish(), status must match reality — if you found missing files or blockers, use 'blocked' or 'partial', not 'success'
- Before proposing guards: read agents/shared/may-agent-docs/design/code-vs-data-decisions.md — environmental knowledge goes in context.md, not code
- If you receive a design brief from Bob that lacks evidence (no incident data, no alternatives considered, no validation plan), send it back — don't implement it
- **Feature delivery rotation**: Alternate heartbeat cycles between infra/exploration and feature work. Check `agents/may/workspace/dispatch-board.md` for pending items. Coder should not be idle — if there are features to build, fork coder to build them.
- opBudget removed — do not implement tool call limits. Agents should take as many ops as needed.
- Research preference: apply ideas to our system — investigate which tech/theory/skill/workflow can improve our learning and research capabilities. Build POCs, experiment, implement. But not limited to this.
- FM-3.3 prevention: For ALL bug-fix delegation tasks, use the verified-coder workflow (not raw agents.call). Include a verifyCommand that runs the relevant test. Never trust coder's claim that tests pass — the workflow runs the command itself and loops on failure.
- After ANY direct file edit (not delegated), run verification yourself: ./node_modules/.bin/tsc --noEmit + relevant test file. Do NOT call finish() until you have exit code 0 from a verification command in your own session.
- C1.1 convention: Before every edit() call, you MUST read() the target file first in the same session. Never edit a file you haven't read — even workspace files you "know" the contents of. This applies to ALL files: source code, workspace docs, project files.
- C1.3 convention: After every write() call, you MUST read() the file back. write() now shows a diff for existing-file overwrites (deployed 2026-04-07), but read-back is still required for NEW files. Your pass rate improved from 50.9% → 98.6% — keep it up.
- REVIEW GATE: Direct commits to main are BLOCKED by a pre-commit hook. For src/ changes, use: `git checkout -b review/<session-id> && git add -A && git commit -m "..."`. To bypass in emergencies: `REVIEW_GATE_BYPASS=1 git commit -m "hotfix: ..."`. Review branches get checked (tsc + vitest) and reviewed before merging to main.
- **KE-008**: Do NOT restructure heartbeat steps (reorder, merge, rename). Heartbeat regressions are caused by structural changes, not content. Add content within existing steps only.

## Lean Session Heuristics
- **Write within 5**: Produce your first write/edit within 5 tool calls. Start with a skeleton, fill in details. Lean sessions write at position 3-4; bloated sessions delay writing until position 54+.
- **Bash streak limit**: After 5 consecutive bash calls, pause and write what you know. Lean sessions max out at 3-7 consecutive bash calls; bloated sessions streak 13-31.

## Database Access
- **DB path**: `.state/may.db` (SQLite)
- **Access method**: `bun:sqlite` — `node:sqlite` and `sqlite3` CLI are NOT available
- **Example**: `bun -e "import{Database}from'bun:sqlite'; const db=new Database('.state/may.db',{readonly:true}); console.log(db.query('SELECT name FROM sqlite_master WHERE type=\"table\"').all());"`
- **Key tables**: `sessions` (agent, status, startedAt, opCount, error, task), `evaluations`, `requests`
- **npx** is NOT available — use `bun -e "..."` for inline scripts

## Operational Knowledge (from experiments)
- **Never stack behavioral interventions** — combining 2+ interventions degrades performance by 12-15pp (KE-123). Use ONE targeted intervention per task.
- **Few-shot examples harm discovery tasks** — template-following displaces exploration, causing -67pp regression (KE-133). For open-ended/creative tasks, work clean without examples.


## Reflexion-Extracted Lessons
- [insight] agents-auto-commit.ts runs every 10min (not 2h as the code comment says). 709 lines. All 3 critical fixes from the April 11 fragility audit are applied. 986 successful runs, 0 failures.
- [insight] The dispatch board 'P1 federation sync data loss' is stale as of 2026-04-12 — the April 8-11 fixes resolved the actual data loss scenarios. K3s.json heartbeat still missing (k3s instance doesn't write it), but sync itself works.
- [pattern] When re-auditing a previously-analyzed system, check fix status first before re-investigating. All 3 critical fixes were already applied, making this a verification session rather than a discovery session.
- [insight] Code merged to main doesn't take effect until the compiled binary (/usr/local/bin/may-agent) is rebuilt. The running process (PID 65829, started Apr 9) predates recent fixes. Periodic cleanup scripts are needed to compensate for the stale binary.
- [pattern] To diagnose whether a code fix is actually running: check process start time (ps aux) vs fix merge time (git log). If process predates fix, the compiled binary is stale.

## Convention Compliance Reminders
- **C1.1**: Always read() a file before edit()ing it — no blind edits.
- **C1.3**: After write(), read() the file back to verify contents.
- **C1.7**: Before finish(success), run a verification step (read/grep/test) in your last 5 tool calls.
- **C12.1**: Start sessions by reading context (read/ls/grep) in first 5 tool calls — orient before acting.
- **C7.1**: Never use absolute home directory paths — project root is /app.
- **C6.1**: Stay under 80 tool calls per session — budget awareness.


## Learned from experience

- The TODOs are all in skill documentation (examples), not real code. The codebase is clean. Metrics are all green, no alerts, tests pass. The metric breaches from 8-10h ago appear to have already resol (source: s_1776884803310_772, 2026-04-22)
- Good — no more `readonly` in the file. (source: s_1776883084265_758, 2026-04-22)
- 31 near-duplicate "bob: verified all tests pass" commits. That's noise pollution in the git history. Let me update my session notes and dismiss the alerts. (source: s_1776883003310_756, 2026-04-22)
- Confirmed: the `db.exec("PRAGMA journal_mode=WAL")` line is gone, and the readonly Database open is immediately followed by closing the block. (source: s_1776881308465_748, 2026-04-22)
- All source files are used by pipeline.js. Build is healthy, tests pass, no dead code. The codebase is clean and simple.
- The compliance-check handler is functioning correctly. It compiles cleanly, all imports resolve, and it runs to completion producing expected output. (source: s_1776892078804_827, 2026-04-22)
- Seems like other agents are writing files concurrently. Let me commit in a loop. (source: s_1776892003278_825, 2026-04-22)
- Same situation as last time. Everything green, stale breaches. Quick commit and done. (source: s_1776890203318_813, 2026-04-22)
- Everything is clean. Metrics all green, no build errors, no active projects, src/ modules all load fine. The two metric breach events from 9-11h ago are stale — metrics have recovered. I'll dismiss th (source: s_1776888403322_800, 2026-04-22)
- The handler works correctly now — I just tested it successfully. The 2/2 errors were from before the recent fixes (3 commits fixing missing ctx properties and DB access mode). The handler is already f (source: s_1776901104466_927, 2026-04-23)
- I didn't modify any files — this was a read-only heartbeat check. Let me re-verify: (source: s_1776901003132_925, 2026-04-23)
- I see it — line 331 of `activity.jsonl`: "Convention-check cron has 2/2 errors but no logs accessible. It's a non-critical cron — likely a tsc-related check that fails because of the environment. Not  (source: s_1776899296382_915, 2026-04-23)
- Other agents keep modifying files. Let me just commit and finish quickly. (source: s_1776899203296_913, 2026-04-23)
- The handler works fine. The 2/2 errors were already fixed by the 3 commits shown in git log. The heartbeat at 16:06 already confirmed it was transient. There's nothing left to fix. (source: s_1776897442917_901, 2026-04-23)
- All clear. Metrics green, no build issues, no dead code in src/, all modules used. The two metric breaches from 11-13h ago are stale (metrics recovered). Amy's no-op commits were already addressed wit (source: s_1776897403386_896, 2026-04-23)
