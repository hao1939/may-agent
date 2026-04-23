# HB-260423: Stateless Decision Memory for Enterprise AI Agents (arXiv:2604.20158)

**Source**: arXiv cs.AI, April 22 2026  
**Author**: Vasundra Srinivasan  
**Code**: https://github.com/vasundras/stateless-decision-memory-enterprise-ai-agents

## Core Argument

Enterprise deployment of long-horizon agents in regulated domains (underwriting, claims, tax) **prefers weaker but replayable retrieval over sophisticated stateful memory** — and this is a rational choice, not a capability gap.

## The Hidden Enterprise Requirements

Four load-bearing properties dominate regulated deployment:

| Property | Why It Matters | Stateful Violation |
|----------|---------------|-------------------|
| **Deterministic replay** | Same input → same decision | Stateful architectures have N compounding calls |
| **Auditable rationale** | Every decision must be explainable | State accumulation obscures rationale |
| **Multi-tenant isolation** | Customer data must not leak | Shared state = contamination risk |
| **Statelessness for scale** | Horizontal scaling requires no coordination | Stateful = coordination bottleneck |

## Proposed: Deterministic Projection Memory (DPM)

**Architecture**: Append-only event log + **one** task-conditioned projection at decision time

```
Traditional:  N LLM calls → state accumulation → final decision
DPM:         Event log (immutable) → one projection LLM call → decision
```

## Experimental Results

Tested on 10 regulated decision cases at 3 memory budgets:

| Metric | At 20x compression | Improvement |
|--------|-------------------|-------------|
| Factual precision | +0.52 | Cohen's h=1.17, p=0.0014 |
| Reasoning coherence | +0.53 | h=1.13, p=0.0034 |
| Speed | 7-15x faster | One LLM call vs N |

**At generous budgets**: DPM matches summarization-based memory  
**At binding budgets**: DPM substantially outperforms

## Audit Surface Comparison

| Architecture | LLM calls per decision |
|--------------|----------------------|
| DPM | 2 (deterministic: event log + projection) |
| Summarization | 83-97 on LongHorizon-Bench |

## Determinism Study

10 replays per case at temperature=0:
- Both architectures inherit residual API-level nondeterminism
- **Asymmetry is structural**: DPM exposes 1 nondeterministic call; summarization exposes N compounding calls
- One-versus-N pattern: DPM = O(1), stateful = O(N) nondeterminism

## TAMS Heuristic (Practitioner Tool)

Architecture selection framework for enterprise deployment:
- If replayability > sophistication → DPM
- If audit frequency > decision complexity → DPM  
- If multi-tenant density > state coherence → DPM
- If horizontal scaling > vertical depth → DPM

## Key Insight

> "Statelessness is the load-bearing property explaining enterprise's preference for weaker but replayable retrieval pipelines, and this property is attainable without the decisioning penalty retrieval pays."

## Implications for Our System

1. **Audit logging**: Our file-based approach aligns with DPM's append-only philosophy
2. **Determinism**: Minimize LLM calls in critical paths; prefer structured outputs
3. **Multi-tenancy**: Each workspace isolation is a feature, not overhead
4. **Session replay**: DPM's approach supports deterministic replay for evaluation

## Rating
★★★★★ — Directly challenges assumptions about memory sophistication vs. operational requirements

## Related
- arXiv:2604.20795 (Ontology as memory layer)
- arXiv:2604.20300 (FSFM selective forgetting)
- HB-260423-ontology-llm-memory-layer.md
