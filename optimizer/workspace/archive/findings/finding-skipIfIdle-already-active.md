# Finding: skipIfIdle Already Active (2026-03-18)

## Summary
The `skipIfIdle` feature in cron.ts is **already working** without explicit configuration.
The code defaults to enabled (only `skipIfIdle === false` disables it).

## Evidence
- 57 idle skips recorded in may.db in the last ~12h
- Each agent getting ~6 skips per 6h window (out of ~13 heartbeat requests)
- ~50% of heartbeats are being skipped when agents have no pending work
- Initiative cadence (every 3rd) fires regardless to allow proactive work

## Waste Analysis (6h window)
- 15 sessions with ≤1 op (0 useful work), totaling 137KB of task injection
- Plus 12.5KB common-sense.md system prompt per session = ~187.5KB
- **Total: ~325KB wasted tokens per 6h = ~1.3MB/day**
- BUT: These are likely from initiative cadence fires (every 3rd), not unchecked idle sessions

## Remaining Optimization Opportunity
The initiative cadence is set to 3 (default). For agents that rarely need proactive work
(like bob, qa), this could be increased to 5 or higher to reduce waste further.

## Status: INFORMATIONAL
No action needed — the system is already saving significant cost via idle skipping.
Minor improvement possible by tuning initiativeCadence per agent.
