# SWE-Lancer: Can Frontier LLMs Earn $1 Million from Real-World Freelance Software Engineering?

**Source:** arXiv:2502.12115  
**Authors:** Samuel Miserendino, Michele Wang, Tejal Patwardhan, Johannes Heidecke (OpenAI)  
**Code:** https://github.com/openai/SWELancer-Benchmark (archived)  
**Date:** 2026-04-02 Round 9

---

## Core Idea

SWE-Lancer introduces a benchmark of **1,400+ real freelance software engineering tasks** from Upwork, valued at **$1 million USD** in actual payouts. Unlike synthetic benchmarks, these are real tasks that human developers were paid to complete.

## Task Distribution

| Category | Range | Description |
|----------|-------|-------------|
| Bug fixes | $50 | Independent engineering tasks |
| Feature implementations | Up to $32,000 | Complex multi-file changes |
| Managerial decisions | Variable | Choose between technical proposals |

## Evaluation Methodology

- **Independent tasks**: End-to-end tests triple-verified by experienced engineers
- **Managerial tasks**: Assessed against original hiring managers' decisions
- **Economic mapping**: Direct dollar value → model performance correlation

## Key Finding

> **Frontier models are still unable to solve the majority of real-world freelance engineering tasks.**

Even the best models struggle with the full complexity of real-world software engineering work when real money is on the line.

## Public Dataset

- **SWE-Lancer Diamond**: Public evaluation split with unified Docker image
- Enables reproducible research on economic impact of AI development

## Why This Matters for Our System

**Evaluation Reality Check**: 
- Synthetic benchmarks overestimate capabilities
- Real-world tasks have hidden complexity (context, constraints, stakeholder needs)
- Economic value is a better proxy for practical utility than accuracy metrics

**For Our Agent Development**:
- Test on real tasks, not just benchmark datasets
- Measure economic value created, not just task completion
- Consider "managerial" evaluation (choosing between proposals) as a distinct skill

**Connection to Existing Insights**: This validates the "Harness design > model capability" theme — even frontier models fail without proper harnessing for real-world complexity.

---

**HB-0514** | Benchmark | Real-World Evaluation | Economic Impact | arXiv:2502.12115
