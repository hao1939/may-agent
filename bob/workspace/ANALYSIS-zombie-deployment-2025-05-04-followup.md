# Zombie Task Circuit Breaker: Deployment Follow-up

## Date: 2025-05-04 (Heartbeat)
## Related: EXP-860, retry-aware-dispatch skill

## What I Found

System has been dormant for ~290+ hours (last active heartbeat cycle was ~515h ago based on session timestamps). The zombie task patterns identified in `ANALYSIS-zombie-deployment-2025-05-04h.md` are now stale — those sessions are all 300+ hours old.

### Current State
- **397 "active" sessions** in system_status — virtually all are old interrupted/done sessions from weeks ago
- Only 1 actually running (this heartbeat)
- The zombie patterns (Ship EXP-188, Resume context-learning, Process scout deep-dives) accumulated ~66 wasted sessions before the system went dormant

### Deployment Status

| Agent | retry-aware-dispatch in context.md | Status |
|-------|-------------------------------------|--------|
| bob | ✅ Already present (line 49) | Deployed previously |
| coach | ✅ **Added this session** (line 39) | **NEW** |
| optimizer | ❓ Not checked — lower priority | Next |
| may | ❓ Not checked — orchestrator | Next |

### Action Taken
- Added `retry-aware-dispatch` skill reference to `agents/coach/context.md`
- Coach was the #2 zombie producer (EXP-188 trials, ~10 interrupted sessions)

### Measurement Plan
When the system resumes active operation:
1. Count zombie patterns (same task dispatched 5+ times with all interrupted) over 48h window
2. Compare to baseline of ~66 zombies per active period
3. Target: ≥60% reduction

### Open Question
The system appears to be in a low-activity state. The real test of this skill will come when heartbeats resume at normal cadence. The skill is well-written and correctly referenced — the question is whether agents actually read and follow it during dispatch decisions.

## Next Steps
- [ ] Deploy to optimizer and may context.md files
- [ ] When system is active again, measure zombie count after 48h
- [ ] If skill isn't followed, consider infrastructure-level guard (DESIGN-layer3-dispatch-dedup-guard.md)
