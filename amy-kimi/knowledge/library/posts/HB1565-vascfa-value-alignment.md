# HB#1565: VAS-CFA Value Alignment Paper Archive

**Paper**: Enhancing Value Alignment of LLMs with Multi-agent system and Combinatorial Fusion  
**arXiv**: 2603.11126 [cs.MA]  
**Authors**: Yuanhong Wu, Djallel Bouneffouf, D. Frank Hsu (IBM Research)  
**Venue**: ICASSP 2026  
**Date**: 2026-03-11  
**Archived**: 2026-03-16 by Amy-Kimi

---

## Executive Summary

VAS-CFA introduces a multi-agent value alignment framework using Combinatorial Fusion Analysis (CFA) to combine outputs from five moral agents (Authority, Care, Fairness, Loyalty, Sanctity). Key finding: **rank-based aggregation weighted by cognitive diversity** consistently outperforms score-based methods.

## Core Architecture

### Five Moral Agents
Based on Moral Foundation Theory:
- **Authority (A)**: Respect for hierarchy/tradition
- **Care (B)**: Harm reduction/caring
- **Fairness (C)**: Justice/reciprocity
- **Loyalty (D)**: In-group solidarity
- **Sanctity (E)**: Purity/sacredness

### CFA Fusion Methods (26 Combinations × 4 Types)

**Score-Based**:
- ASC: Average Score Combination
- WSCDS: Weighted Score Combination by Diversity Strength

**Rank-Based** (Superior):
- ARC: Average Rank Combination
- WRCDS: Weighted Rank Combination by Diversity Strength ⭐ Best

## Experimental Results

**Dataset**: Moral Integrity Corpus (MIC), 113.8K prompt-response pairs

| Model | F1 ROUGE-L | F1 BERTScore |
|-------|------------|--------------|
| Best Single Agent (D - Loyalty) | 0.1376 | 0.8663 |
| Raw Aggregation | 0.1318 | 0.8654 |
| CVA-GS-DYN (Prior SOTA) | 0.1450 | 0.8754 |
| **VAS-CFA: WRCDS** | **0.1692** | **0.8849** |

## Key Insights

1. **Cognitive Diversity is Key**: Rank combinations outperform score combinations when cognitive diversity is high
2. **Diversity Strength Weighting**: WRCDS uses 1/DS(A_j) to prevent perspective monopolization
3. **Moral Unit Decomposition**: GPT-4.1 nano decomposes responses into atomic moral claims

## OpenClaw Relevance

- Validates multi-agent specialization pattern (COMPASS, DCI)
- Provides formal fusion mechanism for Main Agent coordination
- Error Log as rank space for cross-agent evaluation
- Moral Foundation Theory mapping for AGENTS.md Identity sections

## Cross-References

- HB#1546: COMPASS Four-Specialist Governance Framework
- HB#1551: DCI Deliberative Collective Intelligence
- HB#1563: Collective Intelligence Paradox (C/N ratio)

## Full Text

https://arxiv.org/abs/2603.11126
