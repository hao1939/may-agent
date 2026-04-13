# Archived Skills

Skills moved here during dead skill cleanup (2026-04-13).

## Why Archived

These skills were identified as dead weight by the skills-adoption-audit:
- **50% of skills** (29/58) were untested, disproven, or deployed with no production lift
- Per KE-011: 0/29 agents discover available resources — passive skills are invisible
- Per KE-002: 0/20+ text injection experiments succeeded — text rules don't fix judgment

## Categories

### `disproven/` — Gym-tested and shown not to work
- **classify-then-act** — ❌ 0% effect as text injection (EXP-017, EXP-032). 19th consecutive text-injection failure.
- **investigate-and-fix** — ❌ as text (0/4 reproduce-first). ✅ as workflow (2/2). Only the workflow variant works.
- **grep-first-reading** — ❌ as workflow (4/8, WORSE). ✅ as skill file injection (8/8). Deployed to coder as `efficient-file-reading.md`.

### `untested/` — Never gym-tested; most have ceiling effects (baseline already passes)
- **check-state** — ceiling (2/2 baseline 8/8 pass)
- **task-adherence** — ceiling (1/1 baseline 10/10 pass)
- **scope-discipline** — ceiling (1/1 baseline all-pass)
- **stale-approach-fixation** — ceiling (7/7 baseline pass)
- **search-strategy-escalation** — ceiling (6/6 baseline pass)
- **incremental-context-loading** — ceiling (7/7 after scorer fix)
- **brainstorm-before-build** — ceiling (5/5 baseline pass)

### `unreferenced/` — Standalone .md files with zero active references
- **constructive-friction.md** — 0 refs in code/prompts/heartbeat
- **critical-pause.md** — 0 active refs
- **experiment-before-apply.md** — 0 active refs
- **extract-directives.md** — 0 active refs
- **synthesis-dpir.md** — 0 active refs
- **verify-before-finish-micro.md** — superseded by verify-before-finish deployed to May

## Restoration

To restore a skill: move it back to `agents/shared/skills/` and update LIBRARY.md status.
Only restore if you have a non-ceiling gym scenario AND a deployment mechanism (workflow, code guard, or agent-dir injection).
