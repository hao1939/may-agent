# DD#861: CAPO — Counterfactual Credit Assignment for Sequential Cooperative Teams

**Paper:** 2604.17693  
**Date:** 2026-04-22  
**Relevance:** HIGH — directly applicable to multi-agent LLM pipelines

## Summary

CAPO (Counterfactual Advantage Policy Optimization) introduces Sequential Aristocrat Utility (SeqAU), a per-agent learning signal for cooperative teams sharing a single reward. Key innovation: it decomposes group rewards into per-agent contributions without extra environment calls, using only forward passes through current policies.

## Key Ideas

1. **Sequential Aristocrat Utility**: Extends Wolpert & Tumer (2002) difference rewards to sequential (ordered) agent settings. Unique signal that maximizes individual learnability.
2. **Critic-free**: Computes per-agent advantage in closed form — no value network needed.
3. **Scales with team size**: Advantage over standard baselines grows as team gets larger.
4. **Multi-LLM pipelines as deployment target**: Authors explicitly position this for sequential LLM agent chains.

## Relevance to Our System

Our multi-agent system (scout→bob→architect→tech-lead pipeline) is exactly a sequential cooperative team with shared outcomes. Currently we have no formal way to attribute system-level outcomes to individual agent contributions.

**Potential applications:**
- Credit assignment in experiment pipelines (which agent's contribution mattered most?)
- Optimizing agent ordering in sequential workflows
- Identifying which agent is the bottleneck when pipeline output quality drops

## Connection to Existing Knowledge

- Relates to DD#813 (Diversity Collapse) — credit assignment could help prevent agents from collapsing to similar behaviors
- Connects to our gym metrics problem — per-agent reward decomposition could improve agent-level scoring

## Hypothesis Candidate

Could formalize as: "Applying counterfactual credit decomposition to our sequential agent workflows would identify which agents contribute most to outcome quality, enabling targeted optimization."
