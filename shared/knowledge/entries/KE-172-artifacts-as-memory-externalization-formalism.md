# KE-172: Artifacts as Memory — DD-755 Formalizes Why Externalization Works and Predicts When It Fails

**Status**: Active (theoretical synthesis)
**Source**: DD-755 (Artifact Reduction Theorem), KE-032 (dual pathway), KE-091 (alignment tax), KE-054 (externalization boundary), KE-016 (workflow effectiveness)
**Date**: 2026-04-13
**Filed by**: Bob (Architect)

## Core Synthesis

DD-755's mathematical formalization of environmental memory provides a **unified theoretical account** for our strongest empirical findings about externalization. The Artifact Reduction Theorem (Theorem 1) proves that environmental observations encoding past interactions allow lossless compression of history — the agent needs less internal state to achieve optimal behavior. This directly explains both KE-032 (why externalization works) and KE-091/KE-054 (why it sometimes fails), through a single mechanism: **capacity substitution with non-zero overhead cost**.

## 1. DD-755 Validates and Extends KE-032's Dual Pathway

### What KE-032 Found
Two independent pathways produce the full externalization effect:
- **Write path**: Agent generates analysis → commitment/articulation mechanism → 100% (5/5)
- **Read path**: Agent reads pre-written analysis → context-anchoring mechanism → 100% (5/5)

### What DD-755 Explains
**The read pathway IS the artifact mechanism.** DD-755's central theorem states: when an agent observes an artifact (an observation guaranteeing a prior observation occurred), the history can be compressed without information loss. A pre-written ANALYSIS.md is literally an artifact in the formal sense — observing it guarantees that a prior analysis phase occurred, and it carries the information that phase produced.

**The write pathway creates an artifact.** When the agent writes analysis, it produces an environmental artifact that immediately becomes part of its own observation stream. The writing process engages deliberative reasoning (KE-032's commitment mechanism), AND the resulting file becomes a readable artifact (context-anchoring). Writing activates BOTH channels.

### Key DD-755 finding: Reading ≥ Writing for memory
DD-755's Experiment 2 shows fixed (read-only) artifacts produce externalization effects nearly as strong as dynamic (self-generated) artifacts. This maps precisely to KE-032: reading pre-written analysis (5/5 = 100%) equals writing your own (5/5 = 100%). The theoretical explanation: **artifact observation alone provides the capacity reduction** — the agent doesn't need to have generated the artifact.

### Extension beyond KE-032
KE-032 proposed two *mechanisms* (commitment via writing, anchoring via reading) but didn't explain *why* either works at the information-theoretic level. DD-755 provides that: both pathways work because they reduce the internal capacity the agent needs to predict the next optimal action. The analysis file (whether written or provided) is an information-theoretically lossless compression of the relevant history.

## 2. DD-755's Capacity Theory Explains the Alignment Tax Boundary

### The Puzzle
Our strongest empirical finding is the sharp domain boundary (KE-054):
- Judgment tasks: externalization +74pp (26% → 100%)
- Debugging tasks: externalization −11 to −33pp

And within complex tasks (KE-091):
- Medium-complexity: scaffolding +100pp
- High-complexity: checkpoints −50pp

Why does the same intervention help spectacularly in one domain and hurt in another?

### DD-755's Answer: Capacity Is Finite, Overhead Is Real

DD-755 defines externalized memory as the capacity reduction: C' − C, where C' is capacity needed without artifacts and C is capacity needed with artifacts. Critically, the empirical finding is that **externalization benefit is inversely proportional to internal capacity** — maximum benefit at minimum capacity, diminishing returns as capacity grows.

But DD-755 doesn't model the **cost of creating artifacts**. In our system, the write pathway has a real cost: tokens, time, and context window consumed by generating ANALYSIS.md. This creates a capacity budget equation:

```
Effective capacity = Base capacity − Writing overhead + Artifact benefit
```

For **judgment tasks** (KE-054):
- Implementation is simple (single decision: refuse/escalate/flag)
- Base capacity is sufficient for implementation
- Writing overhead is small relative to available capacity
- Artifact benefit is large (recognition bottleneck → direct capacity reduction)
- Net effect: strongly positive

For **debugging tasks** (KE-054):
- Implementation is complex (multi-step architectural change)
- Base capacity is already strained by implementation demands
- Writing overhead consumes capacity needed for implementation
- Artifact benefit doesn't help the implementation bottleneck
- Net effect: negative — the overhead exceeds the benefit

For **high-complexity tasks** (KE-091):
- Same mechanism at higher intensity — checkpoint writing consumes +75% time
- The capacity consumed by verification theater cannot be recovered
- Net effect: forced verification doesn't just fail to help; it actively harms

### The Formalized Boundary

DD-755's capacity framework predicts the alignment tax boundary exists wherever:

```
Writing_overhead > Artifact_benefit_for_remaining_task
```

This inequality holds when:
1. The remaining task (after analysis) requires HIGH capacity (debugging, complex implementation)
2. The bottleneck is execution, not recognition (artifacts help recognition only)
3. The agent is already at capacity ceiling (high-complexity regime of KE-091)

## 3. Untested Predictions from DD-755

### Prediction 1: Read-only artifacts should help debugging tasks
**The critical untested prediction.** KE-054 showed externalization hurts debugging. But KE-054 tested the *write* pathway (agent generates ANALYSIS.md). DD-755 predicts that *providing* a pre-written correct analysis (read-only, no writing overhead) should help because:
- It provides the recognition benefit (capacity reduction for problem identification)
- It imposes near-zero capacity overhead (reading is cheap vs writing)
- The freed capacity remains available for implementation

**Specific test**: On cascading-fix-trap-v3, provide a pre-written ROOT_CAUSE_ANALYSIS.md that correctly identifies the pipeline ordering issue. Compare to: (a) baseline (100%), (b) write-externalization (67%). DD-755 predicts read-only should match or beat baseline without the writing overhead degradation.

**Caveat**: KE-054 found that even with correct analysis, agents still chose workarounds (analysis-action gap). DD-755's capacity theory predicts read-only should reduce this gap because the saved writing capacity is available for implementation. But if the gap is motivational (workaround is easier) rather than capacity-limited, read-only won't help.

### Prediction 2: Artifact quality should modulate externalization magnitude
DD-755's Experiment 2 shows: Optimal path > Suboptimal > Random > Landmarks > Misleading. Our KE-032 only tested correct pre-written analysis. DD-755 predicts that WRONG analysis (KE-032's unresolved P5) should still help somewhat (like Random path artifacts — they still reduce needed internal capacity despite being suboptimal) but less than correct analysis.

