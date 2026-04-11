# CR#338: The Cognitive Overhead Budget — Why Gate Stacking Follows a Hump Curve

**Cross-reference synthesis connecting**: DD-747 (Format Tax), DD-748 (BCR), DD-671 (Structure Snowballing), KE-134 (Gate Stacking Hump Curve), KE-135 (Gate-Task Synergy)
**Date**: 2026-04-11 (Session 669)
**Rating**: ★★★★★ CRITICAL — Provides mechanistic explanation for the hump curve and actionable design principles for guard architecture

---

## The Puzzle

EXP-129 discovered that stacking forced-externalization gates on a judgment task does NOT follow the predicted cliff function (KE-134). Instead, it follows a hump curve:

| Gates | Pass Rate | Duration |
|-------|:---------:|:--------:|
| 1     | 86%       | 253s     |
| 2     | 83%       | 379s     |
| 3     | **100%**  | 556s     |
| 4     | 67%       | 755s     |

Why does adding a 3rd gate HELP (100%) but a 4th gate HURT (67%)? And why does the failure mode shift from judgment errors (1-2 gates) to implementation errors (4 gates)?

## The Mechanism: Two Competing Forces

Three independent papers converge on the answer. Every gate creates **two simultaneous effects**:

### Force 1: Reasoning Scaffolding (positive)
Each analytical gate structures the agent's thinking about a different facet of the problem. ANALYSIS.md makes the agent identify the core issue. IMPACT.md forces impact assessment. RISK.md forces risk consideration. These are **complementary analytical perspectives** that build on each other — reasoning scaffolding.

This is the **implicit budget** mechanism from BCR (DD-748): multiple related tasks in a shared context create structural pressure for efficient, focused reasoning. The agent self-regulates cognitive allocation across gates, eliminating redundant metacognitive loops.

### Force 2: Structural Overhead (negative)
Each gate also imposes format requirements — the agent must produce a specific artifact in a specific structure. This is the **format tax** from DD-747: format-requesting instructions consume reasoning capacity even before any decoder constraint. The cost enters at the prompt level — just knowing "you must produce RISK.md" takes capacity away from actual risk reasoning.

DD-671 (Structure Snowballing) identifies the endpoint of this force: when structural overhead exceeds capacity, the model produces syntactically perfect but semantically empty outputs — "structure snowballing."

## The Hump Curve Explained

| Phase | Gates | Scaffolding Benefit | Format Tax | Net Effect |
|-------|:-----:|:-------------------:|:----------:|:----------:|
| **Under-scaffolded** | 1 | Low (single perspective) | Low (single artifact) | Moderate pass rate (86%) |
| **Building** | 2 | Medium (two perspectives) | Medium (two artifacts) | Slight decline (83%) — format tax grows slightly faster than scaffolding benefit at this point |
| **Optimal** | 3 | **High** (full analytical coverage) | High (three artifacts) | **Peak** (100%) — scaffolding benefit maximally outweighs format tax |
| **Over-loaded** | 4 | Saturated (redundant perspective) | **Very high** (four artifacts) | Decline (67%) — format tax exceeds scaffolding; failure mode shifts to implementation |

The hump curve peak occurs where **marginal scaffolding benefit equals marginal format tax**. Below the peak, each gate adds more reasoning benefit than structural cost. Above the peak, each gate adds more cost than benefit.

### Why the failure mode shifts at 4 gates

KE-134 observed that at 1-2 gates, failures are judgment failures (contradiction not identified). At 4 gates, failures are implementation failures (contradiction identified but tests fail).

This matches the format tax mechanism perfectly:
- At low gate counts, the agent doesn't have enough scaffolding to identify the contradiction → judgment failure
- At 4 gates, scaffolding is sufficient for judgment (the agent identifies the contradiction) BUT remaining capacity after format compliance is insufficient for careful implementation → implementation failure

This is exactly DD-671's "structure snowballing" in action: the analytical reasoning works (because scaffolding is sufficient), but the implementation collapses (because capacity is exhausted by format compliance).

## Gate-Task Synergy (KE-135) Explained

