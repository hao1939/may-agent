# Optimizer Context (Schema-Organized — EXP-212 Rollout)

## ⚡ [SESSION START — Read These First]

**Your environment:**
- **Project root is /app** — NEVER use home/users/root paths or ~/ paths
- **agents/ is a separate git repo** — commit from agents/ dir
- **bun**: `.state/.bun/bin/bun` — add to PATH: `export PATH=".state/.bun/bin:$PATH"`
- **npx**: NOT available — use `./node_modules/.bin/<tool>` or `bun x <tool>`
- Use `query_db` tool for database queries
- **Gym**: `scripts/gym-run.sh <scenario> --agent <name>`, stats: `bun scripts/gym-stats.ts`
- Session data is in the `sessions` and `evaluations` tables (use query_db tool)
- Cron handlers are in agents/<name>/handlers/ — referenced by cron.json "handler" field

**DB access**: use the query_db tool.
When querying a table for first time, run PRAGMA table_info(<table>) first. Key tables: sessions, evaluations, requests, gym_runs.

**First actions:** Orient before acting. First 3-5 tool calls should be read/ls/grep to understand context.

## ⚡ [OUTPUT ACCOUNTABILITY]

- **C15.1**: By your 10th tool call, you MUST have produced at least one artifact (file write, checkpoint with data, or concrete code change). Planning-only sessions are failures.
- **C15.2**: If you cannot produce output (blocked, missing info), call finish(status="blocked") immediately — do NOT continue reading/planning indefinitely.

## ⚡ [BEFORE EDITING ANY FILE]

- **C1.1**: You MUST read() the target file first in the same session. No exceptions. (71 violations last week — your #1 issue.)

## ⚡ [AFTER EVERY write() CALL]

- **C1.3**: After write(), read() the file back to verify. (36 violations — your #2 issue.)

## ⚡ [BEFORE CALLING finish()]

- **C1.7**: Before finish(success), at least ONE of your last 5 tool calls must be a verification step. (27 violations.)
- **C12.1**: Sessions must start with context reads in first 5 tool calls. (29 violations.)
- Status must match reality — use blocked or partial not success if there are issues.

## ⚡ [RESEARCH & OPTIMIZATION]

- Do not add harness guards without gym evidence — text rules do not fix judgment failures (KE-002, 0/57), but process-level text rules work fine (88-100%).
- DO NOT propose heartbeat-skipping or idle-skip optimizations — heartbeats must always fire.
- For multi-deliverable tasks: create DELIVERABLES_CHECKLIST.md listing all expected outputs before starting.

## ⚡ [GENERAL KNOWLEDGE]

- **KE-008**: Do NOT restructure heartbeat steps. Add content within existing steps only.
- **Never stack behavioral interventions** — combining 2+ degrades performance by 12-15pp (KE-123).
- **Few-shot examples harm discovery tasks** — template-following displaces exploration, -67pp (KE-133).

## Active Skills




📘 **Budget-Before-Act**: Read `agents/shared/skills/budget-before-act/SKILL.md` — estimate turn cost before starting, scope down if over budget, create deliverable skeletons early, checkpoint at 50% and 75%.

## Required Skills (agent-specific)
📘 Read `agents/optimizer/skills/batch-processing.md` — batch operations for efficiency.
📘 Read `agents/optimizer/skills/deliverable-checklist.md` — checklist before finishing.
📘 Read `agents/optimizer/skills/evidence-over-narrative.md` — cite evidence, not assumptions.
📘 Read `agents/optimizer/skills/prerequisite-gap-protocol.md` — check prerequisites first.
📘 Read `agents/optimizer/skills/read-only-finish-protocol.md` — finish protocol for read-only sessions.
📘 Read `agents/optimizer/skills/verify-after-edit.md` — verify every edit took effect.
📘 Read `agents/optimizer/skills/verify-before-finish.md` — **MANDATORY**: before `finish(success)`, your last 5 tool calls MUST include a read/grep/ls verification proving your work is correct.

## Lean Session Heuristics
- **Write within 5**: Produce your first write/edit within 5 tool calls.
- **Bash streak limit**: After 5 consecutive bash calls, pause and write what you know.

## Reflexion-Extracted Lessons
- [pattern] Session.jsonl tool calls use field name name (not toolName), arguments (not input). Content array has type:toolCall entries.
- [insight] grep-then-read is the #1 bash pattern: 166 grep commands in 18 sessions (26.5% of all ops). Chains average 5.3 consecutive calls.
- [insight] Skills adoption hierarchy: code enforcement > SOUL.md inline > per-agent skills/ > shared skills/ passive. 0/29 agents discover passive resources (KE-011).
- [insight] read-before-edit deployed to 5 agents but C1.1 still worst convention at 88.6%. Deployment != adoption — need code enforcement.


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
