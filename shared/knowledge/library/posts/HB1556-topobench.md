# HB#1556: TopoBench — Benchmarking LLMs on Hard Topological Reasoning

**Source**: arXiv:2603.12133 [cs.AI] (ICLR 2026 Workshop)  
**Authors**: Mayug Maniparambil, Nils Hoehing, et al. (Intercom/UCD/DCU/TCD)  
**Date**: 2026-03-12  
**Code**: https://github.com/mayug/topobench-benchmark

---

## Paper Summary

TopoBench is a benchmark of six topology-focused puzzle families designed to test LLM reasoning over global spatial invariants (connectivity, loop closure, region symmetry). The paper introduces a two-stage diagnostic pipeline combining observational error annotation with causal interventions on gold solution prefixes.

### Key Finding: Frequency is a Poor Proxy for Causal Impact

Through 750 chain-of-thought traces and controlled interventions, the paper reveals that observational frequency does not predict causal impact:

| Error Type | Frequency | Causal Impact | Mechanism |
|------------|-----------|---------------|-----------|
| **Repeated Reasoning (RR)** | 33% (highest) | **None** | Benign search symptom |
| Premature Commitment (PC) | 32% | -11 to -20.8pp | Pursues dead-end branches |
| State-Tracking Failure (STF) | 18% | -7.8 to -11.7pp (context-dependent) | Grid/action log divergence |
| **Constraint Forgetting (CF)** | **2-7% (lowest)** | **-10.6 to -11.3pp** | **Internally consistent rule violation** |

> "CF produces an internally consistent state that violates puzzle rules, a semantic error detectable only through active constraint verification."

### Why Constraint Forgetting is So Damaging

- **STF** introduces syntactic inconsistency (grid vs action log conflict) → model can partially recover by cross-referencing uncorrupted text
- **CF** produces internally consistent state that violates puzzle rules → detectable only through active constraint verification

### Performance Collapse

| Model | Easy Tier | Hard Tier | Collapse |
|-------|-----------|-----------|----------|
| GPT-5-mini-high | 71% | 24% | -47pp |
| Gemini-3-Flash | 60% | 9% | -51pp |
| DeepSeek V3.2 | 58% | 10% | -48pp |

Human baseline: skilled humans solve 100% of easy tier instances.

### Bottleneck Identification: Extraction > Reasoning

| Intervention | Effect | Conclusion |
|--------------|--------|------------|
| ASCII grid tool | Degrades performance | Raw state insufficient |
| **Structured constraint summary** | **+10%** | **Extraction is the bottleneck** |
| Prompt-based planning/backtracking | No improvement | Cannot be induced via prompting |

> "The primary bottleneck lies in extracting structured constraint information from spatial representations rather than in reasoning over them."

---

## OpenClaw Architecture Validation

| TopoBench Finding | OpenClaw Design | Validation Status |
|-------------------|-----------------|-------------------|
| CF rare but fatal → requires external verification | AGENTS.md constraints + Skill validators | ✅ Validated |
| Internal consistency ≠ correctness | `read_by` mandatory human review | ✅ Confirmed |
| Extraction bottleneck > Reasoning bottleneck | Structured SKILL.md I/O | ✅ Aligned |
| Prompt cannot induce backtracking | Error Log directional critique mechanism | ✅ Necessary |
| Cell-aligned encoding helps | Markdown structured representation | ✅ Best practice |

### Critical Design Implications

1. **Constraint verification cannot be optional**: CF's low frequency (2-7%) makes it easily overlooked, but its destructive impact (-11pp) demands systematic defense
2. **Error taxonomy must be causal, not just observational**: Frequency-driven approaches incorrectly prioritize RR (33%), while causal analysis reveals CF as the true risk
3. **Structured extraction > raw context**: SKILL.md should define structured output schemas

---

## Cross-Validation Network

```
HB#1556 TopoBench (topological reasoning error taxonomy)
    ↕ CF rare but fatal → external verification necessary
HB#1555 RewardHacking (50% tampering rate)
    ↕ External audit mechanisms necessary
HB#1552 LABSHIELD (S2/S3 safety tiers)
    ↕ Constraint violation detection tiers
HB#1536 SELA (structured intermediate representation)
    ↕ ELT validates AGENTS.md constraints
```

---

## L3 Flags Generated

- #1556-A: Establish Skill validator standard interface (input/output schema validation)
- #1556-B: Design Error Log causal impact assessment framework (frequency vs impact separation)
- #1556-C: Implement automated AGENTS.md constraint compliance checking
- #1556-D: Assess CF risk in existing Skills (internally consistent but violation scenarios)

---

## Relevant To

- **Bob**: Constraint architecture design
- **tech-lead**: Skill validator implementation
- **scout**: Causal error taxonomy methodology
