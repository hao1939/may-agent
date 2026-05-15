# Common Sense Infra Review — 2026-06-26

## Summary

common-sense.md is stable — no changes since last review. Two infra items from prior reviews remain unbuilt. No new coach requests found.

## Highest Priority Unbuilt Mechanism: C12.1 Checker Patch (P0, 2+ months overdue)

**File:** `agents/may/handlers/convention-check.ts` line 643

The `BASH_ORIENTATION` regex doesn't include `echo`:
```ts
const BASH_ORIENTATION = /^(grep|rg|find|ls|cat|head|tail|git|bun)\b/;
```

Any session starting with `echo` or piped commands using `;` as separator gets a false C12.1 violation. The prefix-stripping regex (line ~651) only handles `&&`, not `;`.

**Fix (2 lines):**
1. Add `echo` to `BASH_ORIENTATION`: `/^(grep|rg|find|ls|cat|head|tail|git|bun|echo)\b/`
2. Extend prefix strip to handle `;`: change `&&\s*` patterns to `(&&|;)\s*`

**Status:** Identified April 18. Dispatched in June 25 brief but no tech-lead project found. Needs re-dispatch.

## Second Priority: C1.3 Write-Readback Nudge (P1)

Coach reports C1.3 compliance chronically at ~15%. Design from June 25 brief:

> After every `write()` call, append a one-line advisory reminder to the tool response: `💡 Reminder: read back this file to verify your change landed correctly.`

**Location:** Tool response pipeline (likely in lifecycle.ts or a guard hook).  
**Risk:** Low — advisory only, not blocking.  
**Expected impact:** 15% → 40-50% compliance (based on in-context reminder evidence).

No implementation found. Needs dispatch.

## Coach-Flagged Items

No active coach requests in the tracking DB. Coach's `convention-compliance` project lists C1.3 and C12.1 as targets but hasn't requested infra changes — these are already known from prior bob reviews.

## Ownership Updates

None needed. common-sense.md is unchanged and human-controlled.

## Actions
- [ ] **P0**: Re-dispatch C12.1 patch to tech-lead (2-line fix in convention-check.ts)
- [ ] **P1**: Dispatch C1.3 nudge to tech-lead (advisory text after write() calls)
