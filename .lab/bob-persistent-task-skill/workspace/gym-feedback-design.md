# Gym-as-Fast-Feedback for Bob (Architect)

**Date:** 2026-04-16  
**Status:** Draft  
**Context:** Bob's metrics (experiment-completion, hypotheses-resolved, designs-implemented) are all slow-feedback. Gym gives signal in minutes. How to bridge the gap?

---

## 1. Using Gym for Fast Signal on Bob's Metrics

Bob's three metrics measure *production output* — experiments run, hypotheses concluded, designs shipped. Gym can't directly measure these (they're cumulative over days). But gym CAN test the **component skills** that bottleneck them:

| Metric | Bottleneck Skill | Gym Proxy |
|--------|-----------------|-----------|
| `bob.experiment-completion` | Verification rigor, read-before-edit | `compound-edit-verification`, `convention-verify-edit` |
| `bob.hypotheses-resolved` | Context navigation, knowledge synthesis | `knowledge-base-navigation`, `ambiguous-context-drift` |
| `bob.designs-implemented` | Judgment under ambiguity, cascade reasoning | `cascade-judgment`, `approach-validation-trap` |

**Principle:** Don't try to make gym simulate "write a hypothesis." Instead, test the skills that make hypothesis-writing fail (sloppy verification, missed context, template displacement).

## 2. Relevant Gym Scenarios for Architect Role

High-relevance (test skills Bob actually uses):
- **knowledge-base-navigation** / **knowledge-base-navigation-discovery** — finding and connecting information across nested knowledge dirs
- **ambiguous-context-drift** (all variants) — maintaining coherence when context is noisy/contradictory
- **cascade-judgment** — reasoning about second-order effects (core architect skill)
- **approach-validation-trap** — avoiding sunk-cost on bad approaches
- **compound-edit-verification** — Bob's #1 failure mode (FM-3.3)

Low-relevance: scenarios testing code execution, test-fixing, build debugging — these are tech-lead skills.

## 3. How Gym Results Should Feed Into Metrics

Gym results should NOT directly update `bob.hypotheses-resolved` etc. Instead:

1. **Gym tracks component skill health** — if `compound-edit-verification` pass rate drops, that's a leading indicator that `experiment-completion` quality will degrade
2. **Gym validates interventions** — before deploying a new skill/context change to production, run 10 gym trials to check for regression
3. **Gym discrimination rate** (`gym.scenario-discrimination`) tells us if our scenarios are even useful signals

**Anti-pattern to avoid:** Optimizing gym pass rates as a proxy for production quality. KE-053/KE-109 showed the gym-production gap is structural. A 100% gym pass rate doesn't mean good production work.

## 4. 295 Scenarios at 36% Pass Rate — What To Do

The 36% aggregate is misleading. What matters:

1. **Triage by discrimination** — scenarios where pass rate is 0% or 100% teach nothing. Focus on the 20-80% band where improvements are detectable.
2. **Tag by owner** — many scenarios test tech-lead or optimizer skills. Bob should only track ~20-30 relevant scenarios, not all 295.
3. **Retire stale scenarios** — scenarios created for one-off experiments (e.g., `-fewshot`, `-taskmd` variants) clutter the set. Archive variants that served their purpose.
4. **Don't chase the aggregate** — raising 36% to 50% is not a goal. The goal is high pass rates on scenarios that predict production quality (and we don't fully know which those are yet).

## 5. Fast Feedback Loop for Architect Role

```
Production work (write hypothesis/experiment/design)
        │
        ▼
    Identify failure pattern (FM-3.3, FM-1.3, etc.)
        │
        ▼
    Write/update intervention (skill, context line, workflow)
        │
        ▼
    Run 10 gym trials on relevant scenario (~20 min)
        │
        ▼
    If pass rate improves → deploy to production
    If not → iterate on intervention or discard
        │
        ▼
    Monitor production metrics over next 2-3 days
```

**Key insight:** For an architect, the fast feedback loop isn't "run gym constantly." It's "use gym as a validation gate before deploying changes." Bob's core work (synthesis, hypothesis generation) is creative and can't be gym-tested directly. But the *execution quality* of that work (verification, navigation, judgment) can be.

**Cadence:** Run targeted gym batches when deploying skill changes. Don't run gym on a schedule — it's a tool, not a ritual.
