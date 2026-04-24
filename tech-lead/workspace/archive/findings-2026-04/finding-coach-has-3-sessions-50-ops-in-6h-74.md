# Finding: Coach High-Op Sessions — No Infra Overlap

**Date**: 2026-04-18
**Lens**: A (System Architecture)
**Severity**: None — false alarm

## Summary

Coach's 3 high-op sessions (74, 65, 51 ops) in the last 6h are all focused on the `use-persistent-task` gym scenario's 0% pass rate. This is squarely within coach's mandate (behavioral training, gym experiments) and does NOT overlap with tech-lead's infrastructure responsibilities.

## Evidence

### The 3 Sessions

1. **s_1776551125350_659** (74 ops, running): "Analyze persistent-task structural intervention failure and design stronger intervention" — designing a stronger behavioral intervention after context.md CRITICAL instruction only achieved 12.5% (`sessions.task` excerpt: "struct-persistent-task lab fork (context.md CRITICAL instruction): 1/8 = 12.5%")

2. **s_1776540115465_532** (65 ops, done): "Investigate use-persistent-task gym scenario failures — infrastructure or criteria issue?" — despite the word "infrastructure", this investigates whether `workflow.run` works inside the gym harness and whether `success_criteria.js` is too strict (`sessions.task` excerpt: "(a) workflow tool doesn't work in gym, (b) agents get distracted...")

3. **s_1776533063825_448** (51 ops, interrupted): "Design structural intervention for use-persistent-task scenario (0% pass rate)" — creating a gym scenario variant and running baseline+treatment runs (`sessions.task` excerpt: "DELIVERABLE: A new gym scenario variant")

### Coach's Mandate

Coach's role is explicitly "prove which skills actually improve agent behavior" (`agents/coach/heartbeat.md:1-2`). The heartbeat lists gym scenarios, growth cycles, and training sprints as primary work types (`agents/coach/heartbeat.md:108-117`). All 3 sessions fit this mandate.

### Why High Ops?

The sessions are high-op because they involve iterative gym runs and analysis of persistent 0% pass rates — a legitimately complex problem requiring multiple experiment cycles. Coach's context.md acknowledges this pattern with the "WORK SESSION SCAFFOLD" that includes checkpoints at op 30/45/60 (`agents/coach/context.md:17`).

## Conclusion

No role overlap detected. Coach is doing coach work — the "infrastructure" mention in session 2 refers to gym harness mechanics, not system infrastructure. No action needed.
