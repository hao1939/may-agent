# H-183: Evidence Grading — Confidence Metadata on Knowledge Entries

**Status:** PROPOSED
**Created:** 2026-04-22
**Parent:** H-182 (pivoted from binary verification gates)
**Evidence:** H-182 baseline audit (agents/bob/workspace/h182-lesson-audit.md)

## Hypothesis

Adding evidence-grade metadata to knowledge entries (sample size, replication count, theoretical-only flag) will reduce agent overclaiming and misapplication of weak findings by 30-50%, compared to the current ungraded system.

## Mechanism

The H-182 audit found:
- Only 8.3% of entries are outright misleading/stale (below the threshold for binary gates)
- But **42% are partially correct** — they overclaim from small samples, present analogies as equivalences, or apply dynamics from dissimilar contexts
- **Pattern**: empirical entries are 86% correct vs theoretical entries at 40%

The problem isn't that lessons are wrong — it's that agents can't distinguish strong evidence from weak evidence. A grading system provides calibration without the impracticality of auto-generating verification tests.

## Proposed Grades

| Grade | Criteria | Example |
|-------|----------|---------|
| **A** | Replicated (n≥3 runs), consistent effect, clear mechanism | KE-009 (negative examples, 8 experiments) |
| **B** | Single well-designed experiment, clear result | KE-001 (context learning, A/B test) |
| **C** | Small sample (n<5) or single scenario | KE-003 (delegation context, n=5) |
| **T** | Theoretical synthesis, no direct measurement | KE-033 (scale-invariance from analogy) |

## What Would Confirm

1. Agents consuming graded entries make fewer overclaiming errors in their own reasoning
2. Grade-T entries get cited with appropriate hedging ("theoretical", "speculative")
3. No increase in useful-lesson loss (agents don't ignore C/T entries entirely)

## What Would Refute

- Agents ignore the grades entirely (same consumption pattern before/after)
- Grades cause agents to under-use valid theoretical insights

## Experiment Path

1. Grade 20-30 existing KE entries (can use audit as starting point)
2. Add grade field to KE template
3. A/B test: agents with graded vs ungraded knowledge bases on scenarios requiring knowledge application
4. Measure: citation accuracy, overclaiming rate, knowledge application rate

**Blocker**: A/B testing requires gym infra (same as EXP-190/192). But steps 1-2 (grading existing entries) can proceed immediately.

## Cost

Low — grading is a metadata addition, no new infrastructure required for the grading itself.
