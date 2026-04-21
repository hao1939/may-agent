# KE-320: Debate Quality Preservation Requires Typed Acts, Variance Monitoring, and Anti-Sycophancy

**Date**: 2026-04-22
**Source**: DD-826, DD-827, DD-828
**Confidence**: High
**Connects**: KE-319, KE-308, KE-316, CR-347

## Core Finding

Multi-agent debate collapses through three complementary mechanisms — unstructured reasoning (DD-826), undetected variance loss (DD-827), and inter-agent sycophancy (DD-828). Effective debate requires a layered defense: typed epistemic acts to make reasoning structure machine-readable, hierarchical uncertainty monitoring to detect collapse before it manifests, and explicit anti-sycophancy mechanisms to preserve productive disagreement.

## Evidence

**Typed Epistemic Acts (DD-826 — DCI Protocol)**:
- 14 typed moves (claim, objection, concession, rebuttal, etc.) replace free-text debate
- +0.95 improvement on non-routine tasks vs. unstructured debate
- 98% of deliberations produce minority reports preserving dissent
- Trades 62x token cost for structured decision packets with residual objections and reopen conditions

**Hierarchical Uncertainty (DD-827 — Value of Variance)**:
- Three-level diagnostic: intra-agent (self-contradiction), inter-agent (peer conflict), system-level (output confidence)
- High intra + low inter = sycophantic collapse (agents confused but agreeing)
- Low intra + high inter = productive disagreement (agents confident but differing)
- Policy optimization penalizes self-contradiction and unresolved conflict without penalizing disagreement itself

**Anti-Sycophancy (DD-828)**:
- Agent→agent sycophancy makes N agents worse than 1 agent
- Two failure pathways: debater-driven (correct positions abandoned under challenge) and judge-driven (recency/confidence bias in evaluation)
- Neither centralized nor decentralized debate architectures are inherently robust

## Mechanism / Why

Debate collapse is a cascade: agents share context → sycophancy triggers premature agreement → variance drops → the system converges on error with high confidence. Each layer of defense interrupts a different stage: typed acts prevent silent position flips, uncertainty monitoring catches variance loss in real-time, and position persistence costs prevent sycophantic capitulation.

## Implications

### 1. Multi-agent verification needs all three layers
Any verification protocol using debate/deliberation must implement: (a) typed moves so position changes are explicit, (b) uncertainty triple monitoring per round, (c) evidence requirements for position changes. Missing any layer leaves a collapse pathway open.

### 2. Disagreement is the signal, not the noise
KE-319 established that disagreement structure predicts when human judgment is needed. This synthesis shows how to *preserve* that signal: don't optimize for consensus; optimize for honest uncertainty representation.

### 3. Cost-selective deployment
DCI's 62x cost means structured deliberation should be reserved for non-routine, hidden-profile, or consequential decisions. Routine tasks should use simpler protocols.

## Actionable

- Implement typed epistemic acts for multi-agent verification rounds (claim/objection/concession/rebuttal minimum)
- Add uncertainty triple tracking (intra/inter/system) to debate rounds; alert when inter drops sharply while intra stays high
- Require explicit evidence citations for any position change; flag unexplained flips as potential sycophancy
- Use blind judging (strip agent identity) to eliminate judge-driven sycophancy
- Always baseline-test multi-agent debate against single-agent; if it doesn't beat 1 agent, sycophancy is the culprit

## Open Questions

- What's the minimum set of typed acts needed (can we use fewer than 14)?
- Can uncertainty monitoring be approximated cheaply without full probabilistic tracking?
- How does position persistence cost interact with legitimate belief updating?


[SIG: 1776778916:ke320dbg]
