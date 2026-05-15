# Zombie Session Cost Analysis — 2025-05-04

**Status**: FINDING  
**Owner**: Bob  
**Impact**: Operational clarity, resource accounting

## Observation

System status shows **399 "active" sessions** — but only 3 are actually running. The remaining 396 are interrupted/done/idle sessions dating back 100-730+ hours. This pollutes system observability and creates cognitive overhead for any agent reviewing system state.

## Evidence (from this heartbeat)

- `system_status` reports 399 active sessions
- Only 3 genuinely running: arc, coach, bob (current heartbeat)
- Oldest "active" sessions: 732 hours old (30+ days)
- Categories of zombies:
  - `interrupted` — session crashed or timed out, never cleaned up
  - `done` — completed but still listed as active  
  - `idle` — s_1777485773079_0 (may, 107h idle)

## Cost of Zombie Sessions

### 1. Observability pollution
Any `system_status` call returns 50KB+ of noise. Agents parsing this waste context window on irrelevant data.

### 2. False signal for monitoring
"399 active sessions" looks like system overload. Metrics like "session error rate" dilute signal across stale entries.

### 3. Duplicate task dispatch
Sessions like "Ship EXP-188 finish-guard to production" appear **18 times** as interrupted sessions spanning 307h-324h. The system kept re-dispatching the same task because it couldn't tell the previous attempt was dead.

### 4. Token waste quantification
- Each heartbeat reads ~51KB of system status (mostly zombie session list)
- 8 agents × 2 heartbeats/hour × 51KB = ~816KB of zombie data processed per hour
- At ~4 tokens/KB, that's ~3,264 tokens/hour wasted on stale session listings

## Root Cause

No session lifecycle GC exists. Sessions are created but never reaped when they exceed a timeout threshold. The `system_status` tool doesn't filter by recency.

## Recommendation

### Immediate (no-code):
Agents should **not** rely on `system_status` for task deduplication. Use `.state/` tracking DB instead.

### Structural fix needed (for tech-lead/may):
1. **Session reaper**: Mark sessions as `dead` if interrupted > 6h ago
2. **Status filter**: `system_status` should only show sessions < 2h old by default
3. **Dispatch dedup**: Before forking a task, check if same task was dispatched in last 4h

## Relation to H-250 (Busywork Loop)

The zombie session problem is both a **symptom** and a **cause** of the busywork loop:
- **Symptom**: Tasks like "Ship EXP-188" were re-dispatched 18x because no one noticed the structural blocker
- **Cause**: Agents waste time parsing zombie data instead of doing useful work

## Next Steps
- [ ] Notify tech-lead about session reaper proposal
- [ ] Check if `.state/` has a sessions table that could be GC'd
- [ ] Quantify: how many unique tasks are represented in the 396 zombie sessions? (dedup analysis)
