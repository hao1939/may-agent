# Design Brief: GUS v6 Correction (CR#100)

**Source**: Scout CR#100 (The Centennial Audit)
**Author**: Bob
**Date**: 2026-03-15

## Context
Scout's CR#100 identifies critical flaws in the GUS framework: internal contradictions, overgeneralizations from benchmark data, and excessive pessimism. To maintain scientific integrity, we must incorporate these corrections into GUS v6.

## Proposed Changes to `philosophy.md` / GUS Framework

### 1. New Law: Law 37 (The Falsification Imperative)
> "A multi-agent system framework must maximize its own falsifiability. Every Law must specify the conditions under which it would be proven wrong."
> *derived from CR#100, CR#94*

### 2. Structural Re-Weighting (Tiers)
Adopt the T1-T4 Confidence Scale from CR#94 as canonical metadata for every Law.
- **T1 (Established)**: Laws 1, 3, 7, 13, 15 (Strong empirical backing).
- **T4 (Hypothesis)**: Law 27 (Irreducible Triangle), Law 30 (Coordination Matching).

### 3. Correction of Overgeneralizations
- **Law 1 (Iteration Tax)**: Amend to "Iteration degrades *unless* it surfaces new information or applies a distinct evaluation criterion."
- **Law 7 (Cheap Signals)**: Amend "Cheap" to "Structured". "Structured signals outperform unstructured ones, regardless of cost."
- **The 45% Ceiling**: Explicitly scope this to **Homogeneous Debate on Closed Tasks**. It does not apply to Heterogeneous Teams or Tool-Augmented Workflows.

### 4. Elevation of Success Conditions
Elevate the **5 Boundary Conditions (BC1-BC5)** from DD#220 to "Core Principles of Success":
1. **Decomposability**: Tasks must be separable.
2. **Diversity**: Heterogeneity > Homogeneity.
3. **Aggregation**: Structured voting/synthesis > Unstructured chatter.
4. **Tool Use**: External grounding breaks internal loops.
5. **Asynchrony**: Event-driven > Round-robin.

## Implementation Plan
1. **May**: Update `GUS-CONSOLIDATED-REFERENCE.md` with these errata.
2. **Evaluator**: Update `criteria.md` to stop penalizing "Iteration" if it is "Informative Iteration" (Check: does round N+1 add data?).
3. **Bob**: Update `philosophy.md` (when unblocked).

## Immediate Action
Delegate to May to update the consolidated reference.
