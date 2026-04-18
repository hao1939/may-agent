# Finding: verify-wrap Cost/Benefit Analysis

**Date**: 2026-04-11 ~20:54 UTC  
**Mode**: D (Workflow Health)  
**Status**: COMPLETE

## Executive Summary

**verify-wrap adds measurable overhead with zero detected benefit.** In 9 completed cycles, verification never caught an actionable issue (0% catch rate). Verification sessions record 0 ops but consume ~$0.02/session in token costs. Total cycle cost is 4.8 ops higher post-verify-wrap (42.9 vs 38.1 pre-WF), driven by work session variance, not verification itself. The one instance where verification noticed something (unchecked DELIVERABLES_CHECKLIST items) was reported as status="done" — the finding was lost and never acted upon.

**Verdict**: verify-wrap is currently **pure overhead** for optimizer. Recommend either (a) removing it, or (b) fixing the failure-detection logic so issues actually trigger remediation.

## Data

### Sample Size
- **Post-verify-wrap**: 9 completed cycles (16:24–20:29 UTC on Apr 11)
- **Pre-verify-wrap**: 32 cycles (21:23 Apr 10 – 15:53 Apr 11)
- All from optimizer agent only

### Verification Session Metrics

| Metric | Value |
|--------|-------|
| Total verify sessions | 9 |
| Verify ops (recorded) | 0 (all sessions) |
| Verify status | 100% "done" (never "failure") |
| Issues detected | 1/9 (11%) — unchecked checklist items |
| Issues acted upon | 0/9 (0%) |
| Est. token cost per verify | ~$0.02 (5K input + 500 output) |
| Projected daily cost | ~$0.96/day (48 sessions) |

### Cycle Cost Comparison (HB + Work + Verify)

| Period | Cycles | Avg Ops/Cycle | Notes |
|--------|--------|---------------|-------|
| Pre-verify-wrap | 32 | 38.1 | HB + inline forked work |
| Post-verify-wrap | 9 | 42.9 | HB + WF work + verify (0 ops) |
| **Delta** | — | **+4.8 (13%)** | Variance in work session size, not verify overhead |

### Work Session Ops Comparison

| Period | Count | Avg Work Ops | Range |
|--------|-------|-------------|-------|
| Pre-verify-wrap (raw fork) | 32 | 33.7 | 9–75 |
| Post-verify-wrap (WF work) | 9 | 40.1 | 19–73 |

The 6.4-op increase in work session size is NOT caused by verify-wrap — it's natural variance in task complexity. The verify sessions themselves are 0 ops.

### Session Volume Impact

| Period | Sessions/Hour | Notes |
|--------|--------------|-------|
| Pre-verify-wrap | 3.7 | HB + 1 work session per cycle |
| Post-verify-wrap | 6.1 | HB + 1 work + 1 verify + 1 WF driver per cycle |

verify-wrap **doubles session count** (4 sessions per cycle vs 2), though most extra sessions are 0-op.

## Detailed Findings

### 1. Verification Never Catches Actionable Issues

All 9 verification sessions reported status="done" with positive outcomes:
- "Both files read successfully" / "All three files read successfully"
- Content confirmed as matching task requirements
- No placeholders or TODOs found

The one partial exception (20:01 UTC) noted "both items are unchecked `[ ]`" in DELIVERABLES_CHECKLIST.md but still reported status="done". This finding was:
1. Not flagged as a failure
2. Not communicated back to the heartbeat
3. Not acted upon by any subsequent session
4. Effectively lost

### 2. Why Verification Always Passes

The work sessions already have strong completion incentives:
- DELIVERABLES_CHECKLIST.md production guard (enforced by infrastructure)
- `finish()` with verification_evidence (required for success status)
- Explicit task objectives with measurable completion criteria

verify-wrap is **redundant** — the work session already self-verifies via these mechanisms.

### 3. verify-wrap Logic Gap

The verify-wrap code at `agents/shared/workflows/verify-wrap.ts` has a detection gap:
```javascript
const verifyFailed =
    phase2.status === "error" ||
    verifyText.toLowerCase().includes("status: \"failure\"") ||
    verifyText.toLowerCase().includes("status: 'failure'") ||
    verifyText.toLowerCase().includes("verification failed");
```

The verification agent reports status via `finish()`, not via text matching. So the "failure detection" in verify-wrap checks text content that's never actually present. The verification agent would need to explicitly include the string "verification failed" in its text output for this to trigger.

### 4. Hidden Token Cost

Verify sessions show 0 opCount in the sessions table, but they DO execute read() calls (confirmed by outcome text). This means:
- Either read() calls aren't counted in opCount, or
- opCount is populated differently for workflow sub-sessions

Regardless, each verify session sends a prompt (~5K tokens) and receives a response (~500 tokens). At $3/Minput + $15/M output:
- Per session: ~$0.015 input + $0.0075 output = **~$0.023**
- 48 sessions/day projected: **~$1.10/day**

This is small but nonzero overhead for zero detected benefit.

### 5. Session Count Inflation

Each verify-wrap cycle creates 4 sessions:
1. Heartbeat (dispatcher)
2. Workflow run (driver)
3. Work session (Phase 1)
4. Verify session (Phase 2)

Pre-verify-wrap, each cycle created 2 sessions:
1. Heartbeat (dispatcher)
2. Forked work session

This inflates session count metrics by ~65% (from 3.7 to 6.1 sessions/hour), though the extra sessions are lightweight.

## D-o-R Phase 1 Cap Compliance Check

No bob D-o-R sessions found in last 2 hours — unable to check compliance. This is consistent with normal session scheduling gaps.

## Workflow Adoption Rate Update

| Period | WF Sessions | Total | Rate |
|--------|------------|-------|------|
| Apr 10 | 40 | 520 | 7.7% |
| Apr 11 | 69 | 559 | **12.3%** |

By agent (Apr 11):
- bob: 46.3% (D-o-R)
- optimizer: 19.0% (verify-wrap — all new today)
- All others: 0%

The optimizer's 19% adoption is entirely verify-wrap, introduced at ~16:23 UTC.

## Recommendations

### Option A: Remove verify-wrap (recommended)
Revert optimizer heartbeat to use `agents.fork()` instead of `workflow.run('verify-wrap', ...)`. 
- Saves ~$1.10/day token costs
- Eliminates 48 sessions/day of noise
- No quality loss (0% actual catch rate)

### Option B: Fix verify-wrap to be useful
If keeping verify-wrap:
1. Fix failure detection: check `phase2.status` from `finish()` call, not text matching
2. Add retry/fix phase: when verification fails, auto-retry or alert
3. Connect verification results to next heartbeat's context
4. Add structural checks: file size > threshold, required sections present

### Option C: Targeted verify-wrap
Only use verify-wrap for BUILD-mode sessions (code changes) where verification catches real bugs. Skip for analysis/finding sessions where the "deliverable" is a markdown file.

## Methodology
- Queried may.db sessions table for all optimizer sessions in last 24h
- Categorized by task type (heartbeat, work session, verification) and workflow presence
- Computed per-cycle costs by pairing heartbeats with their forked work sessions
- Analyzed all 9 verification outcomes for issue detection
- Checked verify-wrap.ts source code for failure detection logic
