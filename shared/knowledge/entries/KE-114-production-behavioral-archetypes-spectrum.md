# KE-114: Production Behavioral Archetypes — Spectrum Not Types

**Date**: 2026-04-10
**Source**: EXP-109 Phase 3 (Behavioral Clustering Analysis)
**Confidence**: Medium (silhouette 0.273 = weak but present structure)
**Tags**: production, clustering, behavioral-patterns, intervention-targeting

## Core Finding

K-means clustering of 1,475 production sessions across 11 features reveals **6 behavioral archetypes**, but with weak cluster separation (silhouette=0.273). Production behavior is a **continuous spectrum**, not discrete types. The clusters are analytically useful for intervention targeting even though agents don't neatly fall into categories.

## The Six Archetypes

| Archetype | % | Quality | FM Count | Key Trait |
|-----------|---|---------|----------|-----------|
| **Clean Performers** | 43% | 0.79 | 0.39 | Work well, deliver results |
| **FM-Heavy Workers** | 22% | 0.51 | 3.33 | Moderate quality, drowning in FM codes |
| **Silent Failures** | 19% | 0.27 | 0.12 | Fail without process signals |
| **Expensive Grinders** | 7% | 0.50 | 0.59 | Burn resources for mediocre results |
| **Resilient Recoverers** | 7% | 0.64 | 0.64 | Many failures, effective self-correction |
| **Deep Spiral** | 1% | 0.54 | 1.11 | Extremely deep failure-chain recovery |

## Actionable Insights

### 1. FM-Heavy Workers are the #1 intervention target (22%, 321 sessions)
- 95% have FM-2.x (execution failures), 78% have FM-3.x (verification failures)
- FM-3.3 present in 56% → commit guard directly targets this
- Dominated by **optimizer (28%)** and **coach (27%)** → priority skill deployment targets
- Quality 0.51 means they're *close* to acceptable — fixing process could push Q to 0.65+

### 2. Silent Failures need fundamentally different interventions (19%, 283 sessions)
- Almost no FM codes (0.12) despite 86% needs_improvement
- Current tools (skills, guards, few-shot) will NOT help
- These are capability or routing failures, not process failures
- **Bob dominates** (25%) — complex integration tasks exceed capability boundaries

### 3. Agent role determines cluster membership more than agent quality
- QA: 82% Clean Performers (structured tasks)
- Optimizer: 47% FM-Heavy Workers (open-ended tasks)
- Bob: 34% Silent Failures (complex integration)
- Task type, not agent skill, is the primary driver

### 4. 43% of sessions already work well
- The system isn't broken — it's bimodal
- Focus improvement efforts on the 22% FM-Heavy Workers, not the whole system

## Implications for Skill Development

- **Skills and guards target FM-Heavy Workers** — this is exactly the right population
- **Skills cannot fix Silent Failures** — need different approach (task routing, early termination)
- **Intervention thresholds should be continuous** (e.g., "if FM count > 2") not categorical
- **Agent-specific interventions**: optimizer and coach need different skills than coder and qa

## Connection to Other Knowledge

- Extends KE-112 (production quality multimodal) with cluster-level granularity
- Informs KE-113 (commit guard) — the guard targets FM-Heavy Workers specifically
- Challenges KE-111 assumption that all sessions need the same evaluation depth — Silent Failures need different analysis than FM-Heavy Workers
