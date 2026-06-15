# Proposal: Implement KE-2000 Structural Overhead Reduction (3 Priority Specs)

## Problem

The system's productive fraction is ~10% (KE-1998). Three independently-measured
overhead sources (guard triggers, planning interrupts, dead session resumes) all
scale with infrastructure state rather than useful work. Static threshold
calibration has failed — 5 threshold raises in 9 days, each buying less time
(4d → 3d → 1d → <1d). The guard metric (4558) has already breached the latest
threshold (4500) set ~18h ago (KE-1999 F1 confirmed).

KE-2000 provides four scoped repair specifications with testable falsifiers.
This proposal queues the three highest-confidence specs for implementation.

## Evidence (current session data, 2026-06-15)

### Guard noise (Spec 3)
- 4,480/4,568 (98.1%) of 24h guard triggers are `beforeToolCall` warnings
- 100% of those (4,480/4,480) are `warned` action — zero blocks, zero behavior changes
- All fire because "uncommitted files exist" in the shared worktree — files that
  **the guard itself identifies as irrelevant** to the current session
- Threshold calibration history: 2000→2500→3500→4500→breached again. Unsustainable.

### Quick-exit sessions (Spec 2)
- 1,477/9,582 (15.4%) of 7-day sessions have opCount ≤ 10
- 0/1,479 quick-exit sessions (7d) have non-null error fields (falsifier check: 0% vs <5% threshold = safe)
- dev agent: 95.7% quick-exit rate (132/138 sessions, avg 8.3 ops), doing ~1,141 total ops over 3 days
- Evaluating these sessions costs more than the sessions themselves

### Dead session resume (KE-1997)
- 574 distinct dead sessions targeted by resume_failed events in 24h
- All 574+575 events target the same 2 dead session IDs (planner sessions)
- Pure waste: the sessions don't exist, yet the system retries hundreds of times per day

## Proposed Changes

### P1: Guard noise scoping (KE-2000 Spec 3)
Scope commit-guard `beforeToolCall` warnings to session-relevant files only.
The guard already identifies which files belong to the current session — it
just warns about all dirty files anyway.

**Expected impact:** ~88% reduction in guard triggers (4480→~540/day).
Eliminates threshold ratcheting. Reduces context pollution by ~14%.

**Falsifier:** If >50% of current beforeToolCall warnings reference files
modified in the triggering session, scoping won't help. Current data shows 0%
— all warnings are about other sessions' files.

### P1: Quick-exit evaluation exemption (KE-2000 Spec 2)
Skip evaluator aftermath for sessions with opCount ≤ 10, status = done, and
no error. These sessions are trivially categorizable from metadata alone.

**Expected impact:** ~15% reduction in evaluator sessions. 0% information loss
(error rate in this cohort is 0.0% across 1,479 7-day sessions).

**Falsifier:** If >5% of ≤10-op sessions have non-null error fields, the
threshold needs adjustment. Validated: 0.0%.

### P2: Dead session resume suppression
Stop retrying session.resume for sessions that return "not found". Currently
574 distinct dead sessions generate 1,149 resume_failed events per day, all
returning the same error.

**Expected impact:** ~580 fewer wasted events/day. Eliminates the ghost
metabolism pattern (KE-1997).

## Expected Impact (Combined)

Conservative estimate: 25-35% reduction in total system ops from Specs 2+3
alone. Guard threshold can be lowered back to 2,000 (from 4,500) after Spec 3.

## Risks

- **Spec 3 (guard scoping):** Requires understanding guard loader architecture.
  Structural guards (blocks, 10/day) remain unchanged — only ambient warnings
  are suppressed.
- **Spec 2 (quick-exit exemption):** One-line threshold check. No risk to LLM
  evaluations (those run on non-quick-exit sessions).
- **Dead session resume:** Needs investigation of where the retry loop lives.
  May be in project handler or workflow dispatcher.

## Source

KE-2000 (scout, 2026-06-15), KE-1998/KE-1999 (arc, 2026-06-15),
KE-1996/KE-1997 (scout, 2026-06-15).
