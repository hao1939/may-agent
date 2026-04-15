# Handler Health Check — 2026-03-19T17:49

## Summary
Overall health is GOOD — 2.3% error rate (1 error in 43 sessions, 4h window). The one error was a transient proxy truncation on coach session. Session volume ~10.75/hr (43/4h). All handlers running.

## Critical: 9 Commits Not Deployed (Binary Stale)

**Running binary:** `may-agent-96dcb60` (started 15:27 UTC)
**Latest binary symlink:** `may-agent-66aace2` (built 15:54 UTC) — still 2 commits behind HEAD
**HEAD:** `8d7a8a1` — 9 commits ahead of running binary

### Not deployed:
1. `94fbc27` — **Guard wiring** (read-dedup, session-read, finish-evidence, scrape-dedup) ⚠️ HIGH IMPACT
2. `486932b` — Scrape maxLength cap + scrape dedup guard ⚠️ HIGH IMPACT
3. `66aace2` — Test file repairs
4. `33ee86d` — Unified SQLite adapter (-316 lines)
5. `0001f33` — Debug logging for send-tool
6. `86a63cb` — Remove stray test artifact
7. `d45bd4d` — Smart send idempotency
8. `16b9fa3` — Auto-migration fix
9. `8d7a8a1` — Gym adapter fix

### Impact: Guards Not Active
Coach training-sprint session (s_1773932169132_113, 1265KB) shows:
- `todo.md` (6KB) read **9 times** = 54KB wasted
- `method-catalog.md` (71KB) read **6 times** = 426KB wasted
- `sprint-plan.md` read **5 times**
- `experiments.jsonl` read **4 times**

Total redundant reads in one session: ~550KB of duplicate input tokens.
With 11 coach sessions in 4h, estimated waste: **$15-25/day** from read duplication alone.
The read-dedup guard (committed in 94fbc27) would block reads after the 5th of the same file.

### Binary Build Gap
The symlink was updated to `66aace2` at 15:54 but:
1. The running process is still on `96dcb60` (no restart)
2. The symlink binary (`66aace2`) doesn't include commits `94fbc27` or `486932b` (the guards)
3. **Need: rebuild from HEAD + process restart**

## Convention Checks: Empty
`.state/convention-checks/summary.json` shows `"agents": {}` — no convention checks being generated. The handler runs but the preflight requires new evaluations, and evaluations are going to SQLite now (may.db, 9MB), so the JSON preflight may not trigger.

## Evaluation Pipeline: Working via SQLite
- may.db: 9344KB, last modified 16:58 UTC — actively receiving evaluations
- Old JSON path: only 7 out of 14,504 sessions have `output/evaluation.json`
- The evaluate-sessions handler successfully migrated to SQLite (commit 96dcb60)
- Convention-check handler may need updating to read from SQLite instead of JSON files

## Session Metrics (4h window)
| Agent | Sessions | Errors | Avg Size | Max Size |
|-------|----------|--------|----------|----------|
| coach | 11 | 1 | 333KB | 1265KB |
| may | 8 | 0 | 37KB | 92KB |
| qa | 5 | 0 | 110KB | 127KB |
| bob | 4 | 0 | 175KB | 260KB |
| tech-lead | 4 | 0 | 372KB | 467KB |
| optimizer | 3 | 0 | 210KB | 226KB |
| amy-kimi | 3 | 0 | 88KB | 119KB |
| evaluator | 2 | 0 | 30KB | 35KB |
| coder | 2 | 0 | 127KB | 138KB |
| scout | 1 | 0 | 517KB | 517KB |

Total: 43 sessions, 8.2MB, 2.3% error rate.

## Action Items
1. **CRITICAL: Rebuild binary from HEAD and restart** — needed to deploy 4 guards that will prevent ~$15-25/day in wasted reads. Sent request to May.
2. **Convention-check preflight** — may need updating to detect SQLite evaluations (not JSON). Lower priority.
