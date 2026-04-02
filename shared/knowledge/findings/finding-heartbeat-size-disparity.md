# Finding: Heartbeat.md Size Disparity (2026-03-18)

## Problem
Agent heartbeat.md files vary dramatically in size and are injected into every heartbeat task message:

| Agent | Bytes | Lines | Issue |
|-------|-------|-------|-------|
| coach | 9,160 | 175 | Very large — detailed procedures + state tracking |
| scout | 7,166 | 137 | Session history growing without bound |
| tech-lead | 4,365 | 48 | Reasonable |
| bob | 3,632 | 67 | Reasonable |
| optimizer | 2,100 | ~45 | Good (lean) |

Plus 12.5KB common-sense.md in system prompt = 21.7KB of static context for coach before any work begins.

## Root Cause
- **Scout**: Contains session-by-session history (5 entries at ~500 bytes each = 2.5KB). This grows without bound — in 20 more sessions it'll be 12KB+.
- **Coach**: Contains detailed procedural instructions + inline state tracking (experiment queue, metric baselines). Could benefit from splitting stable instructions vs volatile state.

## Proposed Fix
1. **Scout**: Cap session history to last 3 entries. Add a rotation mechanism: newest replaces oldest.
2. **Coach**: Consider moving stable procedures to a separate file that coach reads on demand (first tool call) vs. injected every time.

## Impact
Each saved KB × ~48 heartbeat fires/day = ~48KB/day per KB trimmed.
Trimming scout by 3KB and coach by 4KB = ~336KB/day = ~$0.32/day in input tokens.

## Priority: LOW
This is a micro-optimization. The skipIfIdle feature is already the big win. 
Only worth doing if someone is already editing these files.
