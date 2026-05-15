# Common Sense Infra Review — 2026-08-01

## Summary

No structural changes to common-sense.md since last review. The C1.3 write-readback nudge remains the highest-priority actionable unbuilt mechanism. Coach has hit a behavioral ceiling and implicitly needs infra support. Prior design brief (2026-04-22) is still valid but unimplemented after 100+ days.

## Infra Item Status

| Item | Priority | Status | Change since 07-31 |
|------|----------|--------|---------------------|
| IT-87 Evaluator pipeline | P0 | Broken | No change. Coach still self-routing around it via convention_checks. |
| C12.1 Convention checker false positives | P0 | Unfixed | No change. |
| C1.3 Write-readback nudge | P1 | **Unbuilt — 100+ days since design brief** | No code in src/ matches nudge/readback/C1.3. Prior brief at `brief-c13-verify-nudge-infra-design-20260422.md` fully specced. |
| IT-50 Finish-guard wiring | P1 | Unknown | `agents/src/lib/finish-guard.ts` does not exist. May have been removed or never landed. |

## Coach Behavioral Items Needing Infra

Coach's `common-sense-status.md` item #22 (C1.3) shows **6+ consecutive ❌ checks**, 15% readback compliance, flagged as "Growth Cycle candidate." Coach's own compliance is only 67%. This is the textbook case for infra complementing coaching — the behavioral ceiling is clearly reached.

No formal coach escalation request found, but the data speaks for itself.

## Ownership Updates

None needed. No items were recently built. The common-sense.md doc itself has no infra ownership annotations to update.

## Design Target: C1.3 Write-Readback Nudge (Implementation Push)

**This is not a new design — it's a call to implement the existing design.**

The April 22 brief (`brief-c13-verify-nudge-infra-design-20260422.md`) provides a complete spec:
- Trigger: 2+ consecutive edit/write without read/grep of modified file
- Action: Advisory nudge in next tool response (NOT blocking)
- Scope: Per-session tracking of unverified files

**What's needed**: tech-lead to implement this in the tool response pipeline. The mechanism is:
1. Track files modified by edit()/write() in session state
2. Track files verified by read()/bash(grep|cat|head) 
3. After 2+ unverified writes, append nudge text to next tool response
4. Clear tracking when file is read back

**Success criteria** (from original brief): C1.3 compliance 15% → 50%+ within 2 weeks.

**Recommendation**: Fork to tech-lead with the original brief as context. This has been designed and waiting for 100 days.
