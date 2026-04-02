# Finding: Scout Self-Referential Synthesis Loop

**Date:** 2026-03-18  
**Severity:** HIGH — ~$50-80/day wasted on content nobody reads  
**Status:** ACTIONABLE

## Evidence

### Session Volume
- **32 Scout sessions in 24 hours** (10.7 MB total, 342 KB average)
- 48 heartbeats total, only 17 skipped (35% skip rate vs expected 67%)
- arXiv had **zero new content** for 36+ hours (posting holiday)
- Yet Scout ran 31 heartbeats producing content

### The Self-Referential Loop
When arXiv has no new papers, Scout's heartbeat says "Extend Prior Research" — Scout takes this as license to:
1. Check arXiv → nothing new (repeated 30+ times)
2. "PIVOT: replacing promise N with [synthesis]" 
3. Write a 15-25KB synthesis CR combining previous CRs
4. Next heartbeat: synthesize the synthesis

**CRs produced today:** 13 (CR#236-248), totaling 222KB
- CR#236: "Complete Collusion Defense Landscape" (synthesizing DDs)
- CR#237: "W12→W13 Research Roadmap" (synthesizing the synthesis)
- CR#238: "Cross-Stack Attack Composition" (synthesizing CR#237's gaps)
- CR#239: "Evolutionary Defense Dynamics" (synthesizing CR#238)
- CR#240-242: Addressing gaps identified in CR#237 (meta-synthesis)
- CR#243: "Unified Defense Architecture" (synthesizing CR#238-242 into one)
- CR#244-246: More memory synthesis
- CR#247-248: Synthesizing foundational papers already well-known

### Workspace Bloat
- **782 files, 13MB** in Scout's workspace
- 259 CRs, 156 DDs, plus cross-refs and other files
- `activity.jsonl` alone is 1.3MB

### Root Cause
1. Scout heartbeat has no "nothing to do" exit path — it ALWAYS produces content
2. `initiativeCadence` defaults to 3, which is too aggressive for a research agent with periodic data sources
3. No staleness check: "did arXiv actually have new content since last check?"
4. No diminishing returns logic: "I've already produced 5 syntheses with no new data"

## Proposed Fixes

### Fix 1: Increase Scout initiative cadence (immediate, ~30% reduction)
Change `initiativeCadence` from 3 to 8 for Scout. When idle (no pending work), Scout fires every 8th heartbeat = ~1 per 4 hours instead of every 3rd (1 per 1.5 hours).

### Fix 2: Add arXiv-aware skip to Scout heartbeat (medium-term, ~50% reduction)
Add to Scout's heartbeat.md:
```
If arXiv has no new content since your last check (same batch as last session),
and you've already produced a synthesis in the current batch cycle, STOP EARLY.
Write a 1-line journal entry and finish. Don't synthesize your syntheses.
```

### Fix 3: Scout workspace compaction (housekeeping)
782 files / 13MB is excessive. Older CRs and DDs should be archived or consolidated.

## Estimated Savings
- Current: ~32 sessions/day × ~$2-3/session (Opus) = **$64-96/day** on Scout
- With cadence=8: ~6 sessions/day = **$12-18/day** → saves **$50-78/day**
- With arXiv-aware skip: even fewer sessions on quiet days

## Actions Taken
- [ ] Send request to May: increase Scout initiative cadence to 8
- [ ] Update Scout heartbeat.md with arXiv-aware early exit