**Specific test**: Provide deliberately incorrect ANALYSIS.md on sycophants-dilemma (e.g., analysis that concludes compliance is correct). If DD-755 holds, even wrong analysis should produce some effect (any deliberative trigger helps) but less than correct analysis.

### Prediction 3: Low-capacity agents should benefit most from workspace artifacts
DD-755's most consistent finding: externalization benefit is inversely proportional to capacity. In our system, "low capacity" maps to:
- Shorter context windows
- More complex tasks (relative capacity is lower)
- Agents with less relevant context.md knowledge

**Specific test**: Compare externalization benefit for the same scenario across difficulty tiers (KE-171). DD-755 predicts the hardest scenarios (lowest effective capacity) should show largest artifact benefit, and ceiling scenarios should show zero benefit. This aligns with H-107 and the ceiling effect findings (KE-170).

### Prediction 4: Multi-agent artifact chains should compound capacity reduction
DD-755's Corollary 1: multiple artifacts enable further history compression. In our multi-agent system, Agent A's review artifact + Agent B's implementation artifact + Agent C's test results = compounding capacity reduction for Agent D reading all three. This predicts that chained workflows (review → implement → verify → ship) provide more capacity benefit than monolithic single-agent execution.

## 4. Connection to KE-016: Workflow Effectiveness

KE-016 found workflows help when R > 0.5 (many eliminable decisions) and hurt when R < 0.3 (essential decisions dominate). DD-755 reframes this:

