# Cost Outlier Scan — 2026-03-19T19:49 UTC

## System Health (last 8h: ~12:00-20:00 UTC)

| Metric | Value | Trend |
|--------|-------|-------|
| Sessions | 64 (192/day) | ↓ from 66 at 16:18 |
| Errors | 1 (1.6%) | ↓ from 7.6% |
| Total data | 10.6MB (31.8MB/day) | stable |
| Avg session | 165KB | ↑ from 142KB prev scan |

## Cost Breakdown by Agent (8h window)

| Agent | Sessions | Total KB | Avg KB | % of Total |
|-------|----------|----------|--------|------------|
| coach | 10 | 3,456 | 345 | 33% |
| tech-lead | 6 | 1,926 | 321 | 18% |
| qa | 11 | 1,272 | 115 | 12% |
| bob | 6 | 917 | 152 | 9% |
| optimizer | 4 | 771 | 192 | 7% |
| coder | 6 | 648 | 108 | 6% |
| scout | 2 | 569 | 284 | 5% |
| amy-kimi | 5 | 513 | 102 | 5% |
| may | 11 | 456 | 41 | 4% |
| evaluator | 3 | 90 | 30 | 1% |

## Key Findings

### 1. Coach duplicate reads: 1.2MB wasted in 8h ($13-18/day)
Coach continues to read the same files multiple times per session:
- `method-catalog.md` 6x, `todo.md` 6x, `experiments.jsonl` 4x in one session
- 1,185KB of duplicate read data in 8 hours
- **Root cause**: Read-dedup guard (committed in 94fbc27) not deployed
- Worst session: s_1773932169132_113 (1,265KB, 97% tool results)

### 2. Read-only sessions > 100KB: ~1.7MB wasted
11 sessions consumed >100KB each without producing a single edit/write:
- Coach 663KB + 511KB (training sprint research with zero output)
- Bob 260KB (orientation session reading conventions)
- QA 5 sessions averaging 120KB (these may be legitimate review)
- **Pattern**: Agent reads extensively but never acts

### 3. Binary deployment stuck: 11 commits undeployed, guards blocked
- Running: `may-agent-96dcb60` (started 15:37 UTC)
- Built (not activated): `may-agent-66aace2` (15:54 UTC, 6 commits newer)
- HEAD: `38bfd1b` (4 more commits including guards + scrape cap)
- **bun not available** in container — cannot rebuild from HEAD
- Previous rebuild request (req:01bcdc57) marked COMPLETED but never executed
- **Savings blocked**: $30-43/day from guards alone

### 4. Positive: Error rate at all-time low
- 1 error in 64 sessions (1.6%)
- Down from 17% a few days ago, 7.6% last scan
- The remaining error is a coach "empty toolUse" transient issue

## Critical Blocker

**$30-43/day in savings are blocked because the binary can't be rebuilt.**

The guards (read-dedup, scrape-dedup, session-read, finish-evidence) are all committed
and tested but the container doesn't have `bun` to compile a new binary. A restart
would pick up `66aace2` (6 new commits) but NOT the guards (4 more commits ahead).

**Need**: Hao to either:
1. Rebuild binary from HEAD: `bun run bundle` (from dev machine)
2. Install bun in the container
3. Or restart process to at least get `66aace2` as an intermediate step

## Recommendations

1. **IMMEDIATE**: Send rebuild escalation to May for Hao attention
2. **SHORT-TERM**: Even without guards, add coach opBudget reduction (req:db066426 still pending — only TL+optimizer were changed, not coach)
3. **MEDIUM-TERM**: Add auto-rebuild capability to the container
