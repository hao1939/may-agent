# Heartbeat 2026-11-28

## Build Health
- ✅ `tsc --noEmit` clean — zero errors
- Codebase weight: 15,056 (target <32,000) — healthy

## Key Finding: Gym Scenario Bloat
- **446 scenarios**, 55MB total, 28MB excluding node_modules
- **4,529 files** (excl node_modules), of which **2,078 are exact duplicates** (46%)
- success_criteria.js: 444 files, only 268 unique (40% are copies)
- One success_criteria.js hash appears **35 times** identically
- Multi-session scenarios have extreme variant sprawl (e.g., 7+ variants of `kb-integration-failure`)
- **27MB vendored node_modules** in 25 scenarios (already on todo)

**Recommendation**: Create a gym dedup project. Extract shared success_criteria into a library. Collapse identical variants. This could remove ~2000 files and 15-20MB.

## Inbox Triage

### Dismissed (stale/already addressed)
- C7.1 path violations (P0, P1 × 3) — Already have prominent C7.1 rules in context.md. Past compliance issue, not current.
- amy-kimi 429 errors (P1 × 3) — External API rate limits. Cannot fix in code. Provider issue.
- Bob/coach ENOENT errors (P2 × 2) — Intermittent, P2, no action from tech-lead needed.
- Context update quality (P2) — Already cleaned by reporter.
- Stale metrics in may.db (P2) — Metrics team issue, not code health.

### Acknowledged (tracking, no immediate action)
- Gym runner bugs (agent_type, oneshot, success_criteria behavioral checks) — 3 related notifications. These need runtime changes (gym runner binary). Added to deferred section of todo.
- Handler audit: 21 enabled crons never fired — Worth investigating but P2. Could be dead config.
- Handler health metric at 0 — May infra issue, not code.
- may.db missing 5 agents — May infra issue.
- EXP-235 ready for integration — Bob/optimizer should integrate.
- Bob SOUL.md persistent-task rule — Bob's domain.

## Session Metrics
- Tool calls: ~20 (lean)
- First useful output within 5 calls
- No code changes needed this heartbeat
