# Finding: finish() Status Overwritten by Interrupt

**Date:** 2026-03-18T06:07
**Severity:** HIGH — affects all completion tracking, evaluations, and metrics
**Category:** Infrastructure Bug

## Problem

77 out of 100 recent sessions (77%) called `finish()` successfully but are marked as `status: "interrupted"` in meta.json. The `finish()` completion signal is being discarded.

## Evidence

Analyzed 100 most recent sessions in `.state/sessions/history/`:
- **77 sessions** have `finish` in their receipts.jsonl but `"status": "interrupted"` in meta.json
- Affected agents: ALL (optimizer, coach, tech-lead, may, scout, amy, qa, evaluator, bob)
- Pattern is universal — no agent achieves "done" status except evaluator (2/100) and amy-kimi (4/100)

### Example: Coach session s_1773812764872_508
- 35 ops, called `finish()` at 05:51:47 (last receipt entry)
- meta.json shows `"status": "interrupted"`
- Session did real work: 33 bash calls, 11 reads, 2 writes, 2 workflows

### Example: Optimizer session s_1773813481354_517
- 36 ops, called `finish()` as final tool
- meta.json shows `"status": "interrupted"`

## Root Cause (Hypothesis)

The `autoClose: "immediate"` mechanism fires when a new heartbeat triggers. The sequence is:
1. Agent calls `finish(status: "success")` → tool executes, status briefly set to "done"
2. New heartbeat fires at interval → cron interrupts the session
3. Interrupt handler overwrites status to "interrupted"
4. Session archived with wrong status

The race condition: `finish()` and the cron interrupt arrive close together, and the interrupt wins.

OR: The interrupt fires DURING the finish() tool execution, before it can write the status.

## Impact

1. **Evaluations are wrong** — sessions marked "interrupted" get lower scores than deserved
2. **Agent metrics are wrong** — 0% completion rate for most agents is false (real rate is ~77%)
3. **skipIfIdle logic is wrong** — sessions that completed get counted as incomplete
4. **Hao's visibility is wrong** — dashboard/logs show constant interruptions when work is actually completing

## Proposed Fix

In the session interrupt handler, check if `finish()` was already called before overwriting status:

```typescript
// In session interrupt/close handler:
if (session.status === 'done' || session.finishCalled) {
  // Don't overwrite — agent completed gracefully
  return;
}
session.status = 'interrupted';
```

Alternative: Make `finish()` set a flag that prevents status changes.

## Estimated Value

This fix would:
- Correct completion tracking for ~77% of sessions
- Enable accurate evaluations
- Reduce false "interrupted" noise in logs
- Make agent performance metrics trustworthy
