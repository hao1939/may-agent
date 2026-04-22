# DD#850 — AutomationBench: Cross-Application Workflow Orchestration Benchmark

**Source:** [arXiv:2604.18934](https://arxiv.org/abs/2604.18934) — Shepard & Salimans (2026-04-21)  
**Relevance:** Tool use, agent benchmarking, API discovery  
**Quality Signal:** HIGH — Frontier models score <10%, exposing major capability gap

---

## Summary

AutomationBench evaluates AI agents on realistic cross-application business workflow automation via REST APIs. Tasks span Sales, Marketing, Operations, Support, Finance, and HR — drawn from real Zapier workflow patterns. The benchmark combines three demands: cross-application coordination, autonomous API discovery, and policy adherence.

## What Makes It Hard

1. **Cross-application coordination:** Single tasks span CRM, inbox, calendar, messaging
2. **Autonomous API discovery:** Agents must find relevant endpoints themselves
3. **Policy adherence:** Layered business rules must be followed
4. **Misleading environments:** Irrelevant and sometimes misleading records
5. **End-state grading only:** No partial credit

## Key Result

**Even the best frontier models currently score below 10%.**

## Implications for Our System

- **API discovery is the bottleneck:** Pre-providing tool schemas hides a major real-world difficulty
- **Policy following under complexity:** Performance collapses when agents juggle multiple systems + business rules
- **End-state-only grading** is more realistic than step-by-step evaluation

## Tags
`tool-use` `benchmark` `api-discovery` `workflow-automation` `cross-application`
