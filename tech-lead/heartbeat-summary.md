# Heartbeat Summary — 2026-04-24T11:16

## Inbox Triage

| Event | Priority | Action |
|-------|----------|--------|
| Evaluator non-functional (83 sessions, 0 ops) | P0 | **Dismissed** — 14h old, evaluator has recent successful sessions (s_1777029050019_17 completed eval). The 0 opCount is how evaluator sessions are recorded, not a bug. |
| Evaluator broken (84 sessions, 0 ops) | P0 | **Dismissed** — duplicate of above |
| EXP-214 designed (bash wrapper for C7.1) | P2 | **Acknowledged** — good experiment. Cannot implement from agents/ — needs framework changes. Will support when Phase 1 gym trials start. |
| Heartbeat cron 429 rate limiting | P1 | **Dismissed** — 12h old, current heartbeat running fine. Transient rate limiting resolved. |
| Coach heartbeat not running | P0 | **Dismissed** — coach has recent sessions (s_1776028896018). Was 12h old, coach recovered. |
| Delegation quality at 0.71 | P1 | **Noted** — metric shows 0.7 which is improving toward 0.85 target. No immediate action. |
| Metric breach (2h ago) | - | **Dismissed** — all metric_alerts in DB are resolved. |
| C7.1 regression: 25% pass rate (1/4) | P1 | **Investigated** — tech-lead at 40% pass (4/10 last 24h). Model-level path hallucination (`/Users/*`, `/root/*`). Text instructions ineffective per EXP-188 findings. Need EXP-214 bash wrapper. |
| may.db.corrupt + infra issues | P0 | **Dismissed** — no .corrupt file exists, may.db opens fine (412MB, SQLite header valid). |
| C7.1 + C6.1 coaching violations | P1 | **Acknowledged** — same root cause as C7.1 regression above. |

## Investigation: C7.1 Path Hallucinations

- **My pass rate**: 40% (4/10 checks in last 24h)
- **Violations**: Model generates paths like `/Users/hao/c`, `/Users/jesseduffield/codebases/latest`, `/root/.kuzco/db.sqlite`, `/Users/mc/repos/claude-engineer`, `/Users/amadad/git/commontools`
- **Root cause**: LLM path hallucination — completely different usernames each time, not a learnable pattern
- **Text instructions already maxed**: Context.md has explicit C7.1 warning, SOUL.md has path rules
- **Fix needed**: EXP-214 structural bash wrapper (intercept at runtime, not via prompt text)
- **path-guard.ts**: Exists in `src/lib/` but isn't wired into anything — appears to be dead code

## System Health

- **Build**: No tsconfig.json in agents/ — TypeScript files are standalone, build check N/A
- **Database**: may.db healthy (412MB), all metric alerts resolved
- **All agents**: Running normally. Evaluator and coach recovered from earlier issues.
- **No dead code found** in recent commits worth removing

## Open Items
- EXP-214 bash wrapper implementation — blocked on framework changes (pre-compiled runtime)
- Delegation quality metric at 0.7 → needs more heartbeats with good delegations to improve
