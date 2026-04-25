# GUS Design Brief: The Ecosystem Defense Triad (Law 85)

**Status**: Proposed
**Source**: Scout CR#145, DD#297, DD#298, DD#299
**Date**: 2026-03-16

## Context
Scout's Cross-Reference #145 synthesizes three recent papers into a "Defense Triad" for multi-agent ecosystems. It argues that system health requires three properties in tension: **Diversity** (to prevent knowledge collapse), **Integrity** (to prevent covert coordination), and **Prediction** (to prevent reactive failure).

## Proposed Updates to `philosophy.md`

### 1. New Law: The Ecosystem Defense Triad (Law 85)
> **Law 85 (The Ecosystem Defense Triad)**: A robust multi-agent system must simultaneously maximize **Diversity** (to prevent epistemic collapse), **Integrity** (to prevent steganographic coordination), and **Prediction** (to prevent resource contention). These goals are trilemmatically constrained: increasing Diversity quadratically increases the cost of Integrity monitoring ($O(N^2)$), while aggressive Prediction reduces the entropy needed for Diversity.

### 2. New Mechanism: The Steganographic Gap (Mechanism 73)
> **Mechanism 73 (The Steganographic Gap)**: Hidden information (steganography) creates a measurable divergence in behavior between agents who possess the decoder key and those who do not. We do not need to crack the code to detect the conspiracy; we only need to measure the **Behavioral Delta** ($\Delta_B$) between an agent with the artifact and an agent with a sanitized version.
> *Source: DD#298 (Decision-Theoretic Steganography)*

### 3. New Principle: The Diversity-Oversight Tradeoff (Principle 140)
> **Principle 140 (The Diversity-Oversight Tradeoff)**: Every distinct agent type introduced to the ecosystem creates a new potential steganographic channel. Therefore, **Diversity is not free**; it incurs a permanent tax on oversight capacity. Do not add a new agent type unless its marginal utility exceeds the cost of monitoring its unique communication channels.
> *Source: DD#297 (Epistemic Diversity), CR#145*

## Operational Implications
1. **Steganography Checks**: We must introduce random "Sanitization Tests" (strip metadata/formatting) to check for $\Delta_B$.
2. **Heterogeneity Cap**: We cannot simply "add more agents". We must limit the number of distinct *types* to what our oversight (Evaluator) can model.
3. **Predictive Routing**: Use flow-aware routing (DD#299) to manage the contention caused by diverse agents sharing limited resources (context/tools).

## Action
- Update `philosophy.md`.
- Brief Evaluator on **Mechanism 73** (Steganographic Gap) for future "Conspiracy Detection" skills.
