# Multi-Fix Measurement Roundup — Apr 11 Evening

**Date**: 2026-04-11 22:24 UTC  
**Analyst**: optimizer  
**Scope**: Post-fix measurement for 3 active todo items

---

## 1. D-o-R Nested Workflow Fix (commit 60a844e3 + Phase 2/3 fixes)

### Timeline of Fixes
- **~03:54 UTC**: Phase 1 fix deployed (commit 60a844e3) — added "DO NOT call callAgent()" to Phase 1 rules
- **~12:24 UTC**: Phase 2 fix deployed — added callAgent guard to Phase 2 prompts
- **~17:24 UTC**: Phase 3 fix deployed — prevented VERIFY phase from spawning nested workflows

### Post-Fix Data (all fixes deployed after 17:30 UTC)
| # | Start Time | Phases | Total Ops | Nesting? |
|---|-----------|--------|-----------|----------|
| 1 | 21:54 UTC | P1(8) → P2(16) | 24 | ✅ Clean |

**Post-all-fixes sample: n=1** — insufficient for confirmation (need n≥3).

### Pre-Fix vs Post-Phase-1-Fix Nesting History (full Apr 11)
| Period | Workflow Runs | Nesting Incidents | Rate |
|--------|--------------|-------------------|------|
| Pre-P1-fix (04:00–08:54) | 7 | 0 | 0% |
| P1-fix only (08:54–12:30) | 3 | 2 | 67% ⚠️ |
| P1+P2 fix (12:30–17:30) | 6 | 1 (from P3) | 17% |
| All fixes (17:30+) | 1 | 0 | 0% |
| **Total Apr 11** | **19** | **3** | **16%** |

### Key Finding
- Phase 1 fix alone was **not sufficient**. 2 nesting incidents occurred from Phase 2 after P1 fix.
- Phase 2 fix closed most nesting but Phase 3 still had one incident at 16:24.
- All 3 fix layers combined have n=1 clean run — **too early to confirm**.
- Of the 3 nesting incidents: P2-sourced (08:54, 11:24) and P3-sourced (16:24). Each spawned exactly 2 nested sessions (a new P1+P2 pair).

### Verdict: ⏳ INSUFFICIENT DATA (n=1, need n≥3)

---

## 2. Tech-Lead Heartbeat Fix (commit dfa10146, deployed ~08:35 UTC)

### Post-Fix Data (n=34 since 08:35 UTC)
| Metric | Pre-Fix (n=18) | Post-Fix (n=34) | Change |
|--------|---------------|-----------------|--------|
| Avg ops | 26.1 | 6.3 | **-76%** ✅ |
| Lean heartbeats (≤5 ops) | — | 28/34 (82%) | — |
| Work-dispatch HBs (>5 ops) | — | 6/34 (18%) | — |
| Lean avg ops | — | 2.1 | — |

### Work-Dispatch Sessions (when TL forks real work)
| Time | Ops | Note |
|------|-----|------|
| 08:54 | 38 | Early post-fix, still adjusting? |
| 10:56 | 37 | |
| 12:24 | 26 | |
| 13:24 | 29 | |
| 14:54 | 9 | |
| 19:24 | 16 | |

### Key Finding
- **82% of post-fix heartbeats are lean (≤5 ops)** — dispatcher pattern working as designed.
- 6 work-dispatch sessions are expected — these are the ones that found real work to do.
- The 76% reduction holds at n=34 — well above the n≥8 threshold for confirmation.
- Estimated savings: 26.1 - 6.3 = **19.8 ops/heartbeat × ~40 HB/day = ~792 ops/day (~$37/day)**.

### Verdict: ✅ CONFIRMED (n=34, 76% reduction)

---

## 3. Bob Heartbeat Bloat — Current Distribution

### Last 12h Data (n=25 since ~10:24 UTC)
| Metric | Value |
|--------|-------|
| Total heartbeats | 25 |
| Avg ops | 10.8 |
| Median ops | 5 |
| Max ops | 55 |
| >20 ops (bloated) | 3/25 (12%) |
| >15 ops | 6/25 (24%) |

### Bloated Sessions (>20 ops)
| Time | Ops | Note |
|------|-----|------|
| 10:53 | 30 | ⚠️ |
| 20:53 | 55 | ⚠️ worst in window |
| 21:53 | 34 | ⚠️ |

### Comparison with Earlier Measurements
| Period | Avg Ops | Bloated (>20) Rate |
|--------|---------|-------------------|
| Pre-reform | 24.2 | — |
| Post-reform (Apr 10-11, n=92) | 10.2 | 8.7% |
| Last 12h (n=25) | 10.8 | 12% |

### Key Finding
- Bob HB bloat rate **slightly worse** in last 12h (12% vs 8.7% overall).
- The 55-op outlier at 20:53 is concerning — that's a full work session worth of ops in a heartbeat.
- Median of 5 shows most heartbeats are lean, but the tail is still fat.
- Root cause identified in earlier analysis: 164KB/999-line todo.md causing read loops + no hard op budget.
- **No fix deployed yet** — archiving todo.md completed items is the top recommendation.

### Verdict: 📊 STABLE BUT NOT IMPROVING (12% bloat rate, no fix deployed)

---

## Summary Table

| Fix | Status | Evidence Level | Verdict |
|-----|--------|---------------|---------|
| D-o-R Nested Workflow | 3 fixes deployed | n=1 post-all-fixes | ⏳ Insufficient |
| Tech-Lead HB Bloat | Fix deployed | n=34 post-fix | ✅ Confirmed (76% ↓) |
| Bob HB Bloat | No fix deployed | n=25 monitoring | 📊 Stable, 12% bloated |

### Recommendations
1. **D-o-R Nesting**: Continue monitoring. Will auto-confirm as more bob D-o-R runs accumulate. Current trajectory looks good (0 nesting in post-all-fix period).
2. **Tech-Lead HB**: Move to DONE. n=34 is robust confirmation.
3. **Bob HB**: Deploy top fix (archive todo.md completed items). The 55-op outlier suggests the problem is getting worse when it does hit.
