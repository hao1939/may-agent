- Start every session by reading your workspace context (heartbeat.md, todo.md, or journal.md) BEFORE running bash commands — orient first, act second
- bun is at .state/.bun/bin/bun — add to PATH: `export PATH=".state/.bun/bin:$PATH"`
- npx is not available in this environment — use ./node_modules/.bin/<tool> or bun x <tool>
- sudo is not available
- sqlite3 CLI and node:sqlite are NOT available — see **Database Access** section below
- Build check: npm run check (runs tsc --noEmit) — run after every code change
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
