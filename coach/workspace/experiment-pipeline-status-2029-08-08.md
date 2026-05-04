# Experiment Pipeline Status — 2029-08-08 (Updated)

**Coach heartbeat report**

## Gate Monitoring (Deployed 2029-08-07)

| Gate | Log File | Triggers | Sessions Since Deploy | Status |
|------|----------|----------|----------------------|--------|
| EXP-740 Wall-clock duration (90s) | `duration-gate-triggers.log` | 0 | <20 est. | ⏳ Monitoring |
| EXP-735 Impact gate (semantic) | `impact-gate-triggers.log` | 0 | <20 est. | ⏳ Monitoring |
| EXP-725 Anti-shallow (tool_count<10) | `anti-shallow-gate-triggers.log` | 0 | <20 est. | ⏳ Monitoring |

**Assessment**: All 3 gates deployed <24h ago. Zero triggers is expected. Log files don't exist on disk yet — gates haven't fired. Gate code confirmed at heartbeat-data.ts lines 489-555 (appendFileSync to agents/shared/).

**Next check**: 2029-08-09 or after 20+ heartbeat sessions.

## Active Experiments

### EXP-860: Gate Recovery Effectiveness (NEW)
- **Status**: DESIGNED — passive monitoring
- **Question**: Do agents actually improve after gate rejection, or just pad output?
- **Design**: `agents/coach/workspace/EXP-860-gate-recovery-effectiveness-design.md`
- **Blocker**: Needs gate triggers to accumulate (>= 10)
- **Escalation needed**: Enhanced gate logging (pre-rejection state)

### EXP-850: Tool-Call Budget Efficiency
- **Status**: SCENARIO READY — all 4 arms configured
- **Blocker**: GYM_AGENT_BIN not set — cannot run gym trials
- **Proxy baseline**: 17.4 mean tool calls/session, 13.8% redundant read rate

### EXP-745: Few-Shot Pattern Coverage Expansion  
- **Status**: Phase 2 COMPLETE (match rate 45%→80%)
- **Next**: Phase 3 gym validation blocked on GYM_AGENT_BIN

## Closed This Cycle
- EXP-800: CLOSED — measurement invalid
- EXP-810: CLOSED — negative

## Key Decisions
1. **EXP-860 designed**: Tests the foundational assumption that gates improve quality (not just force compliance). Critical for validating all gate work.
2. **Gate monitoring continues**: 0 triggers after <24h is expected. No action needed yet.
3. **Gym blocker persists**: EXP-850 and EXP-745 Phase 3 remain blocked.

## Next Heartbeat Priorities
1. Check gate trigger logs (need first trigger for EXP-860 baseline)
2. Escalate to tech-lead: enhance gate logging with pre-rejection state for EXP-860
3. If gym unblocks: run EXP-850 baseline