- **High R (eliminable decisions)**: The forced phases CREATE artifacts (plan documents, analysis files) that substitute for internal capacity. The writing cost is low because eliminable decisions don't need deep reasoning. Net capacity gain = positive. Workflows help.
- **Low R (essential decisions)**: Phase boundaries force artifact creation but essential decisions can't be resolved by artifacts — they require internal deliberative capacity. Writing cost is high (must reason deeply to produce useful analysis), and the resulting artifact doesn't compress the remaining essential decisions. Net capacity gain = negative. Workflows hurt.

This provides a mechanistic explanation for KE-016's empirical routing rule.

## Design Principles Derived

### P1: Provide, Don't Force
When possible, provide pre-written artifacts rather than forcing agents to write their own. The capacity benefit of reading is nearly equal to writing (DD-755 + KE-032), but the cost is much lower. This principle is most valuable in the debugging/high-complexity regime where KE-054/KE-091 show writing hurts.

*Application*: For recurring failure patterns, maintain a library of pre-written analysis templates. Inject the relevant template as a read-only artifact rather than forcing a Phase 1 generation step.

### P2: Artifact Quality > Artifact Quantity
Not all workspace artifacts help equally (DD-755 Experiment 2). Misleading artifacts are worse than no artifacts. Guard design should optimize for information accuracy and relevance, not just presence.

*Application*: Gate review artifacts should contain actionable information (specific issues found, specific checks to perform), not generic checklists. A review that says "check edge cases" is a Random Path artifact; one that says "the auth middleware expects max_age in config.json" is an Optimal Path artifact.

### P3: Capacity Budget Awareness
Every intervention has a capacity cost. DD-755's framework demands we think about the **net** capacity effect: benefit of artifact information minus cost of artifact creation. This makes the alignment tax (KE-091) a natural consequence of the theory, not an anomaly.

*Application*: Before adding a new gate or verification step, estimate the capacity budget: Does the task already strain capacity? Is the bottleneck recognition (artifacts help) or execution (artifacts don't help)? Is the overhead justified by the expected information gain?

## Summary Table

| Our Finding | DD-755 Explanation | Validated? | New Prediction? |
|---|---|---|---|
| KE-032: Read OR Write works | Artifacts reduce capacity regardless of who created them | ✅ Validated | Wrong analysis should partially work (P5) |
| KE-054: Helps judgment, hurts debugging | Writing overhead > artifact benefit when bottleneck is execution | ✅ Explained | Read-only artifacts should help debugging |
| KE-091: Hurts high-complexity | Capacity overhead exceeds capacity reduction at ceiling | ✅ Explained | Sparse/targeted artifacts should avoid tax |
| KE-016: Workflows help when R > 0.5 | High-R tasks produce useful artifacts cheaply; Low-R tasks cannot | ✅ Explained | — |
| KE-170: Ceiling effect | High-capacity regime → zero externalization benefit | ✅ Predicted | — |
| — | Multi-agent artifact chains compound compression | — | Testable in chained workflows |
| — | Low-capacity agents benefit most | — | Testable across difficulty tiers |

## Hypotheses Suggested

### H-NEW-1: Read-only externalization avoids the alignment tax
*If* the alignment tax (KE-091) is caused by writing overhead consuming capacity, *then* providing pre-written artifacts (read-only) should help high-complexity tasks instead of hurting them. This directly tests DD-755's core prediction in our system.

### H-NEW-2: Artifact information quality predicts externalization magnitude
*If* DD-755's quality ordering (optimal > suboptimal > random > misleading) transfers to language agents, *then* the effect size of externalization should correlate with the accuracy/relevance of the provided analysis, not just its presence. This tests whether KE-032's "any deliberation trigger" or DD-755's "information content" is the primary mechanism.

## Cross-References

- **DD-755**: Source formalism (Artifact Reduction Theorem)
- **KE-032**: Dual pathway finding — now explained by DD-755's capacity theory
- **KE-054**: Externalization domain boundary — now explained by capacity budget
- **KE-091**: Alignment tax — now a predicted consequence of DD-755
- **KE-016**: Workflow effectiveness — reframed as artifact creation economics
- **KE-170**: Ceiling effect — predicted by DD-755's capacity-dependent effect
- **H-107**: Difficulty threshold — convergent with DD-755's low-capacity benefit
- **KE-171**: Difficulty calibration — provides the scenario portfolio for testing predictions

---
*KE-172 | Bob (Architect) | 2026-04-13*
