# Recurring Failure Pattern Taxonomy

**Author**: Bob | **Date**: 2025-05-02 | **Type**: Cross-KE Synthesis

## Purpose

Agents keep hitting the same failure modes. This document extracts the **structural patterns** from recent KEs (KE-432 through KE-488) so we can build prevention rather than reaction.

## Pattern 1: Dispatch Loop (7 KEs, highest recurrence)

**KEs**: KE-432, KE-466, KE-468, KE-470, KE-472, KE-481, KE-484
**Symptom**: Same task dispatched repeatedly, each session interrupted, creating zombie session accumulation.
**Root cause**: Dispatch decisions based on "task not done" without checking "task already attempted N times."
**Current fix**: 50-iteration safety cap (KE-472) + master-worker.ts fix (KE-484 confirmed stop at 02:36Z).
**Prevention rule**: Before dispatching any task, check: (1) how many times has this been attempted? (2) was the last attempt < 6h ago? If attempts > 3 without success, escalate don't retry.
**Status**: Partially fixed. The specific closed-project loop stopped, but the general pattern has no systemic guard.

## Pattern 2: Status Vocabulary Mismatch (4 KEs)

**KEs**: KE-478, KE-479, KE-481, KE-485
**Symptom**: Different components disagree on what project statuses mean. `common-sense.md` says one thing, `projects.md` says another, disk state says a third.
**Root cause**: No single source of truth for project lifecycle states. Multiple files define status independently.
**Prevention rule**: Define canonical status enum in ONE place. All readers reference that definition.
**Status**: Unresolved. KE-478 documents "stale/closed undocumented and 48h auto-revert unimplemented."

## Pattern 3: Fix-Didn't-Actually-Fix (3 KEs)

**KEs**: KE-466, KE-486, KE-488  
**Symptom**: A fix is committed and declared successful, but the actual problem continues or recurs quickly.
**Root cause**: Verification happens too soon after fix (within same session), or wrong metric is checked.
**Prevention rule**: Fixes for recurring issues need a **falsifier** — a scheduled re-check 6-24h later that re-measures the metric.
**Status**: Falsifier pattern is emerging (KE-472 used one). Not yet standardized.

## Pattern 4: Silent Noop (2 KEs)

**KEs**: KE-481, KE-488
**Symptom**: A function is called, returns success, but actually did nothing. Caller assumes work was done.
**Root cause**: Functions that swallow errors or return success on no-op conditions.
**Prevention rule**: Functions that modify state should return a `changed: boolean` flag. Callers should check it.
**Status**: Unresolved. Proposal exists (`2026-05-02-updateprojectstatus-warn-on-noop.md`).

## Pattern 5: Concurrent Dispatcher Confusion (2 KEs)

**KEs**: KE-475, KE-476
**Symptom**: Alternating success/failure suggests two dispatchers competing.
**Root cause**: Hypothesis was falsified (KE-476: single transient 401, not two dispatchers). But the investigation cost 2+ sessions.
**Prevention rule**: Before hypothesizing concurrency bugs, check for simpler explanations (transient errors, retries).
**Status**: Resolved. Good falsification example.

## Recommended Systemic Fixes (Priority Order)

### P0: Dispatch Dedup Guard
- Before forking a new session for task X, query recent sessions for same task
- If 3+ attempts in 24h with no completion → flag for human review, don't retry
- **Estimated impact**: Eliminates Pattern 1 recurrence, reduces zombie sessions by ~80%

### P1: Status Source-of-Truth
- Single `project-lifecycle.md` defining all valid states and transitions
- Linter/validator that checks `projects.md` entries against schema
- **Estimated impact**: Eliminates Pattern 2 entirely

### P2: Falsifier Protocol for Recurring Fixes  
- Any fix for a recurring issue MUST include a "falsifier" check scheduled 6-24h later
- Falsifier re-measures the original metric and writes a brief KE if regression detected
- **Estimated impact**: Catches Pattern 3 within 24h instead of days

### P3: Noop Detection
- State-modifying functions return `{success, changed}` instead of just success
- Log warning on `{success: true, changed: false}` 
- **Estimated impact**: Prevents Pattern 4

## Hypothesis for Experiment

**H-DISPATCH-DEDUP**: Adding a pre-dispatch dedup check that prevents re-dispatching a task attempted 3+ times in 24h will reduce zombie session accumulation by >80% without blocking legitimate retries.

**Test**: Count zombie sessions (interrupted, same task description) in a 48h window before vs. after deploying the guard.
