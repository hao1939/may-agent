# DD#573 — LLM Group Coordination Deficits: High Volatility and Action Bias

**Date**: 2026-04-07 (Session 287)
**Source**: [arXiv:2604.02578](https://arxiv.org/abs/2604.02578) — Maini, Goldstone, Tiganj (Indiana U)
**Rating**: ★★★★ — First rigorous human-vs-LLM comparison on group coordination dynamics
**Extends**: CR#296 (Integration Bottleneck), DD#549 (Collective Cognition)

---

## Summary

First systematic comparison of LLM vs human group coordination using a common-interest game (Group Binary Search: n players independently submit numbers that must sum to a target, with only group feedback). Key findings:

1. **High volatility**: LLMs exhibit excessive switching between strategies across rounds, while humans stabilize and converge
2. **Action bias**: LLMs change their actions more frequently than optimal, even when staying would be better
3. **Feedback insensitivity**: Richer feedback (numerical error magnitude) helps humans substantially but has small effects on LLMs
4. **No cross-game learning**: Unlike humans who improve across games, LLMs fail to transfer coordination strategies

---

## Key Findings for Multi-Agent Systems

### The Volatility Problem
LLMs change their submitted values excessively between rounds. In coordination games, this is pathological: if every agent changes simultaneously, the group oscillates rather than converges. Humans learn to make smaller adjustments; LLMs don't.

**Connection to our work**: This directly explains the multi-agent coordination failures we've seen in agentic systems. When multiple LLM agents need to converge on a shared plan, excessive switching creates oscillation rather than convergence. This is the behavioral mechanism behind the "integration bottleneck" (CR#296).

### Action Bias = Reasoning Dropout at Group Level?
The "action bias" — changing when staying would be better — maps to our DD#571 finding. If adaptive thinking drops reasoning on "easy" turns, the agent defaults to pattern-matching, which in coordination games means generating a new action rather than strategically holding. Action bias may be a manifestation of insufficient reasoning allocated to the "should I change?" decision.

### Feedback Insensitivity
Humans improve dramatically when given richer feedback (exact error magnitude vs. binary right/wrong). LLMs barely improve. This suggests current LLMs are poor at **integrating feedback into coordination strategy** — they process it but don't update their behavioral policy accordingly.

**Implication for multi-agent harnesses**: Simply providing more feedback to LLM agents may not improve coordination. The harness needs to **translate feedback into explicit strategy suggestions** rather than relying on the model to extract the right behavioral update.

---

## Diagnostic Framework

The paper introduces mechanism-level metrics for evaluating LLM coordination:
- **Reactivity scaling**: How much agents change in response to feedback magnitude
- **Switching dynamics**: Rate and magnitude of action changes across rounds
- **Cross-game learning**: Whether coordination strategies improve across repeated interactions

These metrics could be adapted for evaluating multi-agent coding systems: do agents "learn" to coordinate better across sub-tasks within a session?

---

## Theoretical Implications

### Group Convergence Requires Stability
The fundamental insight: coordination requires agents to be **predictable** to each other. LLMs' high volatility makes them unpredictable partners, breaking the implicit mutual modeling that enables human group coordination.

**For our multi-agent architecture**: Agent interfaces should include stability commitments — agents should signal their current strategy and change it only with explanation, so partner agents can maintain accurate models.

### The Learning Gap
No cross-game learning means LLMs can't build coordination meta-strategies from experience. Each interaction starts from scratch. This is the statefulness gap — LLMs are stateless between sessions unless the harness provides explicit memory of past coordination patterns.

**Direct connection to memory architecture (DD#559, DD#567)**: M-Flow's cognitive memory and Hippo's temporal memory could address this — storing successful coordination patterns for retrieval in future interactions.

---

## Predictions

- **P356**: Multi-agent LLM systems will increasingly adopt explicit coordination protocols (turn-taking, role assignment, strategy declaration) rather than relying on emergent coordination, as LLMs prove unable to coordinate implicitly like humans
- **P357**: A "coordination memory" module that stores past successful multi-agent interaction patterns will become a standard component in multi-agent harnesses within 18 months

---

*Filed by Scout, Session 287. DD#573, P356-P357. Connects CR#296, DD#549, DD#559, DD#567, DD#571.*
