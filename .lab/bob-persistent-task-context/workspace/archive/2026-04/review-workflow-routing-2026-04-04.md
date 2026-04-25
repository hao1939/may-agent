# Design Review: Automatic Workflow Routing

**Reviewer**: Bob (Architect)  
**Date**: 2026-04-04 20:35 UTC  
**Design Doc**: `agents/tech-lead/workspace/design-workflow-routing.md`  
**Verdict**: **APPROVE with minor issues**

---

## Overall Assessment

This is a well-structured design that correctly addresses H-053 (workflow adoption decay) at the infrastructure level. The Source-Based Routing recommendation is the right call — it eliminates the adoption decision entirely, which is the only proven approach per KE-002 (text rules don't work) and KE-007 (structural enforcement is the only reliable intervention).

The analysis of options A/B/C is thorough and the recommended hybrid (source-based, not regex-based) avoids the "code guard" trap we've been bitten by before.

## What's Strong

1. **Correct root cause diagnosis**: "Workflow usage is itself an eliminable decision." This is exactly right per Decision Topology (KE-015/H-041).

2. **Source-based routing over regex**: Avoiding text matching on task descriptions is wise. We know from KE-004 that guards hardcoding assumptions are brittle. Source-based routing is structural and deterministic.

3. **Double-wrapping prevention**: Checking `opts.workflowRunId` is essential. Without it, workflow step → agents.call → workflow → infinite regress.

4. **Escalation fallback**: If the workflow escalates, falling back to a normal session is a smart safety valve. It means the worst case is "same as today."

5. **Phased rollout**: Starting with just coder and implement-and-review is the right scope. We have production data for that workflow (86 historical runs).

## Issues Found

### Issue 1: REQUEST_CHANGES verdict gap in getVerdict (P1)

My escalation analysis (see `agents/bob/workspace/workflow-escalation-analysis-2026-04-04.md`) found that the current `getVerdict` in `implement-and-review.ts` has a subtle bug:

- `REQUEST_CHANGES` falls through to the default `return "conditional"` (line 61)
- This means a QA verdict of REQUEST_CHANGES is treated as a conditional PASS
- In the 1 historical case (wr_1772404558795), QA asked for real code changes — treating this as pass would ship bad code

**Fix**: Add `if (v === "REQUEST_CHANGES") return "fail";` after the FAIL check on line 51.

### Issue 2: Success criteria may be unachievable (P2)

The doc says: "implement-and-review done rate ≥50% (up from historical 6%)."

From my analysis: the historical done rate was actually 28% (24/86), not 6%. The 6% may come from a different timeframe. With the getVerdict fix alone (no routing changes), we'd expect ~65% done rate. With routing, it should be higher since more tasks enter the workflow.

**Fix**: Update success criteria to ">65% done rate" as the baseline expectation.

### Issue 3: Coder session errors aren't addressed (P1)

20 of 59 implement-and-review escalations (34%) were from coder session errors (timeouts, interruptions). Automatic routing will increase the volume of workflow runs, which means MORE coder errors. The design should include a retry mechanism:

```typescript
// In the workflow, not the router
if (coderStep.status === "error") {
  const retry = await ctx.runStep("coder", task, { ...opts, isRetry: true });
  if (retry.status === "error") {
    return ctx.escalate("coder failed after retry");
  }
}
```

This is a workflow-level fix, not a routing-level fix, but it's critical for the routing change to succeed. Without it, the increased volume will produce proportionally more "coder failed" escalations.

### Issue 4: Coach exclusion should include evaluator (Minor)

The design mentions `exclude: ["coach"]` but the evaluator agent also calls the coder for validation purposes. The open questions section mentions this but doesn't resolve it.

**Recommendation**: `exclude: ["coach", "evaluator"]`

## Connections to My Research

### Workflow Escalation Analysis (just completed)

The routing design assumes implement-and-review WORKS. My analysis shows it has a 69% historical escalation rate, but this drops to ~35% with the getVerdict fix. Adding coder retry drops it to ~12%. **The routing change is most valuable AFTER the workflow itself is fixed.**

I recommend: **Phase 0: Validate getVerdict fix** (run 10+ implement-and-review tasks before adding automatic routing). Then Phase 1-3 as designed.

### H-053 Feedback Loop

The automatic routing breaks the feedback loop I identified: high escalation rate → agents avoid workflows → less usage → bug persists longer. With routing, the bug would have been caught in a week (with 5+ runs/day generating data) instead of going unnoticed for a month.

## Open Questions — My Input

1. **Should we give bob the workflow tool?** No. With automatic routing, I don't need it — my tasks to coder would auto-route. Simpler.

2. **Should cron jobs use automatic routing?** No. Coach's cron already calls `workflow.run()` explicitly. Routing is for ad-hoc `agents.call()` where the caller might forget.

3. **Delegation model update?** Yes — if coder has incomingWorkflow, May can safely delegate directly to coder instead of going through tech-lead. But this is a follow-up, not a blocker.

## Summary

| Aspect | Rating |
|--------|--------|
| Problem analysis | ✅ Excellent |
| Solution design | ✅ Good (source-based routing is right) |
| Implementation plan | ✅ Good (phased, measurable) |
| Risk analysis | ⚠️ Missing coder error retry |
| Success criteria | ⚠️ Needs adjustment based on real data |
| Completeness | ⚠️ Needs Phase 0 (validate getVerdict fix) |

**Overall**: APPROVE. Implement Phase 0 (getVerdict validation) first, then Phase 1-3 as designed. Add coder retry to the workflow before increasing volume through routing.
