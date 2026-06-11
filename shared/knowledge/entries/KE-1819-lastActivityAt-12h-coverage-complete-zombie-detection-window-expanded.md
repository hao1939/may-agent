<ai_context>
The lastActivityAt column on sessions is now 100% populated in both 6h and 12h trailing windows (458/458 sessions across all 7 agents as of 2026-06-11 05:50Z). The pre-activation tail (before 2026-06-09 17:33Z) has fully rolled out of the 12h window. The precondition for pure-SQL zombie detection is met for windows ≤12h, upgrading from the ≤6h window documented in KE-1808.
Triggers: lastActivityAt, zombie detection, sessions.md, coverage, 12h window, pure-SQL
</ai_context>

# KE-1819: `lastActivityAt` 12h Coverage Complete — Zombie Detection Window Expanded

**Created**: 2026-06-11
**Author**: arc (heartbeat coherence audit)
**Status**: verified
**Confidence**: 0.98 — SQL query against live DB, all agents checked
**Domains**: sessions, infrastructure, data-quality
**Connects**: KE-1808 (6h coverage milestone), KE-1558 (error column NULL)

---

## Observation

KE-1808 (2026-06-11 ~00:15Z) documented `lastActivityAt` reaching 100%
coverage in the 6h trailing window, with 12h at 69.5%. Six hours later,
the pre-activation tail has fully rolled out of the 12h window.

## Evidence

### 6h window (2026-06-11 ~05:50Z)
- 143/143 sessions populated (100%)
- All 7 agents at 100%

### 12h window (same timestamp)
- **458/458 sessions populated (100%)**
- All 7 agents at 100%:
  - aks-explorer: 96/96
  - arc: 24/24
  - dev: 24/24
  - evaluator: 239/239
  - may: 36/36
  - scout: 32/32
  - tech-lead: 7/7

### 24h window
- ~47% — the pre-activation tail still present but aging out. Expected
  to reach 100% by ~2026-06-11 17:33Z (full 24h after activation).

## Action

Updated `sessions.md` design doc:
1. DDL comment: changed "6h window" → "6h and 12h windows", "≤6h" → "≤12h"
2. Known Issues section header: "recently activated, partially populated" → "fully populated"
3. Status text: Updated coverage numbers, expanded zombie detection window claim from ≤6h to ≤12h

## Implication

Pure-SQL zombie detection (`WHERE status='running' AND lastActivityAt <
strftime('%s','now')*1000 - 1800000`) is now reliable for any window up
to 12 hours — the full cron cycle. The remaining `src/` change to switch
from JSONL `mtime` to this SQL query is blocked on ORDER-010 (Hao approval)
but no longer blocked on data readiness.
