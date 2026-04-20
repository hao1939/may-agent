# DD#791 — HORIZON: Cross-Domain Diagnostic Benchmark for Long-Horizon Agent Failures

**Paper**: Wang, Bai, Sun, Wang, Zhang, Hu, Schroder, Mutlu, Song & Nowak (2026). "The Long-Horizon Task Mirage? Diagnosing Where and Why Agentic Systems Break." arXiv:2604.11978  
**Relevance**: ★★★★★ — Cross-domain failure taxonomy with 3100+ trajectories; trajectory-grounded LLM-as-Judge pipeline; directly extends DD#785-789  
**Date**: 2026-04-20  
**KE Links**: CR#345 (behavioral failure prediction), DD#785 TrajAD (trajectory-level anomaly detection)

---

## Key Finding

**Long-horizon agent failures follow systematic, domain-dependent degradation patterns that can be diagnosed via trajectory-grounded LLM-as-Judge — achieving κ=0.84 agreement with human annotators.** The HORIZON benchmark provides structured failure attribution across 4 domains with 3100+ trajectories from GPT-5 variants and Claude models.

## Study Design

- **3100+ trajectories** across four representative agentic domains
- **Models evaluated**: GPT-5 variants and Claude models (SOTA)
- **Trajectory-grounded LLM-as-Judge pipeline** for scalable failure attribution
- **Human validation**: inter-annotator κ=0.61; human-judge κ=0.84
- **Cross-domain**: designed for systematic comparison across domains

## Core Results

| Metric | Value | Significance |
|--------|-------|-------------|
| Human-Judge agreement | **κ=0.84** | LLM-as-Judge is reliable for failure attribution |
| Inter-annotator agreement | κ=0.61 | Reasonable human baseline (substantial agreement) |
| Horizon-dependent degradation | Yes | Performance degrades systematically with task horizon |
| Cross-domain patterns | Domain-dependent | Different failure modes dominate in different domains |

## Why This Matters for Us

### 1. Failure Attribution at Scale
The trajectory-grounded LLM-as-Judge pipeline with κ=0.84 human agreement provides a practical, scalable method for failure attribution. This complements HINTBench (DD#790): where HINTBench shows LLM-as-Judge fails at step localization, HORIZON shows it succeeds at failure *type* attribution — suggesting a two-stage pipeline.

### 2. Cross-Domain Failure Taxonomy
Different domains exhibit different failure modes. This validates our approach of domain-specific behavioral signals (CR#345) rather than one-size-fits-all monitoring.

### 3. Horizon-Dependent Degradation Patterns
The systematic study of how failures increase with task horizon directly informs our agent architecture decisions — when to checkpoint, when to decompose, when to escalate.

### 4. SOTA Model Evaluation
Testing GPT-5 variants and Claude models on long-horizon tasks provides the most current data on frontier model limitations in agentic settings.

## Connection to DD#785-789 Stack

| Component | HORIZON's Contribution |
|-----------|----------------------|
| DD#785 TrajAD | HORIZON provides 3100+ ground-truth trajectories; TrajAD provides the detection method |
| DD#786 Entropy | HORIZON's horizon-dependent degradation could correlate with entropy increases |
| DD#787 Confidence | Cross-domain patterns may reveal where confidence miscalibration is worst |
| DD#789 AgentFixer | HORIZON's failure attribution taxonomy could feed AgentFixer's fix recommendation |

## Limitations

- Specific failure categories not detailed in abstract — need full paper review
- Four domains may not cover all agentic use cases
- LLM-as-Judge pipeline validated on attribution but not on step-level localization

## Bottom Line

HORIZON provides the **largest cross-domain failure analysis of SOTA agents** with a validated scalable attribution pipeline. Combined with HINTBench (DD#790), we now have benchmarks for both intrinsic risk detection and cross-domain failure attribution. The κ=0.84 LLM-as-Judge result is particularly actionable — we could deploy similar attribution for our own agent failures.
