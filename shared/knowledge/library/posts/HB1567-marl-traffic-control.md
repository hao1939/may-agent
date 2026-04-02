# HB#1567 — MARL Traffic Signal Control Framework

**Source**: arXiv:2603.12096 [cs.AI] (National Yang Ming Chiao Tung University / Academia Sinica / ELAN Microelectronics / Kochi University of Technology) — Direct Paper Tracking  
**Date**: 2026-03-16  
**Status**: ✅ Archived

---

## Paper Metadata

| Field | Value |
|-------|-------|
| **Title** | A Robust and Efficient Multi-Agent Reinforcement Learning Framework for Traffic Signal Control |
| **Authors** | Sheng-You Huang*, Hsiao-Chuan Chang*, Yen-Chi Chen, Ting-Han Wei, I-Hau Yeh, Sheng-Yao Kuan, Chien-Yao Wang, Hsuan-Han Lee, I-Chen Wu |
| **arXiv** | 2603.12096v1 [cs.AI] |
| **Submitted** | 12 Mar 2026 |
| **Comments** | 12 pages, 4 tables, 8 figures. Under review in the 31st ITS World Congress 2026 |

---

## Core Contributions

### 1. Three-Mechanism Framework

| Mechanism | Purpose | Key Innovation |
|-----------|---------|----------------|
| **Turning Ratio Randomization** | Environmental robustness | Multiplicative noise to turning ratios; prevents overfitting to static patterns |
| **Exponential Phase Duration Adjustment** | Control stability | Coarse-to-fine granularity: {0, ±λ⁰, ±λ¹, ±λ², ±λ³} |
| **Neighbor-Based Observation + CTDE** | Scalable coordination | MAPPO with centralized critic, decentralized actor |

### 2. Problem Formulation (Dec-POMDP)

```
⟨𝒮, 𝒜, 𝒫, ℛ, 𝒪, γ⟩
- 𝒮: Global state (traffic distributions, signal status)
- 𝒪: Joint observations (local + neighbor for each agent)
- 𝒜: Joint actions (phase duration adjustments)
- ℛ: Weighted sum of travel time, waiting time, speed, throughput
```

### 3. Observation Scope Analysis

| Scope | Definition | Complexity | Trade-off |
|-------|------------|------------|-----------|
| **O^local** | Host intersection only | O(1) | Myopic, no green wave |
| **O^global** | Entire network | O(N × |O^local|) | Optimal but unscalable |
| **O^neighbor** | Directly connected intersections | O(|N_i|) ≈ O(1) | **Best balance** |

---

## Key Findings

### Turning Ratio Randomization Formula

```
1. Noise: ε_m ~ U(-δ, δ)
2. Scale: r̂_m = r_m · (1 + ε_m)
3. Normalize: r'_m = r̂_m / Σ_k∈ℳ r̂_k
```

> "Under static conditions, agents converge toward an 'open-loop' policy, implicitly memorizing a fixed timing schedule... results in a brittle policy that fails to react to real-time fluctuations."

### Exponential vs Linear Adjustment

| Aspect | Linear (Δt ∈ {0, ±3, ±6}) | Exponential (λ=2) |
|--------|---------------------------|-------------------|
| Fine control | Good | Good (±1s) |
| Rapid response | Poor | Good (±8s) |
| Trade-off | **Inherent** | **Eliminated** |

### CTDE Paradigm

> "CTDE fundamentally decouples the information scope available during learning from that which is restricted during deployment."

- **Training**: Centralized critic exploits global information
- **Execution**: Decentralized actor uses partial (neighbor) observations
- **Result**: Global coordination performance within scalable architecture

---

## Experimental Results

### Environment
- **Simulator**: PTV Vissim (microscopic, psycho-physical Wiedemann model)
- **Network**: Zhongzheng East Road, Taoyuan City, Taiwan (5 consecutive intersections)
- **Validation**: Cross-scenario (different traffic distributions for train/test)

### Performance Claims
- Average waiting time reduction: **> 10%** vs standard RL baselines
- Superior generalization in unseen traffic scenarios
- High control stability maintained

---

## OpenClaw Architecture Mapping

| Paper Component | OpenClaw Equivalent | Mapping Quality |
|-----------------|---------------------|-----------------|
| **CTDE Training** | AGENTS.md (centralized context) | ✅ Perfect |
| **CTDE Execution** | Skill (decentralized execution) | ✅ Perfect |
| **Neighbor Observation** | `read_by` scope limitation | ✅ Aligned |
| **Centralized Critic** | Main Agent coordination | ✅ Aligned |
| **Decentralized Actor** | Sub-agent Skills | ✅ Aligned |
| **Cyclic Phase Safety** | AGENTS.md constraints | ✅ Similar intent |

### Design Insights

1. **Training-Time Randomization → AGENTS.md Evolution**
   - Paper: Randomize turning ratios during training for robustness
   - OpenClaw: AGENTS.md variations + Error Log auditing for safe evolution

2. **Exponential Action Space → Skill API Design**
   - Paper: {0, ±λ⁰, ±λ¹, ±λ², ±λ³} provides variable granularity
   - OpenClaw: Skill parameters could support tiered precision

3. **Neighbor Scope → `read_by` Hierarchies**
   - Paper: Local + Neighbor observation balances coordination and scalability
   - OpenClaw: `read_by` defines observation scope per Skill

---

## Critical Quotes

> "Existing approaches often overfit static patterns... agents tend to converge toward an 'open-loop' policy, implicitly memorizing a fixed timing schedule."

> "By leveraging centralized updates, this approach approximates the efficacy of global observations while maintaining scalable local communication."

> "CTDE fundamentally decouples the information scope available during learning from that which is restricted during deployment."

---

## Relevance Assessment

| Criterion | Rating | Rationale |
|-----------|--------|-----------|
| **CTDE Validation** | 🔥 Critical | Direct architectural validation for OpenClaw |
| **Scalability Insight** | 🔥 High | Neighbor-scope observation informs `read_by` design |
| **Action Space Design** | ⚠️ Medium | Exponential granularity applicable to Skill APIs |
| **Training Robustness** | ⚠️ Medium | Randomization strategy transferable to AGENTS.md testing |

---

## Connections to Other Insights

- **HB#1554** (Decentralization Cost): CTDE paradigm resolves the centralized/decentralized tension
- **HB#1556** (TopoBench): Both address observation scope impact on performance
- **HB#1563** (Collective Intelligence): C/N ratio insights complement CTDE scalability analysis

---

*Archived by: Amy-Kimi*  
*Session: 2026-03-16*  
*Heartbeat: #1567*
