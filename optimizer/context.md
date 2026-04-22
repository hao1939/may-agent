- npx is not available in this environment — use ./node_modules/.bin/<tool> or bun x <tool>
- bun is at .state/.bun/bin/bun — add to PATH: `export PATH=".state/.bun/bin:$PATH"`
- sqlite3 CLI is NOT available — see **Database Access** section below
- Gym runner: scripts/gym-run.sh <scenario> --agent <name>
- Gym stats: bun scripts/gym-stats.ts
- agents/ is a separate git repo — commit from agents/ dir
- Session data is in .state/may.db sessions + evaluations tables, not filesystem scans
- Cron handlers are in agents/<name>/handlers/ — referenced by cron.json "handler" field
- Don't add harness guards without gym evidence — text rules don't fix *judgment* failures (KE-002, 0/57), but process-level text rules work fine (88-100% compliance for conventions like C2.1, C1.5)
- Project root is /app — do not use /home/*, /Users/*, /root/*, or ~/ paths (they don't exist in this environment)
- When calling finish(), status must match reality — if you found missing files or blockers, use 'blocked' or 'partial', not 'success'
- Research preference: workflows and efficiency — we believe workflows are very valuable for structuring agent work. Evaluate them, measure impact, design better ones. But not limited to this.
- DO NOT propose heartbeat-skipping or idle-skip optimizations. We tried this (shouldSkipIdleHeartbeat, hasPendingWork, skipIfIdle) and removed it — heartbeats must always fire. The cost savings aren't worth the missed initiative work and complexity. If you see "waste" from heartbeats finding nothing to do, that's acceptable — the value is in the heartbeats that DO find work.
- For multi-deliverable tasks: after reading context files, create DELIVERABLES_CHECKLIST.md listing all expected outputs before starting execution. Check items off as you go. A production guard enforces this — finish(success) is blocked without it. See skills/deliverable-checklist.md for details.
- **KE-008**: Do NOT restructure heartbeat steps (reorder, merge, rename). Heartbeat regressions are caused by structural changes, not content. Add content within existing steps only.

## Lean Session Heuristics
- **Write within 5**: Produce your first write/edit within 5 tool calls. Start with a skeleton, fill in details. Lean sessions write at position 3-4; bloated sessions delay writing until position 54+.
- **Bash streak limit**: After 5 consecutive bash calls, pause and write what you know. Lean sessions max out at 3-7 consecutive bash calls; bloated sessions streak 13-31.

## Database Access
- **DB path**: `.state/may.db` (SQLite)
- **Access method**: `bun:sqlite` — `node:sqlite` and `sqlite3` CLI are NOT available
- **Example**: `bun -e "import{Database}from'bun:sqlite'; const db=new Database('.state/may.db',{readonly:true}); console.log(db.query('SELECT name FROM sqlite_master WHERE type=\"table\"').all());"`
- **npx** is NOT available — use `bun -e "..."` for inline scripts
- **Defensive practice**: When querying a table for the first time in a session, run `PRAGMA table_info(<table>)` first to confirm column names. Do NOT guess column names (e.g., `id` vs `sessionId`).
- **Key table schemas** (PK marked with *):
  - `sessions`: *sessionId, agent, task, status, kind, source, parentSessionId, requestId, workflowRunId, startedAt(INT), endedAt(INT), error, outcome, opCount(INT)
  - `evaluations`: *sessionId, agent, quality(REAL), efficiency(REAL), productiveCalls(INT), wastedCalls(INT), verdict, issues, overall, usage, failureChains, evaluatedByHeuristic(INT), skippedByJs(INT), createdAt(INT)
  - `requests`: *requestId, parentRequestId, fromEntity, toAgent, method, task, status, sessionId, createdAt(INT), updatedAt(INT), completedAt(INT), durationMs(INT), summary, error, errorClass, retryable(INT), artifact, context, expectations, notify, source
  - `gym_runs`: *id(INT), timestamp, agent_name, lab_fork, scenario, passed(INT), duration_ms(INT), score_summary, session_id, cost_usd(REAL), total_ops(INT), total_turns(INT), method, prompt_hash, framework_sha, model, batch_id, run_tag, categories, tags, tier, transcript
- **Quoting for bun -e**: Use double quotes for the outer shell string, single quotes for SQL strings inside. For complex queries, use a heredoc: `bun -e "$(cat <<'SCRIPT' ... SCRIPT)"`

- Always `read()` a file before `edit()` — even files you just created earlier in the session. The C1.1 convention checker flags any edit without a prior read. (71 violations last week — your #1 issue.)
- **C1.3 verify-writes**: After every write() call, read() the file back to verify. (36 violations last week.)
- **C1.7 verification-evidence**: Before finish(success), run a verification step (read/grep/test) in your last 5 tool calls. (27 violations.)
- **C12.1 session-start**: Start sessions by reading context (read/ls/grep) in first 5 tool calls — orient before acting. (29 violations.)
- **C7.1**: Never use /home/*, /Users/*, ~/  paths — project root is /app. (17 violations.)

## Operational Knowledge (from experiments)
- **Never stack behavioral interventions** — combining 2+ interventions degrades performance by 12-15pp (KE-123). Use ONE targeted intervention per task.
- **Few-shot examples harm discovery tasks** — template-following displaces exploration, causing -67pp regression (KE-133). For open-ended/creative tasks, work clean without examples.


## Reflexion-Extracted Lessons
- [pattern] Session.jsonl tool calls use field name 'name' (not 'toolName') for tool identification, and 'arguments' (not 'input') for parameters. The content array has type:'toolCall' entries.
- [insight] grep-then-read is the #1 bash pattern in agent sessions: 166 grep commands in 18 sessions (26.5% of all ops). Chains average 5.3 consecutive calls, following a fixed 4-step escalation: find files → find lines → get context → cross-reference.
- [pattern] rg --json output mode provides structured machine-readable results that are much easier to parse than grep text output. rg is available at .state/.gemini/tmp/bin/rg (v13.0.0).
- [insight] Skills adoption follows a strict hierarchy: code enforcement (handlers/guards) > SOUL.md inline text > per-agent skills/ dir deployment > shared skills/ passive availability. Each level down has dramatically less behavioral impact. 0/29 agents discover passive resources (KE-011).
- [insight] read-before-edit is deployed to 5 agents (most-deployed after verify-after-edit) but C1.1 is still worst convention at 88.6%. QA at 61.4% DESPITE having the skill. Deployment ≠ adoption — need matching code enforcement to close the gap.
- [pattern] For skills adoption audit: check 4 channels (handler code refs, SOUL.md inline, per-agent skills/ deployment, shared/ passive) and cross-reference with convention_checks pass rates to see if deployment translates to behavior change.
