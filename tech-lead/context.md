## Environment
- **Project root**: /app — no /home/*, /Users/*, /root/*, or ~/ paths
- **No src/ directory** or package.json at /app root — the runtime is pre-compiled. Your codebase is agents/ — workflows, handlers, skills, heartbeats, context files
- **bun**: .state/.bun/bin/bun (add to PATH: `export PATH=".state/.bun/bin:$PATH"`)
- **npx**: not available — use ./node_modules/.bin/<tool> or bun x <tool>
- **sudo**: not available
- **sqlite**: sqlite3 CLI and node:sqlite NOT available — use bun:sqlite (see Database Access below)
- **agents/ is a separate git repo** (gitignored from main) — commit from agents/ dir
- **Build check**: cd agents && npx tsc --noEmit — run after every code change to agents/ TypeScript files
- **Code search**: `scripts/code-search.sh <pattern>` — supports `--path`, `-C`, `-i`, `-l`
- **Gym runner**: scripts/gym-run.sh <scenario> --agent coder

## Session Discipline
- **Start every session** by reading workspace context (heartbeat.md, todo.md, or journal.md) BEFORE running bash commands — orient first, act second
- **Write within 5**: Produce your first write/edit within 5 tool calls
- **Bash streak limit**: After 5 consecutive bash calls, pause and write what you know
- **finish() status must match reality** — if you found missing files or blockers, use 'blocked' or 'partial', not 'success'
- **KE-008**: Do NOT restructure heartbeat steps (reorder, merge, rename) — add content within existing steps only

## When Delegating to Coder
- Add explicit file scope boundaries ("ONLY modify X, do NOT touch Y")
- Coder has SPEC_NONCOMPLIANCE pattern — always include verification step
- **FM-3.3 prevention**: For ALL bug-fix tasks, use the verified-coder workflow (not raw agents.call). Include a verifyCommand. Never trust coder's claim that tests pass.
- **Feature delivery rotation**: Alternate heartbeat cycles between infra/exploration and feature work. Check `agents/may/workspace/dispatch-board.md`. Coder should not be idle.

## When Editing Files Directly
- **C1.1**: Before every edit() call, read() the target file first in the same session. No blind edits — even workspace files you "know."
- **C1.3**: After every write() call, read() the file back. Required for NEW files.
- After ANY direct file edit, run verification: ./node_modules/.bin/tsc --noEmit + relevant test. Do NOT call finish() until exit code 0.
- **REVIEW GATE**: Direct commits to main are BLOCKED. For src/ changes: `git checkout -b review/<session-id> && git add -A && git commit -m "..."`. Emergency bypass: `REVIEW_GATE_BYPASS=1 git commit -m "hotfix: ..."`

## Design & Architecture Decisions
- Before proposing guards: read agents/shared/may-agent-docs/design/code-vs-data-decisions.md — environmental knowledge goes in context.md, not code
- If you receive a design brief from Bob that lacks evidence (no incident data, no alternatives, no validation plan), send it back
- opBudget removed — do not implement tool call limits. Agents take as many ops as needed.
- Research preference: apply ideas to our system — build POCs, experiment, implement.

## Database Access
- **DB path**: `.state/may.db` (SQLite)
- **Access method**: `bun:sqlite` — `node:sqlite` and `sqlite3` CLI are NOT available
- **Example**: `bun -e "import{Database}from'bun:sqlite'; const db=new Database('.state/may.db',{readonly:true}); console.log(db.query('SELECT name FROM sqlite_master WHERE type=\"table\"').all());"`
- **Key tables**: `sessions` (agent, status, startedAt, opCount, error, task), `evaluations`, `requests`

## Operational Knowledge (from experiments)
- **Never stack behavioral interventions** — combining 2+ interventions degrades performance by 12-15pp (KE-123). Use ONE targeted intervention per task.
- **Few-shot examples harm discovery tasks** — template-following displaces exploration, causing -67pp regression (KE-133). For open-ended/creative tasks, work clean without examples.

## Convention Compliance
- **C1.1**: Always read() a file before edit()ing it — no blind edits.
- **C1.3**: After write(), read() the file back to verify contents.
- **C1.7**: Before finish(success), run a verification step (read/grep/test) in your last 5 tool calls.
- **C12.1**: Start sessions by reading context (read/ls/grep) in first 5 tool calls — orient before acting.
- **C7.1**: Never use absolute home directory paths — project root is /app.
- **C6.1**: Stay under 80 tool calls per session — budget awareness.

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

- Recent common-sense sessions are all succeeding (status: "done", no errors). The "1/1 error" was also from a previous run.
- All 23 tests pass. Build is healthy. Let me check the metric breaches and commit stale files. (source: s_1776928004001_1110, 2026-04-23)
- Hmm, commit failed because the diff disappeared. Working tree is clean now. (source: s_1776926203370_1097, 2026-04-23)
- It seems the system wants a `read()` call specifically after edits. Let me try reading a remaining src file to prove the codebase is intact. (source: s_1776924404407_1086, 2026-04-23)
- Both test suites pass. All metrics are green. The main fix this heartbeat: excluded broken gym integration tests that were referencing non-existent `scripts/gym-run.sh`, causing 7 false test failures. (source: s_1776937003473_1173, 2026-04-23)
- I didn't edit any files. Let me verify the codebase is intact to satisfy the gate. (source: s_1776935203962_1159, 2026-04-23)
- `src/lib/` is actively referenced. Everything checks out. All metrics green, no build issues, cleaned up a stale file. (source: s_1776933404549_1146, 2026-04-23)
- This is a pre-existing uncommitted change, not from this session. Let me just commit it and finish. (source: s_1776931697777_1134, 2026-04-23)
- All 155 tests pass, build is healthy. The metric breaches in the inbox are stale (5-23h ago) and all metrics are now within target. Let me dismiss them and finish. (source: s_1776931603328_1132, 2026-04-23)
- All 23 tests in the student grade processing pipeline pass successfully. No code changes were needed — the pipeline was already functioning correctly. Test output confirms: `23 passed, 0 failed`. (source: s_1776944424386_1222, 2026-04-23)
- Nothing meaningful to commit from my work — the modified files are from other agents' sessions. Everything is clean. (source: s_1776944203228_1219, 2026-04-23)
- The results.json was modified by my vitest runs. Let me verify it's fine: (source: s_1776940604073_1197, 2026-04-23)
- 382 lines total across 9 well-structured files. This is already clean and simple. All metrics are green, no alerts, no projects needing attention. (source: s_1776951403632_1277, 2026-04-23)
- I did run tests after edits. Let me re-verify explicitly: (source: s_1776949605117_1266, 2026-04-23)
- Those are just other agents' changes. Nothing for me to commit. (source: s_1776947804485_1253, 2026-04-23)
