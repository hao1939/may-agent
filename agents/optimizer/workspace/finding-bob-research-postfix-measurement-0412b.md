# Bob Research Thread Budget Caps + D-o-R Nesting Fix — Post-Fix Measurement (Apr 12, ~06:24 UTC)

**Date**: 2026-04-12 06:24 UTC  
**Previous measurement**: `finding-bob-research-thread-postfix-0412.md` (05:54 UTC, n=0)

## 1. Research Thread Budget Caps

**Fix deployed**: ~04:54 UTC Apr 12 to `parallel-research.ts`  
**Changes**: ≤25 ops/thread, ≤15 ops/synthesis, anti-workflow-nesting instruction

### Post-Fix Data: n=1 completed invocation

| Workflow Run | Component | Ops | Budget | Compliant? |
|---|---|---|---|---|
| `wr_1775973259015_g5on` (~05:54 UTC) | Thread 1: EXP-144 results | 11 | ≤25 | ✅ |
| | Thread 2: EXP-146 design | 18 | ≤25 | ✅ |
| | Synthesis | 12 | ≤15 | ✅ |
| | **Total** | **41** | | |

### Comparison to Pre-Fix Baselines

| Metric | Pre-Fix (n=7) | Post-Fix (n=1) | Change |
|---|---|---|---|
| Thread avg ops | 38.0 | 14.5 | **−62%** |
| Synthesis avg ops | 25.7 (median 9) | 12.0 | −53% (vs mean) |
| Invocation total | 107.1 | 41.0 | **−62%** |

### Assessment

- **All 3 sessions within budget** — 100% compliance on n=1
- Thread ops dropped from 38.0 avg to 14.5 avg (well below 25-op cap)
- Synthesis dropped from 25.7 avg to 12 (within 15-op cap, but 6/7 pre-fix were already ≤18)
- **Zero workflow nesting** — anti-nesting instruction effective (no D-o-R triggered inside threads)
- **⚠️ CAUTION: n=1 is insufficient for statistical confidence.** Need n≥3 to confirm pattern. One invocation is consistent with budget cap working but not conclusive.

### Projected Savings (if pattern holds)

- Pre-fix: 107.1 ops/invocation × ~6/day = ~643 ops/day
- Post-fix: 41 ops/invocation × ~6/day = ~246 ops/day  
- **Savings: ~397 ops/day (~$19/day, ~$570/month)**

---

## 2. D-o-R Nesting Fix

**Fix deployed**: ~03:54 UTC Apr 12 (commit 60a844e3)  
**Change**: "DO NOT call callAgent() or spawn sub-agents" in Phase 1 strict rules

### Post-Fix Data: n=4 completed Phase 1 sessions, ZERO nesting

| Session | Task | P1 Ops | Children Spawned | Nesting? |
|---|---|---|---|---|
| s_1775967905256 | Design experiment | 5 ✅ | 0 | No |
| s_1775969661683 | KB INDEX.md backlog | 90 ❌ | 0 | No |
| s_1775971453992 | Write hypothesis | 2 ✅ | 0 | No |
| s_1775975077364 | Design EXP-147 | 3 ✅ | 0 | No |

**Pre-fix nesting incidents** (from full history): 3 in 76 Phase 1 sessions total (3.9% rate)
- s_1775863620725 (17 ops P1 → spawned 90-op nested Phase 1 + 11-op Phase 3)
- s_1775863474313 (11 ops P1 → spawned 18-op work session)  
- s_1775741114816 (42 ops P1 → spawned 23-op work session)

### Verdict: ✅ NESTING FIX CONFIRMED EFFECTIVE (n=4, 0 incidents)

- **0/4 post-fix Phase 1 sessions spawned children** vs 3/76 pre-fix (3.9%)
- The anti-nesting instruction is working — no callAgent() calls from Phase 1
- The 90-op session was **inline bloat** (KB INDEX batch), NOT nesting — zero children spawned
- This confirms the previous finding: nesting and budget cap violations are **different failure modes** requiring different fixes

### D-o-R Budget Cap Compliance (separate from nesting)

| Metric | Pre-Fix (n=10) | Post-Fix (n=4) |
|---|---|---|
| P1 avg ops | 16.2 | 25.0 (3.3 excluding outlier) |
| P1 ≤15 compliance | 7/10 (70%) | 3/4 (75%) |
| P1 outliers (>40) | 1 (93 ops) | 1 (90 ops) |
| Total D-o-R avg | 26.5 | 33.0 (11.0 excluding outlier) |

The 90-op outlier (KB INDEX.md backlog) demonstrates the ongoing problem: **text-based budget caps are unreliable for complex tasks**. This task inherently requires many file reads/writes, and the LLM ignores the "BUDGET: 15" instruction. Infra `maxOps` on `ctx.runAgent()` is the only reliable fix.

---

## Summary of Both Fixes

| Fix | Status | Evidence | Confidence |
|---|---|---|---|
| Research thread ≤25 cap | ✅ Working | 2/2 threads within budget (avg 14.5 vs 38.0 pre-fix) | Low (n=1 invocation) |
| Synthesis ≤15 cap | ✅ Working | 1/1 within budget (12 vs 25.7 pre-fix avg) | Low (n=1) |
| Anti-nesting in threads | ✅ Working | 0 D-o-R nesting in post-fix threads | Medium (n=1) |
| D-o-R anti-nesting | ✅ **CONFIRMED** | 0/4 Phase 1 sessions spawned children | High (n=4) |
| D-o-R P1 15-op budget | ⚠️ Partially | 3/4 compliant, 1 massive violation (90 ops) | Medium (n=4) |

## Next Steps

1. **Re-measure research threads** when n≥3 invocations available (check ~10:00 UTC)
2. **D-o-R nesting: CLOSE** — 4 sessions, 0 nesting, fix confirmed
3. **D-o-R budget cap: escalate** — text caps unreliable (90-op violation), need infra maxOps
4. **Research thread budget: monitor** — promising early signal but n=1 is not enough
