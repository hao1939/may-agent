# Optimizer Context

## ⚡ Environment

- **Project root**: /app — never use ~/
- **agents/**: separate git repo
- **bun**: `.state/.bun/bin/bun` (add to PATH)
- **npx**: NOT available — use `./node_modules/.bin/<tool>` or `bun x`
- **DB**: use `query_db` tool. Run `PRAGMA table_info(<table>)` first. Tables: sessions, evaluations, requests, gym_runs.
- **Gym**: `scripts/gym-run.sh <scenario> --agent <name>`
- **Cron handlers**: agents/<name>/handlers/ — referenced by cron.json

## ⚡ Session Protocol (MANDATORY)

First output every session:
```
GOAL: [one sentence]
PLAN: 1. ... 2. ... 3. ...
DONE WHEN: [verifiable criteria]
```

Rules:
- ≥8 substantive tool calls before finish()
- ≥1 write/edit call before finish(success) — else use finish(blocked)
- Write within first 5 tool calls. After 5 consecutive bash, write what you know.
- By 10th tool call, must have produced an artifact (C15.1)

## ⚡ Quality Gates

- **C1.1**: MUST read() target file before editing (your #1 violation)
- **C1.3**: After write(), read() back to verify (#2 violation)
- **C1.7**: Last 5 calls before finish must include verification
- **Confabulation**: NEVER report numbers without tool output. Say "not measured" if unsure.

## ⚡ Research Rules

- Text rules don't fix judgment failures (KE-002, 0/57) but process rules work (88-100%)
- Do NOT propose heartbeat-skipping — heartbeats must always fire
- Never stack 2+ behavioral interventions (degrades -12-15pp, KE-123)
- Few-shot examples harm discovery tasks (-67pp, KE-133)
- Do NOT restructure heartbeat steps (KE-008). Add within existing only.

## Active Skills

📘 `agents/shared/skills/budget-before-act/SKILL.md` — estimate cost, scope down, checkpoint at 50%/75%
📘 `agents/optimizer/skills/verify-before-finish.md` — **MANDATORY**: last 5 calls must include verification

## Hao's Preferences

1. Stability-first: fix existing before exploring new
2. Guards stay strong: never weaken without approval
3. Quality > quantity
4. Observability: make state visible
5. Knowledge must be APPLIED, not just stored
6. Convention-driven: use shared conventions
7. Consolidation: fewer rich files > many thin ones
8. Automate monitoring: if checked twice manually → cron job
9. Respect agent role boundaries
10. Knowledge hygiene: read before writing shared files

## Pre-Work Discovery Check

Before starting any new analysis or optimization task:
```bash
grep -i "<relevant-keyword>" /app/agents/shared/projects/cross-agent-collaboration/outputs/shared-output-manifest.md
```
If a related deliverable exists, read it first to avoid duplicating work. The manifest indexes 40+ reusable outputs across all projects with tags and descriptions.

## Shared Toolkit

See `agents/shared/README-shared-toolkit.md` for utilities at `agents/shared/lib/`.
