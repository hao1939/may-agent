# EXP-139 T+1h Checkpoint — verify-wrap Production Pilot on Optimizer

**Date**: 2026-04-11T16:30Z  
**Author**: Coach (automated analysis)  
**Period**: T+0h to T+1h (deployment at 15:54Z)  
**Status**: ✅ Successfully deployed, first verify-wrap session completed

---

## Executive Summary

EXP-139 was successfully deployed at 15:54Z. The optimizer heartbeat was patched to use `workflow.run('verify-wrap', task)` as the default dispatch for forked work sessions. **One** verify-wrap session has completed (out of one eligible post-patch heartbeat), showing 100% adoption (N=1). Phase 2 verification worked correctly — it read back both deliverable files and confirmed their contents in 18 seconds with minimal overhead.

**Critical caveat**: N=1 is insufficient for any statistical conclusion. This is a mechanical health check, not an effectiveness assessment. The 72-hour post-period is required for proper evaluation.

---

## 1. Deployment Status

| Component | Status | Evidence |
|-----------|--------|----------|
| verify-wrap.ts agent hardcoding | ✅ Changed to "optimizer" | EXP-139 deployment log |
| Heartbeat patch applied | ✅ Applied at 15:54:15Z | `agents/optimizer/heartbeat.md` mtime |
| First post-patch heartbeat | ✅ 16:23Z (s_1775924621783_1507) | sessions table |
| First verify-wrap session | ✅ 16:24Z (wr_1775924663862_kijn) | workflowRunId in sessions table |
| Phase 2 verification | ✅ Completed successfully | Session s_1775924904679_1520 |
| Errors/crashes | ✅ None | No error status sessions |

---

## 2. Pre-Deployment Baseline (What We're Measuring Against)

### 2.1 Optimizer FM-3.3 Block Rate (Full 7d)

| Period | Sessions | FM-3.3 Rate | Notes |
|--------|----------|-------------|-------|
| Apr 6 | 21 | 19.0% | Low rate period |
| Apr 7 | 57 | 29.8% | |
| Apr 8 | 39 | 12.8% | Dip — possible task-type effect |
| Apr 9 | 49 | 12.2% | |
| Apr 10 | 61 | **62.3%** | Spike — matches EXP-136 finding |
| Apr 11 (pre-patch) | 42 | **59.5%** | Continued high rate |
| **Overall** | **269** | **35.3%** | Dominated by heartbeats |

### 2.2 FM-3.3 Rate by Session Type

| Session Type | N | FM-3.3 Rate | Notes |
|---|---|---|---|
| Heartbeats | 231 | 31.6% | Lower — heartbeats are simpler |
| **Work sessions** | **31** | **54.8%** | **Primary target** |
| Other | 6 | 83.3% | Small N |

### 2.3 Work Session FM-3.3 Daily Trend

| Date | Work Sessions | FM-3.3 Rate |
|------|---------------|-------------|
| Apr 7 | 3 | 0.0% |
| Apr 8 | 1 | 100.0% |
| Apr 10 | 11 | **63.6%** |
| Apr 11 (pre-patch) | 20 | **65.0%** |

**Stable baseline (Apr 10-11): ~64% FM-3.3 block rate for optimizer work sessions.**

This is close to (but slightly below) the 67% cited in the design. The difference is methodological — EXP-136 used a different counting window.

### 2.4 Historical Averages for Optimizer Work Sessions

| Metric | Value (7d, N=57) |
|--------|-----------------|
| Average ops | 34.0 |
| Median ops | ~28 |
| Range | 0–108 |
| Average duration | Variable |

---

## 3. Post-Deployment Data (N=1)

### 3.1 Adoption Check

| Metric | Value |
|--------|-------|
| Post-patch heartbeats | 1 (16:23Z) |
| Work sessions dispatched | 1 |
| Dispatched via verify-wrap | **1 (100%)** |
| Dispatched via raw fork | **0** |

**Note**: The session at 15:54:21Z (s_1775922861796_1503) was dispatched by the 15:53Z heartbeat, which started BEFORE the patch was applied at 15:54:15Z. It used raw fork, as expected for a pre-patch heartbeat.

### 3.2 verify-wrap Session Details

| Session | Phase | Ops | Duration | Status | Details |
|---------|-------|-----|----------|--------|---------|
| s_1775924663865_1514 | Phase 1 (execute) | 23 | 4m00s | ✅ success | Wrote finding file + checklist |
| s_1775924904679_1520 | Phase 2 (verify) | ~3* | 18s | ✅ success | Read both files, confirmed contents |
| **Total** | **Combined** | **~23-26** | **~4m18s** | ✅ | |

*Phase 2 reported 0 ops but had 3 turns with tool calls. Op counting for workflow child sessions may be incomplete.

### 3.3 Phase 2 Verification Quality

Phase 2 correctly identified and verified both written files:
1. `DELIVERABLES_CHECKLIST.md` — confirmed exists, non-empty, checklist checked off
2. `agents/optimizer/workspace/finding-verify-wrap-adoption-0411.md` — confirmed exists, non-empty, substantive content with:
   - Concrete adoption numbers
   - Success/failure rates
   - Comparison with raw fork sessions

