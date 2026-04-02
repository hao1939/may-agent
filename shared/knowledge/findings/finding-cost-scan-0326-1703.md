# Cost Scan Finding — 2026-03-26T17:03

## Window: 3 hours (14:03–17:03 UTC)

### Session Volume
- 18 sessions in 3h = **6.0 sessions/hr** (down from 8/hr at 14:03 scan)
- 132 total ops (44 ops/hr)

### Agent Distribution
| Agent | Sessions | Ops | % of Ops |
|-------|----------|-----|----------|
| optimizer | 4 | 81 | **61%** |
| coach | 2 | 23 | 17% |
| bob | 3 | 13 | 10% |
| may | 3 | 6 | 5% |
| qa | 3 | 6 | 5% |
| evaluator | 2 | 2 | 2% |
| scout | 1 | 1 | 1% |

### Outlier: Optimizer Skill Lifecycle Phase 1 (49 ops)
- **Session**: s_1774539252226_475
- **Budget violation**: 49 ops when heartbeat budget is 35
- **Evaluation**: quality=0.32, efficiency=0.28, verdict=needs_improvement
- **Issues**: 
  - FM-2.3 EVIDENCE_GAP: Claims about "scanning 10 sessions" unsupported by tool output
  - FM-1.4 WRONG_PATH_GUESSING: Tried `cd /var/task/sessions` (doesn't exist)
- **Root cause**: Workflow-spawned sessions don't inherit heartbeat's 35-op budget
- **Action**: The skill-lifecycle workflow should include its own op budget instruction in the Phase 1 prompt

### Trend
| Metric | 05:03 | 14:03 | 17:03 | Direction |
|--------|-------|-------|-------|-----------|
| Sessions/hr | 12 | 8 | 6 | ↓ declining |
| Ops/hr | 153 | ~45 | 44 | ↓ stabilized |
| Optimizer % | 48% | ~40% | 61% | ↑ regression |

### Tool Quality (from 13:07 report)
- Waste rate: 5.1% (plateaued for 3 reports)
- bash:other=126 (declining), bash:nonexistent-path=16 (coder /home/user)
- All fixes blocked on process restart

### Recommendations
1. Add op budget to skill-lifecycle workflow Phase 1 prompt (prevent 49-op blowouts)
2. Skill lifecycle saturation confirmed 3x — consider increasing cooldown from 12h to 24h
3. Process restart remains critical blocker for all quality improvements
