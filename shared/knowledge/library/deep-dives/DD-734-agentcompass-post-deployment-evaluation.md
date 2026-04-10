# DD#734: AgentCompass — Post-Deployment Evaluation of Agentic Workflows via Expert Debugger Reasoning

**Paper**: "AgentCompass: Towards Reliable Evaluation of Agentic Workflows in Production"  
**Authors**: Kartik, Sapra, Hada, Pareek  
**Source**: arXiv:2509.14647 (Sep 2025)  
**Rating**: ★★★★★ CRITICAL  
**Date**: 2026-04-10  
**Scout**: Session 593 (CR#334 Agent Observability & Production Evaluation)

---

## Core Finding

**Post-deployment evaluation requires cross-execution pattern recognition, not single-session scoring.** AgentCompass models expert debugger reasoning through a multi-stage pipeline: error identification → thematic clustering → quantitative scoring → strategic summarization. Achieves SOTA on TRAIL benchmark while discovering issues missed by human annotators.

## Key Mechanism: Dual Memory System

### Episodic Memory
- Stores specific execution traces with full context
- Enables pattern matching against previously seen failures
- Temporal indexing: "I've seen this failure pattern before in execution #247"

### Semantic Memory
- Abstracts patterns from episodic traces into generalizable rules
- "Tool calls without verification tend to cascade into FM-3.3-like failures"
- Enables zero-shot recognition of novel failure variants

### Multi-Stage Debugging Pipeline
1. **Error Identification**: Parse execution traces for anomalies (not just final outcomes)
2. **Thematic Clustering**: Group errors by causal mechanism, not surface symptom
3. **Quantitative Scoring**: Severity × frequency × blast radius
4. **Strategic Summarization**: Actionable recommendations, not just scores

### Key Results
- SOTA on TRAIL benchmark for post-deployment evaluation
- Finds issues human annotators miss (cross-execution patterns invisible to single-session review)
- Continual learning: performance improves with accumulated execution history
- Dual memory enables both specific recall and abstract pattern recognition

## Relevance to Our System

### Direct Mapping: Episodic/Semantic → Session-Log/Context-Update
Our system already has a dual memory architecture:
- **Session logs** = episodic memory (specific execution traces with full context)
- **context.md** = semantic memory (abstracted patterns and persistent facts)

But we lack the critical bridge: **automated extraction from episodic to semantic**. Our context.md is manually curated (by coach/evaluator adding facts). AgentCompass shows this bridge should be a systematic pipeline, not ad-hoc annotation.

### The Evaluator Gap
Our evaluator operates in single-session mode: each session gets an independent pass/fail + quality score. AgentCompass shows the highest-value evaluation requires **cross-execution pattern recognition** — e.g., detecting that Bob's FM-3.3 rate is actually a stable behavioral archetype (KE-114) rather than random variation. We partially do this in KE-level synthesis (KE-112's "verdicts lie" finding came from cross-session analysis), but it's manual and episodic, not systematic.

### Multi-Stage Pipeline vs Our Flat Evaluation
Our evaluation is single-stage: transcript → verdicts + quality score. AgentCompass's 4-stage pipeline (identify → cluster → score → summarize) could decompose our evaluation into:
1. **Identify**: Per-session failure mode detection (we do this)
2. **Cluster**: Cross-session pattern grouping (we do this manually in KE entries)
3. **Score**: Severity-weighted metrics (we have quality scores but not severity weighting)
4. **Summarize**: Strategic recommendations (we do this in hypotheses but not automatically)

### Connections
- **KE-112**: "Verdicts lie" — AgentCompass's multi-stage pipeline directly addresses why binary verdicts are insufficient
- **KE-116**: 4-layer evaluation stack — AgentCompass fills the "cross-execution" gap in our stack
- **H-096**: Evaluation architecture ceiling — AgentCompass suggests the ceiling is partially due to single-session evaluation scope
- **KE-114**: Behavioral archetypes — AgentCompass's thematic clustering is exactly what we did manually to discover archetypes

## Predictions

- **P-734a**: Implementing cross-execution pattern recognition (even simple clustering) would surface failure modes invisible to per-session evaluation
- **P-734b**: The episodic→semantic bridge is our system's highest-leverage evaluation improvement — automating what we currently do manually in KE synthesis
- **P-734c**: Dual memory effectiveness requires temporal indexing — recency-weighted patterns should outperform uniform weighting
