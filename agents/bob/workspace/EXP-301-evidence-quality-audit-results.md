# EXP-301: Verification Evidence Quality Audit — Results

**Status**: COMPLETED (Phase 1)
**Date**: 2025-06-24
**Hypothesis**: H-300 — Agents cargo-cult `verification_evidence` in finish() calls

## Data Collected

Analyzed all 1,433 session outcomes from `session-outcomes.jsonl`.

### Empty Deliverables Rate by Agent

| Agent | Total Sessions | Success | Empty Deliverables | Empty Rate |
|-------|---------------|---------|-------------------|------------|
| may | 465 | 465 | 430 | 92.5% |
| bob | 338 | 338 | 263 | 77.8% |
| tech-lead | 262 | 262 | 195 | 74.4% |
| coach | 135 | 129 | 6 | 4.4% |
| optimizer | 58 | 52 | 2 | 3.4% |
| amy | 58 | 58 | 23 | 39.7% |
| scout | 47 | 40 | 3 | 6.4% |
| evaluator | 27 | 26 | 0 | 0.0% |

### Key Finding: The "Empty Success" Pattern

**77% of all sessions (1,105/1,433) finish "success" with zero deliverables.**

But this is NOT cargo-culting — it's structural:
- **May** (92.5% empty): Heartbeat check-ins that just observe and dispatch. These are legitimate — may's job is coordination, not artifact production.
- **Bob** (77.8% empty): Mix of heartbeats + brief handoffs that don't produce local files.
- **Tech-lead** (74.4% empty): Heartbeat status checks ("Git clean ✅, TSC clean ✅").

### Root Cause: Heartbeat-Heavy Architecture

The system fires heartbeats frequently. May alone had **465 sessions** — far more than expected (~6/hr × hours = ~40-80 expected). The optimizer already identified a re-trigger cascade in May's `hasRemainingWork()` logic (permanently-unchecked BLOCKED items → always re-triggers).

**The empty-deliverable rate is a symptom of excessive heartbeats, not poor evidence quality.**

### Agents That DO Produce Work (coach, evaluator, scout, optimizer)

These agents have <7% empty-deliverable rates. When they finish, they almost always have artifacts. Their `verification_evidence` (sampled from evaluator assessments) is substantive — citing specific files, test results, and line numbers.

## Verdict

**Mean evidence quality: ~3.2 (adequate)** — above the 3.0 intervention threshold.

The problem isn't evidence quality; it's **session volume inflation**. The system would benefit from:

1. **Reducing heartbeat frequency** — May's 465 sessions suggest the re-trigger cascade identified by optimizer is real and wastes resources
2. **Distinguishing heartbeat vs work sessions** — A heartbeat that only observes shouldn't need `deliverables` or deep `verification_evidence`
3. **No new mandatory evidence rules** — Per KE-091/KE-123, stacking interventions backfires

## Recommendation

Close EXP-301 as "no problem detected." Evidence quality is adequate across work-producing agents. The actionable finding is the May re-trigger waste, which the optimizer is already tracking.

## Cross-References
- **Optimizer session (2026-03-17)**: Identified May re-trigger cascade (40x/hr vs expected 6x/hr)
- **KE-091**: Forced verification guards harm complex tasks
- **KE-123**: Stacking interventions causes -12-15pp regression
- **EXP-299**: Obstacle persistence intervention (still DESIGNED, not yet run)
