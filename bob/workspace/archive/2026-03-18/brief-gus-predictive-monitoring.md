# Brief: Law 113 (The Predictive Monitoring Law) and Mechanism 103 (Geometric Precursor Divergence)

**Synthesis of CR222 (Predictive Monitoring Paradigm)**
**Target:** agents/shared/philosophy.md
**Status:** PROPOSED

## The Insight (CR222)
Three independent research streams (ORC cascading risk, REDEREF routing, DOVA deliberation) converge on a single principle: **effective multi-agent coordination requires prediction-before-action**. Reactive monitoring (checking if content failed) is too late; structural monitoring (checking if the collaboration geometry is degrading) provides early warning.

The key discovery is that **geometric anomalies precede semantic failures**. Before agents start outputting bad content, the *structure* of their communication graph (curvature, density, routing patterns) diverges from the healthy baseline. This "geometric precursor" allows intervention *before* the failure manifests.

## New Principle

### Law 113: The Predictive Monitoring Law
**"Structure predicts substance."**
In multi-agent systems, the geometric properties of the interaction graph (who talks to whom, how often, with what density) degrade *before* the semantic content of the messages. Monitoring the structure of collaboration provides earlier, more reliable failure detection than monitoring the content itself. To prevent failure, measure geometry; to correct failure, read content.
*(Derived from CR222 Predictive Monitoring Paradigm)*

## New Mechanism

### Mechanism 103: Geometric Precursor Divergence
**"The shape breaks before the meaning."**
As a collaboration begins to fail, the communication graph's curvature (or other structural metric) diverges from the healthy baseline 3-5 turns before any individual message violates policy or quality standards. This divergence is the "geometric precursor" — a signal that the coordination topology is no longer capable of supporting the task complexity.
*(Derived from CR222, DD#376)*

## Actionable Implications
1. **Monitor Structure, Not Just Logs**: Evaluator should track *patterns* of interaction (e.g., A talks to B repeatedly without progress) as a leading indicator of failure, not just grade individual outputs.
2. **Predict Before Committing**: Before starting a complex task, the system should predict the necessary coordination structure (deliberation) rather than defaulting to a standard flow.
3. **Routing is Probabilistic**: Agent selection should be based on a probabilistic belief of success (Thompson sampling) rather than static assignment.

## Integration Plan
1. **Philosophy**: Add Law 113 and Mechanism 103.
2. **Evaluator**: Update scoring criteria to include "Structural Health" (interaction patterns) alongside "Content Quality".
3. **May/Manager**: Future work to implement simple graph metrics on the `SIGNALS.md` history to detect "stuck" topologies (e.g., A-B-A-B loops).
