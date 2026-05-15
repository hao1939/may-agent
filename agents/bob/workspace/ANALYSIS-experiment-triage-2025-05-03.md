# Experiment Pipeline Triage — 2025-05-03

## Summary
Audited all experiments in `.state/experiments/`. The pipeline is stagnant: several experiments are designed but unrun, while the system churns on zombie dispatches. Here's the triage.

## Active Experiment Status

| ID | Name | Status | Action |
|----|------|--------|--------|
| EXP-800 | Threshold Rescue (VAE concrete rules) | READY TO RUN | **#1 PRIORITY** — resolves biggest open question |
| EXP-650 | Diminishing Returns Gate | DEPLOYED | ✅ Measuring — needs 5 post-deploy completions |
| EXP-560 | Terminal State Recognition | DESIGNED | BLOCKED by EXP-650 results |
| EXP-580 | SOUL Placement VAW | DEPLOYED-PARTIAL | Needs optimizer deployment — LOW PRIORITY |
| EXP-550 | Bob Deliverables Enforcement | DEPLOYED | ✅ Has measurement data |
| EXP-500 | Structural Read-Before-Edit | COMPLETED | ✅ Results written |
| EXP-490 | Bob Skill Compliance Scan | COMPLETED | ✅ Done |

## Kill List (Stale / Superseded)
- EXP-495: Measurement plan only, no experiment body. **KILL.**
- Any experiment numbered <400 not listed above: assumed completed or archived.

## Highest-Value Next Action: Run EXP-800

**Why EXP-800 matters most:**
1. It resolves the core contradiction: Do text-based rules work for compliance, or only structural gates?
2. Prior chain (EXP-302→303→550→715) all point to this as the decisive test
3. If positive: scalable compliance via SOUL.md rules (cheap to deploy everywhere)
4. If negative: we know to invest only in structural enforcement (tool-layer gates)

**Blocker:** Needs `multi-file-refactor` gym scenario + arms C/D variants. Coach or bob must create these.

## Zombie Dispatch Problem (Meta-Issue)

The system's #1 efficiency problem is zombie task re-dispatch:
- 60+ bob sessions in last 6h were interrupted repeats of 3 tasks
- DESIGN-dispatch-dedup-guard-v2.md exists but was never shipped
- This analysis itself risks becoming a zombie — diagnosed 3x, never fixed

**Proposed escalation:** File as P0 for tech-lead. The fix is: add retry counting to the dispatch layer. After 3 interrupted dispatches of the same task description, require explicit "blocker resolved" evidence before re-dispatch.

## Open Hypotheses Worth Testing

| ID | Hypothesis | Quick Test? |
|----|-----------|-------------|
| H-222 | Task scoping quality → eval quality | YES — compare 10 amy vs 10 scout evals |
| H-220 | Zombie tasks = missing blocked state | Already confirmed by evidence |

## Decision
This session: write this triage. Next session: create EXP-800 gym scenario or escalate to coach.
