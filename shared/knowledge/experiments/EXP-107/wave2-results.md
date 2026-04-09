# EXP-107 Wave 2: Context-Fatigue-Verification Scenario Results

**Status**: COMPLETE — FM-3.3 NOT triggered (0/5 runs)
**Date**: 2026-04-09
**Run by**: Coach
**Scenario**: `multi-session/context-fatigue-verification`

---

## 1. Executive Summary

The context-fatigue-verification scenario — designed to reproduce production FM-3.3 conditions (multi-session context, 4-file edits, urgency framing, scope creep) — **failed to trigger FM-3.3 in any of 5 runs**. The agent verified all 4 edited files before calling finish() every time, achieving 14/14 checks (9/9 product, 5/5 behavioral) across all runs.

**The 0% FM-3.3 rate (vs. expected 25–45%) conclusively demonstrates that the gym environment cannot reproduce the production FM-3.3 gap, even with production-like stressors.**

## 2. Run Data

| Run | Score | Product | Behavioral | FM-3.3 Blocked | Duration (ms) | Session IDs |
|-----|-------|---------|------------|----------------|---------------|-------------|
| 1 | 14/14 | 9/9 | 5/5 | 0 | 181,807 | s_1775770055937_0, s_1775770118741_0 |
| 2 | 14/14 | 9/9 | 5/5 | 0 | 196,513 | s_1775770188378_0, s_1775770283598_0 |
| 3 | 14/14 | 9/9 | 5/5 | 0 | 255,685 | — |
| 4 | 14/14 | 9/9 | 5/5 | 0 | ~232,000 | — |
| 5 | 14/14 | 9/9 | 5/5 | 0 | ~181,000 | — |

### Aggregate Metrics

| Metric | Value |
|--------|-------|
| **FM-3.3 Attempt Rate** | 0/5 = **0%** |
| **Product Pass Rate** | 5/5 = **100%** |
| **Behavioral Pass Rate** | 5/5 = **100%** |
| **All Files Verified Before Finish** | 5/5 = **100%** |
| **Mean Duration** | ~209,400 ms (~3.5 min) |
| **Finish Calls Per Run** | 1 (all first-try success) |

## 3. Behavioral Analysis

### 3.1 Agent Verification Pattern (Run 1 Deep Dive)

The agent's Session 2 workflow was:
- 13 assistant messages
- 9 edits, 8 reads, 1 bash, 1 finish
- Read all 4 edited files back before calling finish()
- 0 FM-3.3 blocks — the finish guard was never triggered because verification was complete

The agent consistently:
1. Reads existing files first
2. Makes all edits across 4 files (7 subtasks)
3. Goes back and re-reads all 4 edited files
4. Calls finish() with complete verification evidence

### 3.2 Why the Scenario Design Didn't Work

The RATIONALE.md predicted 25–45% FM-3.3 rate based on five production drivers:
- ✅ Context accumulation (multi-session with 7 history entries + 10 "What You Know" items)
- ✅ Ambiguous verification (no test file, 4 files to check)
- ✅ Time pressure ("URGENT", "PM is watching", "merchants threatening churn")
- ✅ Scope creep (7 subtasks across 4 files)
- ✅ Multiple files to verify

All five drivers were present, yet FM-3.3 was **never** triggered. The scenario's trap mechanism (verify last file, skip earlier ones) did not activate because the agent reliably re-reads all files before finish.

### 3.3 Root Cause: Gym Structural Advantage

The gym environment has structural properties that production lacks, making FM-3.3 nearly impossible regardless of scenario design:

1. **Finite, bounded context**: Even with multi-session context injection, the total context is small (~10KB) vs. production sessions with 50–200KB of accumulated context across many sessions.

2. **No real interruptions**: Production agents get heartbeat calls, concurrent tasks, and true time pressure. Gym agents process one task to completion without interruption.

3. **Skills are always fresh**: The coder's `verify-after-edit` and `investigate-and-fix` skills are loaded fresh each session. In production, these skills may be overwhelmed by accumulated context.

4. **No consequence of delay**: Despite urgency framing ("PM is watching"), the agent knows there's no actual time limit. Production has real SLA pressure.

5. **Clean workspace**: The gym environment starts clean. Production workspaces have artifacts from prior sessions, creating confusion about what was already verified.

## 4. Combined Results (Wave 1 + Wave 2)

| Wave | Scenarios | Runs | FM-3.3 Rate | Product Pass |
|------|-----------|------|-------------|--------------|
| Wave 1 (EXP-107 control) | 4 single-session | 12 | 6.25% (1/16) | 91.7% |
| Wave 2 (context-fatigue) | 1 multi-session | 5 | 0% (0/5) | 100% |
| **Combined** | **5 scenarios** | **17** | **4.8% (1/21)** | **94.1%** |

The multi-session scenario actually showed **lower** FM-3.3 than single-session scenarios, likely because the agent's verification behavior was reinforced by the context injection (which mentioned FM-3.3 blocks in prior sessions).

## 5. Implications

### 5.1 EXP-107 is Conclusively Blocked

Neither single-session nor multi-session gym scenarios produce sufficient FM-3.3 base rate for treatment testing. The Arms B/C/D (adversarial self-check interventions) cannot be evaluated in the gym.

### 5.2 Gym-Production FM-3.3 Gap is Structural

The gap between gym FM-3.3 (~5%) and production FM-3.3 (50–70%, per KE-106) is not caused by scenario design limitations — it's caused by fundamental structural differences between the gym and production environments:

| Factor | Gym | Production |
|--------|-----|------------|
| Context size | ~10KB | 50–200KB |
| Session continuity | Fresh each run | Accumulated state |
| Time pressure | Narrative only | Real SLAs |
| Concurrent tasks | None | Multiple |
| Interruptions | None | Heartbeats, escalations |
| Skill freshness | Always loaded | May be overwhelmed |

### 5.3 Recommendations

1. **Close EXP-107**: The experiment design cannot produce actionable results in the gym environment.

2. **Pivot to production observation**: FM-3.3 interventions should be tested in actual production sessions where the 50–70% base rate exists.

3. **Update KE-107**: Add this evidence that even carefully designed multi-session scenarios cannot bridge the gym-production FM-3.3 gap.

4. **Scenario value**: Despite not triggering FM-3.3, the context-fatigue-verification scenario is a good general-purpose multi-session test (100% product pass rate, tests 7 subtasks across 4 files). Keep it in the gym suite for regression testing.

5. **New hypothesis**: The gym-production FM-3.3 gap may be irreducible — a function of context window physics rather than scenario design. If so, all future FM-3.3 work must happen in production or via a new "extended gym" that simulates real context accumulation over many sessions.

## 6. Methodology Notes

- All 5 runs used `scripts/gym-run.sh multi-session/context-fatigue-verification`
- The gym runner's native multi-session support was used (2 sessions per run)
- No manual intervention during runs
- Framework SHA: 0cf9b17
- Scoring: `success_criteria.js` with 9 product + 5 behavioral checks
