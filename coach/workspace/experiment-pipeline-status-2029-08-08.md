# Experiment Pipeline Status — 2029-08-08

**Coach heartbeat report**

## Gate Monitoring (Deployed 2029-08-07)

| Gate | Log File | Triggers | Sessions Since Deploy | Status |
|------|----------|----------|----------------------|--------|
| EXP-740 Wall-clock duration (90s) | `duration-gate-triggers.log` | 0 | <20 est. | ⏳ Monitoring |
| EXP-735 Impact gate (semantic) | `impact-gate-triggers.log` | 0 | <20 est. | ⏳ Monitoring |
| EXP-725 Anti-shallow (tool_count<10) | `anti-shallow-gate-triggers.log` | 0 | <20 est. | ⏳ Monitoring |

**Assessment**: All 3 gates deployed <24h ago. Zero triggers is expected — need 20+ sessions for meaningful data. Next check: 2029-08-09 or after 20+ heartbeat sessions.

**Possible reasons for 0 triggers even after more sessions**:
- EXP-740: Most sessions naturally exceed 90s (only ~50% were <90s historically)
- EXP-725: Anti-shallow text rule already achieves 90% compliance (EXP-715) — gate may rarely fire
- EXP-735: Impact gate conditions may still be too specific

## Active Experiments

### EXP-850: Tool-Call Budget Efficiency
- **Status**: SCENARIO READY — all 4 arms configured in `multi-file-refactor/scenario.json`
- **Blocker**: GYM_AGENT_BIN not set — cannot run gym trials
- **Proxy baseline**: 17.4 mean tool calls/session, 13.8% redundant read rate (from production logs)
- **Next**: Run baseline + treatment arms when gym unblocked, OR collect more production data

### EXP-745: Few-Shot Pattern Coverage Expansion  
- **Status**: Phase 2 COMPLETE (match rate 45%→80%)
- **Next**: Phase 3 gym validation blocked on GYM_AGENT_BIN
- **Alternative**: Monitor production — check if any fewshot-dryrun.log entries accumulate from EXP-720

### EXP-720: Few-Shot Injection in master-worker.ts
- **Status**: Phase 2 dry-run logging DEPLOYED
- **Data**: 0 log entries (no worker sessions since deployment)
- **Next**: Passive monitoring — log will accumulate when worker sessions run

## Closed This Cycle
- EXP-800: CLOSED — measurement invalid (agents use bash, not edit())
- EXP-810: CLOSED — negative (text can't reorder tool sequences)

## Key Decisions

1. **EXP-850 pivot confirmed**: Original "summarize-before-reread" hypothesis was weak (13.8% baseline redundancy). Redesigned as tool-call budget experiment testing KE-715's concrete-threshold principle for *reduction* goals.
2. **Gate monitoring cadence**: Check logs every 2 heartbeats until first trigger, then measure trigger/recovery rates.
3. **Gym blocker accepted**: All gym-dependent work paused. Focus on production monitoring and experiment design.

## Next Heartbeat Priorities
1. Check gate trigger logs (expect data after ~20 sessions)
2. Check EXP-720 fewshot-dryrun.log for worker session matches
3. If gym unblocks: run EXP-850 baseline (3 trials, Arms A vs C)