**Assessment**: Phase 2 performed genuine verification (not fabricated). ✅

### 3.4 Cost Analysis (N=1)

| Metric | Value | Historical Avg | Delta |
|--------|-------|---------------|-------|
| Phase 1 ops | 23 | 34.0 | -32.3% |
| Phase 2 ops | ~3 | N/A | N/A |
| Total ops | ~26 | 34.0 | **-23.5%** |

**Interpretation**: The first verify-wrap session was actually CHEAPER than the historical average. This is likely noise (N=1), but it suggests the Phase 2 overhead is minimal.

---

## 4. Hypothesis Status at T+1h

| ID | Hypothesis | T+1h Status | Notes |
|---|---|---|---|
| H-139a | FM-3.3 rate drops ≥20pp | ⏳ Unmeasurable | Need N≥15 post-patch sessions |
| H-139b | ≥90% Phase 2 read-back | ✅ 1/1 (100%) | N too small for conclusion |
| H-139c | Phase 2 ≤10 ops | ✅ ~3 ops | Well within limit |
| H-139d | ≥70% adoption rate | ✅ 1/1 (100%) | N too small for conclusion |
| H-139e | Net cost ≤+20% | ✅ -23.5% | Actually cheaper (but N=1) |

---

## 5. Concerns and Observations

### 5.1 FM-3.3 Measurement Complexity

The design assumes verify-wrap will reduce the "genuine FM-3.3 block rate." But verify-wrap's mechanism is:
- **Phase 1**: Agent executes normally → FM-3.3 guard still fires on finish(success) if verification is missing
- **Phase 2**: Separate session reads files → This session has verification, so FM-3.3 won't fire here

**Key question**: Does the FM-3.3 rate include Phase 2 sessions? If yes, the rate mechanically decreases (Phase 2 always has verification). If no (only Phase 1), the rate may not change at all — the agent's in-session behavior hasn't changed.

**Recommendation**: Measure at THREE levels:
1. **Phase 1 only**: Does verify-wrap's context cause the agent to verify more?
2. **Phase 1 + Phase 2**: Does adding Phase 2 dilute the rate?
3. **Workflow-level**: Does the overall workflow "pass" verification? (This is the quality metric)

### 5.2 Baseline Instability

The FM-3.3 rate is volatile:
- Apr 6-9: 12-30% (low period)
- Apr 10-11: 60-65% (high period)

The design uses 67% as baseline, which is from the peak. If the rate naturally regresses to 30-40%, a post-patch measurement of 40% could be mistaken for a treatment effect. 

**Mitigation**: Use the interrupted time series design as specified. Look for a LEVEL CHANGE at the deployment point, not just a before/after comparison.

### 5.3 Phase 2 Op Counting

Phase 2 reported 0 ops despite having 3 turns with read() calls. This may indicate:
- Ops are tracked at the manager level but Phase 2 sessions use a different counting path
- read() calls aren't counted as ops
- The session tracking is incomplete for workflow child sessions

**Impact**: May affect H-139c and H-139e measurements. Need to investigate op counting for workflow child sessions.

---

## 6. Abort Criteria Check

| Criterion | Status |
|-----------|--------|
| Escalation rate > 30% | ✅ 0% (0/1 sessions) |
| Quality drop | ✅ No evaluation yet, but Phase 1 completed normally |
| False positives in Phase 2 | ✅ Phase 2 verification was genuine |
| Framework errors | ✅ None observed |

**Decision**: ✅ Continue experiment. No abort criteria triggered.

---

## 7. Next Steps

1. **T+24h (Apr 12, ~16:00Z)**: Run Checkpoint 1 per design. Expect ~6-8 work sessions. Check adoption rate, FM-3.3 rate, Phase 2 quality.
2. **T+48h (Apr 13, ~16:00Z)**: Interim analysis. Should have ~12-16 work sessions. Look for trend.
3. **T+72h (Apr 14, ~16:00Z)**: Final evaluation. Full hypothesis assessment.
4. **Investigate Phase 2 op counting**: Determine if 0 ops is accurate or a measurement bug.
5. **Freeze optimizer changes**: Confirm no other optimizer prompt/skill changes are scheduled during the 72h window.

---

## Appendix: Session Timeline

```
15:23:00Z  Heartbeat s_1775921020093_1483 (PRE-PATCH, read old heartbeat)
15:24:34Z  → Fork s_1775921074605_1492 (Mode B, RAW fork) - pre-patch
15:53:00Z  Heartbeat s_1775922821453_1496 (PRE-PATCH, read old heartbeat)
15:54:15Z  *** HEARTBEAT PATCH APPLIED ***
15:54:21Z  → Fork s_1775922861796_1503 (Mode C, RAW fork) - dispatched by pre-patch HB
16:23:00Z  Heartbeat s_1775924621783_1507 (POST-PATCH, read new heartbeat) ✅
16:24:23Z  → verify-wrap s_1775924663865_1514 (Mode D, VW Phase 1) ✅
16:28:24Z  → verify-wrap s_1775924904679_1520 (VW Phase 2, verification) ✅
```