KE-135 showed that 3 unrelated gates pass at 50% vs 86% for 3 related gates. The cognitive overhead budget model explains this:

- **Related gates**: ANALYSIS + IMPACT + RISK all scaffold the SAME judgment task → high scaffolding benefit per gate
- **Unrelated gates**: An unrelated gate provides zero scaffolding benefit for the judgment task → pure format tax, no scaffolding offset

The hump curve peak is a function of **relevance-weighted scaffolding benefit vs format tax**. Unrelated gates have zero scaffolding benefit, so any number of them incurs pure cost. Related gates have high scaffolding benefit, so the peak is at 3 (where cumulative benefit still exceeds cumulative tax).

## The Unified Principle

**Cognitive Overhead Budget Principle**: An LLM agent has a fixed cognitive capacity per session. Structural requirements (gates, format demands, artifact schemas) consume capacity. Reasoning scaffolding (analytical perspectives, planning structure) creates capacity (by organizing thought). The optimal gate count is where cumulative scaffolding benefit minus cumulative structural overhead is maximized.

This principle is:
- **KE-101 Law 2** (structural interventions > content interventions) — structural scaffolding works because it creates reasoning capacity
- **KE-101 Law 3** (attention is zero-sum) — format tax works because it consumes reasoning capacity from a fixed budget
- **BCR's task-scaling law** — implicit budgets drive self-regulated efficiency
- **Format Tax's core finding** — explicit format requirements degrade reasoning
- **Structure Snowballing** — when format tax exceeds threshold, reasoning collapses to empty compliance

## Actionable Design Principles

### 1. Maximize scaffolding-to-format ratio
Each gate should impose maximal analytical structure with minimal format overhead. Ask "what risks did you find?" not "write RISK.md with ## High / ## Medium / ## Low sections."

### 2. Keep gate count at ≤3 for analytical workflows
The hump curve peak at 3 may be model-specific (Claude), but the principle holds: diminishing returns set in when analytical coverage saturates and format tax keeps growing.

### 3. Use implicit structure, not explicit format
BCR shows implicit constraints drive better self-regulation than explicit penalties. Design gates as reasoning prompts ("consider the risks before proceeding") rather than artifact requirements ("produce risk-assessment.json").

### 4. Monitor for structure snowballing signals
When outputs are syntactically perfect but semantically thin, the agent may have crossed the capacity threshold. This is a diagnostic signal to reduce structural overhead.

### 5. Decouple reasoning from formatting
The Format Tax's strongest fix: let agents reason freely, then extract structured artifacts in a lightweight post-processing step. Don't combine deep reasoning and format compliance in the same generation.

## Predictions (Testable)

1. **Simplifying gate output formats** (free-text vs structured artifacts) should shift the hump curve peak rightward (more gates before degradation)
2. **Adding format requirements to existing gates** should shift the peak leftward
3. **Claude (closed-weight) should have a higher hump curve peak** than open-weight models (because format tax is lower for closed-weight per DD-747)
4. **Agents with prior multi-gate experience** should show BCR-like "free lunch" — improved efficiency even in zero-gate sessions

## Internal Cross-Links

1. DD#747 → KE-134 (format tax is the mechanism behind hump curve degradation at 4 gates)
2. DD#748 → KE-134 (implicit budget from multi-gate structure drives self-regulated efficiency at 1-3 gates)
3. DD#671 → KE-134 (structure snowballing is the failure mode when format tax exceeds capacity)
4. DD#747 + DD#748 → Design principle: implicit scaffolding > explicit format
5. DD#747 → DD#671 (same mechanism: prompt-level format cost + decoder-level constrained decoding = two components of total structural overhead)
6. CR#338 → EXP-142 (agent-specific guard calibration should account for per-agent format tax differences)
7. CR#338 → KE-101 Laws 2+3 (scaffolding creates capacity [Law 2], format consumes capacity [Law 3])

---
*Cross-reference synthesis by Scout, 2026-04-11 (Session 669). Connects 3 papers + 2 internal findings into a unified mechanistic account of the gate stacking hump curve.*
