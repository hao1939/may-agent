## Structured Work Protocol (MANDATORY)
Before making >3 tool calls toward one objective, write:
GOAL: [one sentence] | PLAN: [steps] | DONE WHEN: [verification]
Then execute. Skip for pure status checks.

**QUALITY RULE**: Heartbeats are for judgment and useful action, not artifact
or tool-call quotas. Write/edit when it carries value; otherwise finish with
concise evidence instead of padding a status file.

---

## Environment
- bun: `.state/.bun/bin/bun`. No npx — use `bun x`. No sudo.
- Project root: /app. App-owned agents live under `projects/may-agent.app/agents/`. No src/ or package.json at root.
- query_db tool for DB. Gym: `cd /app/projects/may-agent && GYM_AGENTS_ROOT=/app/projects/may-agent.app/agents GYM_SCENARIOS_DIR=/app/gym/scenarios bash test/gym/run-gym.sh <scenario> --timeout 10`
- Batch gym: `cd /app/projects/may-agent && GYM_AGENTS_ROOT=/app/projects/may-agent.app/agents GYM_SCENARIOS_DIR=/app/gym/scenarios scripts/gym-batch.sh` (--variants, --trials N, --tier/--category)

## Conventions (MANDATORY)
- **C1.1**: read() before edit(). **C1.3**: read() after write(). **C1.7**: verify in last 5 calls before finish(success). **C12.1**: first 3-5 calls = read/ls/grep.
- finish() status must match reality. Budget: ≤80 tool calls (C6.1).

## Key Research Findings
- SOUL.md text changes don't fix judgment failures (0/18) — use workflow enforcement
- **Never stack interventions** — 2+ degrades by 12-15pp (KE-123)
- **Few-shot examples harm discovery tasks** — -67pp (KE-133)
- **KE-180**: Analysis gates HARM — agents feel done after writing analysis, skip fix. Gate on SOLUTION not report.
- **KE-182**: Hard gate rules: artifact=solution, product-quality metrics, 2-phase for multi-step.
- **KE-008**: Don't restructure heartbeat steps. Add content within existing steps only.

## Research Preferences
- Priority: skills with matching gym scenarios
- Gym scenarios cost $0.05-0.15 each. Bimodal pass rates (0% or 100%).
- Growth cycle: fork → patch → gym test → promote if improved.
- Federation: Coach on k3s, artifacts must be committed to git.

## Required Skills
📘 `projects/may-agent.app/agents/coach/skills/evidence-over-narrative.md`, `infrastructure-map.md`, `log-error.md`
📘 `projects/may-agent.app/agents/coach/skills/verify-after-edit.md`, `verify-before-finish.md`, `context-rule-gym-ceiling.md`
📘 `projects/may-agent.app/agents/coach/skills/work-session-scaffold.md` — Phase 0-4 for work sessions.
📘 `shared/skills/terminal-state-check.md` — **MANDATORY**: check project status in first 3 calls, exit immediately if closed
📘 `shared/skills/retry-aware-dispatch/` — Before dispatching multi-session tasks, check prior attempts. After 5 failures, STOP and write blocker report.

## Hao's Preferences
Stability-first, guards stay strong, quality>quantity, observability, knowledge APPLIED not stored, convention-driven, consolidation, automate monitoring, agent identity, knowledge hygiene.
P11: Never coast—target met means raise the bar. P12: Learning loop (reproduce→explore→verify→adopt→track). P13: Prove before adopt—gym verification before promoting changes. P14: Recurring issue → create a project, not a report. P15: Discuss designs with peer agents before finalizing. P16: Force a second what's-wrong pass on every review.

## Shared Toolkit
See `shared/README-shared-toolkit.md`.

[SIG: 1777642137:085e1085]


## Pre-Work Discovery Check
Before starting new work, check for existing deliverables:
```bash
grep -i "<keyword>" /app/projects/cross-agent-collaboration/outputs/shared-output-manifest.md
```
If a related output exists, read it first to avoid duplicating work.

## Verification Evidence Format (EXP-267)
When calling finish(success), each verification_evidence item MUST follow this format:
"Step N: <tool>(<key_arg>) showed <specific_result>"

Examples:
- "Step 12: read(src/app.ts) confirmed export function handleRequest exists at line 34"
- "Step 8: bash(bun test) exit code 0, 14 tests passed"
- "Step 15: bash(grep -c 'TODO' file.ts) returned 0 — no TODOs remain"
