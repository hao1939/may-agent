# Finding: Scout Scrape Escalation Loop + Coach Redundant Reads

**Date**: 2026-03-19T15:55 UTC  
**Impact**: $40-80/day estimated savings  
**Status**: PARTIAL FIX DEPLOYED (scrape maxLength cap)

## Scout: Scrape Escalation Loop

### Problem
Scout sessions are 837KB average (vs 200KB for other agents). Root cause: the `scrape_webpage` truncation message says "use maxLength parameter for more", causing Scout to re-scrape the same URL 5-6 times with escalating maxLength (40K → 80K → 200K).

### Evidence
- s_1773896712743_1: 1,724KB session, scraped `arxiv.org/html/2603.17244v1` **5 times** (40K, 40K, 200K, 200K, 200K)
- s_1773895023024_18: 1,388KB session, 54 scrape calls, 6 duplicate URLs  
- s_1773934516583_5: 548KB session, scraped `2603.16916v1` **4 times**
- s_1773920113708_83: 436KB session, scraped `2603.16899v1` at 100K after smaller tries
- 6 scout sessions in 12h = 5,024KB total (vs ~1,200KB expected)

### Fix Applied (commit 486932b)
1. **Hard cap maxLength at 30K** in `scrape.ts` — agents can request more but the cap prevents 200K dumps
2. **Changed truncation message** from "use maxLength for more" to "summarize what you have"
3. **Created scrape-dedup guard** (`scrape-dedup-guard.ts`) — warns on 2nd scrape of same URL, blocks 3rd+
   - Guard awaits `beforeToolCall` hook support in pi-agent-core (same as read-dedup guard)
   - 10 tests, all pass

### Expected Impact
- Scout sessions: 837KB avg → ~200KB avg (76% reduction)
- 6 sessions/12h × 637KB savings = ~3.8MB/12h context reduction
- Estimated cost savings: $15-25/day (less context = fewer input tokens)

## Coach: Redundant File Reads

### Problem  
Coach reads the same massive files repeatedly within a single session:
- `experiments.jsonl` (94KB): read 6+ times in s_1773932169132_113
- `method-catalog.md` (68KB): read 4+ times
- `todo.md` (6KB): read 5+ times

In the 1,296KB session, ~800KB was redundant re-reads of the same files.

### Root Cause
The read-dedup guard exists (src/lib/tools/read-dedup-guard.ts, 8 tests) but is commented out in manager.ts because pi-agent-core doesn't support the `beforeToolCall` hook yet.

### Proposed Fix (not yet implemented)
Option A: Wire guard logic into `wrapToolsWithReceipts` execute function (can work today, higher risk)  
Option B: Wait for pi-agent-core `beforeToolCall` hook support (cleaner, blocked on upstream)  
Option C: Add `tail -20` hint to coach's heartbeat.md for experiments.jsonl reads

### Expected Impact if Fixed
- Coach sessions: 227KB avg → ~120KB avg (47% reduction)
- 49 sessions/12h × 107KB = ~5.2MB/12h context reduction  
- Estimated cost savings: $25-50/day
