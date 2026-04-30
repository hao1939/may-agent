- npx is not available in this environment — use ./node_modules/.bin/<tool> or bun x <tool>
- bun is at .state/.bun/bin/bun — add to PATH: `export PATH=".state/.bun/bin:$PATH"`
- There is NO src/ directory or package.json in /app root. The runtime is pre-compiled. Your levers for improving agent behavior are: context.md files, heartbeat.md files, workflow configs, gym scenarios, and skills. Do NOT try to edit src/ files.
- Use `query_db` tool for database queries
- Gym runner: `cd /app/agents && export GYM_AGENT_BIN=/usr/local/bin/may-agent && bash test/gym/run-gym.sh <scenario> --timeout 10` (NOT scripts/gym-run.sh which doesn't exist)
- Gym batch runner: scripts/gym-batch.sh — run multiple scenarios at once with --variants, --trials N, --tier/--category filtering, and comparison summary. Use instead of manual gym-run.sh loops.
- Gym scenarios are in agents/gym/scenarios/
- Lab forks for experiments: agents/.lab/<fork-name>/
- SOUL.md text changes don't fix judgment failures (0/18 in experiments) — use workflow enforcement
- Growth cycle: fork → patch → gym test → promote if improved, discard if not. One change per cycle.
- agents/ is a separate git repo — use `git add` from agents/ dir
- Project root is /app — do not use /home/*, /Users/*, /root/*, or ~/ paths (they don't exist in this environment)
- **C1.1 read-before-edit**: You MUST read() every file before edit()ing it — even journal.md, tracker files, and files you "know". Your #1 violation (77 in last 7 days).
- **C1.3 verify-writes**: After every write() call, read() the file back to verify. Successful edit() is self-verifying (shows diff), but write() is not.
- **C1.7 verification-evidence**: Before calling finish(success), run at least one verification step (read/grep/ls/test) in your last 5 tool calls. 36 violations last week.
- **C12.1 session-start**: Start every session by reading context files (read/ls/grep) in your first 5 tool calls — orient before acting.
- When calling finish(), status must match reality — if you found missing files or blockers, use 'blocked' or 'partial', not 'success'
- ERROR_LOG files are at agents/*/ERROR_LOG.jsonl — NOT .state/error-log.jsonl
- Gym runner path is scripts/gym-run.sh — NOT test/gym/run-gym.sh
- Research preference: skills and behavioral training — test whether skills actually improve agent behavior, design better training methods. We believe skills are very valuable for agent abilities. But not limited to this.
- **KE-008**: Do NOT restructure heartbeat steps (reorder, merge, rename). Heartbeat regressions are caused by structural changes, not content. Add content within existing steps only.
- ANALYSIS EFFICIENCY: When querying data, write ALL queries in a single bun -e script. Do NOT write one bun script per question (this wastes 50+ ops/session). Plan your questions first, then batch them.
- **WORK SESSION SCAFFOLD**: For any `[WORK SESSION]`, follow the scaffold in `agents/coach/skills/work-session-scaffold.md` — Phase 0: EXTRACT deliverable/method/done-when. Phase 1: PLAN 3 steps max. Phase 2: EXECUTE with checkpoints at op 30/45/60. Phase 3: VERIFY deliverable exists before finish. Phase 4: FINISH with status matching reality. This prevents FM-2.6 (task-spec mismatch) and FM-3.3 (premature success claims).

## Operational Knowledge (from experiments)
- **Never stack behavioral interventions** — combining 2+ interventions degrades performance by 12-15pp (KE-123). Use ONE targeted intervention per task.
- **Few-shot examples harm discovery tasks** — template-following displaces exploration, causing -67pp regression (KE-133). For open-ended/creative tasks, work clean without examples.
- **KE-180 (Completion Illusion)**: Analysis gates HARM performance — agents write analysis docs, feel done, then skip the actual fix. NEVER use "write ANALYSIS.md" as a gate. Gate artifacts must produce the SOLUTION, not describe the problem. (Source: EXP-157, 0% pass with analysis gate vs 80% baseline.)
- **KE-182 (Hard Gate Design Rules)**: When designing hard gates: (1) artifact must be part of the solution, not a report about the problem; (2) use product-quality metrics (does the fix work?), not process metrics (did the agent write a file?); (3) for recognition-bottleneck tasks, gate on the recognition output (e.g., FIXED_TESTS.md with corrected code); (4) for multi-step tasks, use 2-phase investigate→fix with session boundary; (5) never gate implementation-bottleneck tasks (KE-054). See `agents/shared/knowledge/entries/KE-182-hard-gate-design-rules-synthesis.md`.


## Reflexion-Extracted Lessons
- [insight] EXP-016 baseline data is unreliable for current agent — 3/4 scenarios showed dramatically different pass rates in gym_runs system. Always use gym_runs table as authoritative source, not historical experiment reports.
- [insight] Gym scenario pass rates are extremely bimodal — scenarios cluster at 0% or 100% with very few in the 30-70% 'Medium' range. Finding Medium-difficulty scenarios is the hardest part of difficulty-bucketed experiment design.
- [fix] behavior-escalation-stubborn showed regime change from 0% (15 runs through Apr 1) to 100% (7 runs since Apr 11). Agent learned this behavior. Combined rate of 31.8% is misleading — do not use combined rates when there's a clear regime change.
- [pattern] To query gym data: use query_db({ sql: "SELECT * FROM gym_runs ..." })
- [pattern] IT completion rate went from 0% to 100% after embedding ITs directly into todo.md — placing action items where the agent naturally looks during heartbeat is the key to the reflection→action pipeline
- [insight] Federation design assigns Coach to k3s — all experiment artifacts must be committed to git, cross-instance dispatch is async (10 min delay), gym runs happen on k3s

## Mandatory Procedures

### BEFORE EVERY edit() CALL (C1.1 — 77 violations)
1. Stop. Ask: "Did I read() this exact file path already in this session?"
2. If NO → run read() on the file NOW, then proceed to edit().
3. If YES → proceed. The read() must be for the SAME path you're about to edit().
4. **No exceptions** — even for journal.md, tracker files, files you just wrote.

### AFTER EVERY write() CALL (C1.3 — 36 violations)
1. Immediately run read() on the file you just wrote.
2. Confirm the content matches what you intended.
3. Do NOT proceed to the next task until you've verified.

### BEFORE EVERY finish(success) (C1.7 — 36 violations)
1. Stop. Count your last 5 tool calls.
2. At least ONE must be a verification step (read/grep/ls/bash test).
3. If none exists → run a verification now (e.g., read the main deliverable file).
4. Only THEN call finish(success).

### SESSION START (C12.1)
1. Your first 3-5 tool calls MUST be read/ls/grep — orient before acting.
2. Do NOT run bash commands or create files until you've read your context.

## Convention Compliance Reminders
- **C1.1**: Always read() a file before edit()ing it — no blind edits.
- **C1.3**: After write(), read() the file back to verify contents.
- **C1.7**: Before finish(success), run a verification step (read/grep/test) in your last 5 tool calls.
- **C12.1**: Start sessions by reading context (read/ls/grep) in first 5 tool calls — orient before acting.
- **C7.1**: Never use absolute home directory paths — project root is /app.
- **C6.1**: Stay under 80 tool calls per session — budget awareness.


## Required Skills
📘 Read `agents/coach/skills/evidence-over-narrative.md` — cite evidence, not assumptions.
📘 Read `agents/coach/skills/infrastructure-map.md` — navigate system infrastructure.
📘 Read `agents/coach/skills/log-error.md` — error logging protocol.
📘 Read `agents/coach/skills/verify-after-edit.md` — verify every edit took effect.
📘 Read `agents/coach/skills/context-rule-gym-ceiling.md` — gym score ceiling rules.
📘 Read `agents/coach/skills/verify-before-finish.md` — **MANDATORY**: before `finish(success)`, your last 5 tool calls MUST include a read/grep/ls verification proving your work is correct.

## Learned from experience

(cleaned 2026-04-28 — 14 auto-generated entries were session monologue, not durable knowledge)


## Hao's Preferences (apply these in decisions)
1. **Stability-first**: fix existing before exploring new
2. **Guards stay strong**: never weaken constraints without explicit approval
3. **Quality > quantity**: fewer excellent outputs beat many mediocre ones
4. **Observability**: make system state visible, not hidden
5. **Knowledge must be APPLIED**: experiment with findings, deploy to production, don't just store
6. **Convention-driven**: use shared conventions, don't invent local patterns
7. **Consolidation**: fewer rich files > many thin ones. Remove obsolete. Deduplicate.
8. **Automate monitoring**: if you check it twice manually, add a cron job
9. **Agent identity**: respect role boundaries. Check agent's defined role before assigning.
10. **Knowledge hygiene**: never blind-overwrite. Read before writing shared files.

## Shared Toolkit
Shared utilities available at `agents/shared/lib/` — see `agents/shared/README-shared-toolkit.md` for all scripts and library modules (task-validator, iteration-monitor, regression-detector, project-template, session-analyzer, config-validator, workflow-metrics, etc.).
