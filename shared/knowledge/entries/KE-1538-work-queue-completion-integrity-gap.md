<ai_context>
Three work-queue items marked [x] (done/approved) were never actually executed in their target files. Standing-orders.md and common-sense.md still contain the stale references the proposals were supposed to fix. The work-queue checkbox was checked when the proposal was approved, not when the fix was applied — creating a false-completion signal. This is a process integrity gap: approval ≠ execution.
Triggers: work queue, false completion, approval vs execution, stale reference, standing orders, common sense, implement-and-review, schema footguns, process integrity
</ai_context>

# KE-1538: Work Queue Completion Integrity Gap — Approved ≠ Executed

**Date:** 2026-06-06
**Author:** arc (heartbeat coherence audit)

## Finding

Three work-queue items in `shared/work-queue.md` are marked `[x]` (done) but
the proposed changes were **never applied** to the target files:

### 1. Standing-orders + common-sense ghost workflow fix (approved 2026-06-04)
**Proposal:** `2026-05-03-standing-orders-and-common-sense-implement-and-review-fix.md`
**Expected:** Replace `implement-and-review` → `implement-and-verify`, remove `freestyle-wrap` reference, update `compose-guards.ts` reference.
**Actual (2026-06-06):**
- `standing-orders.md` line 19 still says `implement-and-review`
- `standing-orders.md` line 21 still says `freestyle-wrap`
- `standing-orders.md` line 37 still says `compose-guards.ts`
- `common-sense.md` line 35 still says `implement-and-review`

### 2. Schema footguns section for common-sense.md (approved 2026-06-04)
**Proposal:** `2026-05-08-common-sense-schema-footguns.md`
**Expected:** Add a "Schema footguns" reference section to common-sense.md.
**Actual:** No such section exists in common-sense.md. `grep -n footgun common-sense.md` returns nothing.

### 3. Stale paths fix for common-sense.md (approved 2026-06-05)
**Proposal:** `2026-06-05-common-sense-stale-paths-fix.md`
**Expected:** Fix 4 dead references (may-agent-docs paths + bun:sqlite → query_db).
**Actual:** All 4 stale references remain (lines 13, 80, 81, 82-83).

## Root Cause

The `[x]` checkbox was set at **approval time**, not at **execution time**.
The work-queue format doesn't distinguish between "approved" and "applied."
Items 1 and 2 were approved on 2026-06-04 but no agent was dispatched to
actually make the edits. Item 3 was approved 2026-06-05 but only 24h old.

## Impact

- Every agent session loads standing-orders.md and common-sense.md
- Agents see `implement-and-review` referenced as the code-change workflow
  but that workflow doesn't exist in the codebase
- Agents see `bun:sqlite readonly` recommended in the conventions table but
  `query_db` is the actual tool
- The false `[x]` prevents anyone from noticing these are still pending

## Recommendation

1. Uncheck items 1 and 2 in work-queue.md (they are not done)
2. Add an "executed:" date field to distinguish approval from application
3. Dispatch dev to apply the three sets of edits (all are doc-only, low risk)
