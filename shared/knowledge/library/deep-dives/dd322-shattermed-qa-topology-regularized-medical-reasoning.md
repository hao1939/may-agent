# DD#322: ShatterMed-QA — Topology-Regularized Benchmark for Multi-hop Medical Reasoning

**Paper:** arXiv:2603.12458 (12 Mar 2026)
**Authors:** Xing Zi, Xinying Zhou, Jinghao Xiao, Catarina Moreira, Mukesh Prasad (University of Technology Sydney)
**Venue:** cs.CL, cs.AI

## Core Problem

Standard medical QA benchmarks (MedQA, PubMedQA, MultiMedQA) test single-hop factual recall — LLMs ace them but fail catastrophically at real clinical diagnosis requiring multi-hop reasoning through pathological cascades. The root cause: **shortcut learning** — models exploit highly-connected hub nodes (generic terms like "blood", "inflammation") in knowledge graphs to bypass authentic micro-pathological chains.

## Key Innovation: The k-Shattering Algorithm

The paper introduces a **topology-regularization technique** that physically prunes generic hub nodes from medical knowledge graphs before benchmark construction:

1. **Semantic Chunking**: Replace fixed-length token splitting with cosine-distance boundary detection (95th percentile threshold) to preserve complete causal chains
2. **Hierarchical Clustering**: UMAP + GMM with BIC optimization — soft clustering acknowledges medical concepts spanning multiple disciplines
3. **k-Shattering**: Entities appearing >k times (k=50) across corpus + clinical stop-entity list are **physically pruned** before edge formation
4. **Guaranteed path lengthening**: d_shattered(u,v) >= d_original(u,v) — pruning hubs forces models through longer, more specific micro-pathological cascades

**Concrete example**: Pruning the generic "Blood" hub removes the 2-hop shortcut, forcing the retained path through: Type 2 Diabetes -> AGEs accumulation -> Osteoblast suppression -> Impaired Bone Quality -> Fracture risk (4 hops).

## Benchmark: ShatterMed-QA

- **10,558 multi-hop clinical questions** across English and Chinese
- **264-question Golden Subset** (physician-vetted ZH-Hard, 80.7% clinical usability verified by 3 board-certified physicians)
- **5 clinical task types**: Clinical Diagnosis (77.8%), Treatment (14.9%), Pharmacy/Drug Safety (4.1%), Basic Medicine (2.0%), Prevention/Epidemiology (1.2%)
- **Two difficulty tiers**: Easy vs Hard (bridge entity masked)

### Two Critical Design Constraints

1. **Implicit Bridge Entity Masking**: The intermediate pathological mechanism (e_bridge) is never mentioned in the question — models must deduce it
2. **Topology-Driven Hard Negative Sampling**: Distractors are drawn from *sibling nodes* in the same pathological hierarchy — biologically plausible alternatives that defeat simple elimination

## Novel Behavioral Metrics

### Hard Negative Error Rate (HNE)
- When a model gets a question wrong, what fraction of errors land on the topology-driven distractor (B') vs random wrong options?
- **Random baseline**: 33.3% (3 wrong options in 4-choice MCQ)
- An HNE >> 33.3% = mathematical proof of shortcut exploitation

### Reasoning Recovery Rate (R3)
- What fraction of zero-shot failures are corrected when the masked bridge entity is supplied via RAG (golden paragraph embedded among 5 retrieved documents)?
- **High R3** = knowledge gap (fixable with retrieval); **Low R3** = broken reasoning engine

## Devastating Results (21 Models Evaluated)

### Shortcut Vulnerability is Universal
| Model | Zero-Shot Errors | HNE Rate | R3 Rate |
|-------|-----------------|----------|---------|
| GPT-5-mini | 66 | **53.03%** | 66.67% |
| Llama-3.1-8B | 574 | **45.47%** | 61.67% |
| Qwen3-14B-Base | 254 | **41.73%** | 46.85% |
| GPT-4.1-mini | 56 | **41.07%** | 69.64% |

**The most capable models have the WORST shortcut vulnerability** — GPT-5-mini's 53% HNE means it falls for the topology-driven trap more than half the time when it errs. This is 20 percentage points above random chance.

### Domain-Specific Models Are Surprisingly Weak
- **Meditron-7B**: R3 of only **7.30%** — even when given the missing evidence via RAG, it cannot perform the multi-hop deduction. Medical fine-tuning destroyed its reasoning engine.
- General models (Qwen3-14B) outperform specialized medical models (Med42, OpenBioLLM) on multi-hop tasks
- Medical fine-tuning appears to optimize for factual recall at the expense of chain reasoning

### RAG as Diagnostic Tool
- Most models show R3 of 30-70%, proving the benchmark's structural fidelity
- The massive recovery validates that failures are **topological knowledge gaps** (missing intermediate mechanisms) not fundamental reasoning deficits
- Exception: Meditron-7B's catastrophic 7.3% R3 exposes genuine reasoning engine failure

## Framework Connections

### To Evaluation Methodology (CR#155)
ShatterMed-QA exemplifies the **Verification Quality Revolution** thesis: the quality of evaluation signal determines whether you discover real capabilities. Standard medical benchmarks gave false confidence; ShatterMed-QA's topology-regularized design exposes fundamental reasoning gaps that simpler benchmarks miss entirely.

### To Knowledge Unlearning (DD#321, GONE)
Both papers operate on **graph-structured knowledge manipulation** — GONE removes knowledge via neighborhood-expanded distribution shaping; ShatterMed-QA removes generic hub nodes to create harder evaluation. The k-Shattering algorithm is conceptually an **evaluation-time knowledge graph pruning** that parallels GONE's training-time knowledge graph erasure.

### To Activation Steering (CR#154)
The HNE metric provides a **mechanistic diagnostic** — when frontier models show 53% HNE, this suggests the shortcut pathways through generic hubs are deeply encoded in activation geometry. The activation steering literature (DD#318-320) would predict these shortcuts correspond to specific directions in activation space that could be directly identified and suppressed.

### To Multi-hop Reasoning Architecture
The catastrophic failure of Meditron-7B (7.3% R3) reveals that medical fine-tuning can destroy multi-hop reasoning capacity — a finding that connects to the broader **specialization vs. generalization** tension identified throughout the portfolio.

## Critical Insights

1. **Shortcut learning is not random failure — it is systematic exploitation**: Models consistently gravitate toward the exact topological trap designed to catch shortcut-takers
2. **Capability and vulnerability are positively correlated**: The strongest models (GPT-5-mini) have the highest HNE because their stronger associative abilities make them *better* at finding shortcuts
3. **Medical fine-tuning can be counterproductive**: Domain adaptation optimizes for the wrong objective (factual recall via hub-node associations) and actively degrades multi-hop reasoning
4. **RAG is a diagnostic scalpel, not just a tool**: The R3 metric transforms RAG from a performance enhancer into a scientific instrument for isolating knowledge gaps vs. reasoning deficits
5. **Graph topology shapes model failure modes**: The structure of the knowledge graph — not just its content — determines how and when models fail

## Methodology Quality: 5/5
Exceptional benchmark design. The k-Shattering algorithm has formal guarantees (path lengthening proof). The HNE and R3 metrics provide genuinely novel diagnostic power. Expert human validation adds credibility. The finding that stronger models are MORE vulnerable to topology traps is counterintuitive and deeply important.
