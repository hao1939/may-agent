# Finding: Amy Read Loop — 152 reads/session, ~$71 per incident

**Date**: 2026-03-18T04:00 UTC
**Severity**: HIGH (cost + waste)
**Status**: NEW — needs behavioral fix

## The Problem

Amy enters a read loop during her "Insights review" and "Signal scan" periodic tasks, reading the same 2 files dozens of times per session.

## Evidence

### Session s_1773804907368_418 (worst case)
- **155 assistant messages**, 152 read calls
- **75× `insights.md`** (31KB) + **75× `signals.md`** (76KB)
- Ended in error: "Unexpected event order" (likely hit API limits)
- **Estimated cost: ~$71** for a single session

### Session s_1773803105750_397 (same pattern)
- **18× `insights.md`** + **18× `signals.md`**
- Interrupted (killed by next heartbeat before finishing)

### Pattern
Amy's periodic tasks say "Read workspace/insights.md" and "Write synthesis to workspace/signals.md". She gets stuck in a read→process→write→re-read loop because:
1. `signals.md` is 76KB (598 lines) — too large to process in one pass
2. She reads with offset/limit, processes a chunk, writes, then re-reads to continue
3. No loop termination condition — she keeps going until interrupted or erroring

## Impact

- **$71+ per worst-case session** (at Opus pricing)
- Even mild cases (18 reads) waste significant tokens re-reading 76KB files
- Pattern recurs across multiple sessions (2 of 4 Amy sessions show it)

## Root Cause

1. **File too large**: `signals.md` at 76KB is far too large for iterative LLM processing
2. **No read budget**: Amy's heartbeat/periodic-tasks don't cap reads per file
3. **Append-only growth**: Each cycle appends to signals.md without compacting

## Proposed Fixes

### Immediate (behavioral)
1. Add to Amy's heartbeat: "Read each file ONCE per session. Do not re-read files you've already read."
2. Add: "If insights.md or signals.md > 200 lines, archive older entries first before processing."

### Structural
1. **signals.md compaction**: Archive entries older than 7 days, keep file under 100 lines
2. **Read dedup guard**: JS middleware that warns/blocks when an agent reads the same file >3× in a session
3. **Amy's archive maintenance** should run more frequently (currently weekly, should be per-heartbeat given growth rate)

## Cost Estimate

If Amy runs ~6 sessions/day and 50% hit this loop:
- Mild case (18 reads): ~$10/session × 3 = $30/day
- Severe case (75 reads): ~$71/session × occasional = $71+
- **Total waste: $30-100/day from this single pattern**
