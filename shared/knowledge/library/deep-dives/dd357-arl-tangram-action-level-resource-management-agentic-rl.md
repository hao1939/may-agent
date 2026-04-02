# DD#357: ARL-Tangram — Action-Level Resource Management for Agentic Reinforcement Learning

**Paper:** arXiv:2603.13019 — "ARL-Tangram: Unleash the Resource Efficiency in Agentic Reinforcement Learning"  
**Authors:** Bangjun Xiao, Yihao Zhao, Xiangwei Deng, et al. (Peking University + Xiaomi LLM-Core)  
**Submitted:** 2026-03-13  
**Rating:** ★★★★★ CRITICAL — First rigorous systems-level treatment of the *training-time* resource management problem specific to agentic RL, with formal scheduling algorithm and 4.3× ACT improvement. Deployed in production for MiMo model training.

---

## 1. Core Problem

**Agentic RL training demands substantial *external* resources (CPUs for code execution, GPUs for reward models, API quotas for web browsing) that exist outside the primary training cluster, and existing frameworks manage these resources with static over-provisioning — leading to severe waste and training bottlenecks.**

The key insight: Agentic RL is fundamentally different from standard RL because agents interact with real-world environments through tools. These tool invocations require heterogeneous external resources (CPU clusters, GPU clusters for reward models, API quotas) that are:
1. **On the critical path** — every tool invocation delays the entire trajectory
2. **Bursty** — invocation patterns vary by 3 orders of magnitude during training
3. **Heterogeneous** — different RL tasks need different resource types
4. **Stateful** — environments must preserve state across invocations

### Over-Provisioning at Two Levels

| Level | Problem | Measured Waste |
|-------|---------|----------------|
| **Within trajectories** | Resources reserved for entire trajectory lifetime, but only used 47% of the time (AI coding) | 53% idle resources |
| **Within RL tasks** | Each task deploys isolated services on dedicated resources, but GPU SM activity averages <3% | >97% GPU underutilization |

**Why this matters for multi-agent systems:** This is the *training-side complement* to DD#355 (AgentServe, inference serving). Together they reveal that the entire compute lifecycle of agentic AI — from training to deployment — requires fundamentally new systems infrastructure. The old "allocate resources statically, run to completion" paradigm fails for agents.

---

## 2. Architecture: Action-Level Orchestration

ARL-Tangram's core contribution is shifting resource management granularity from **trajectory-level** to **action-level** — treating each atomic tool invocation as the scheduling unit.

### Three-Component Architecture

```
RL Framework (VeRL)
        ↓ action submissions
┌─────────────────────────────┐
│   ARL-Tangram               │
│                             │
│ 1. Action Formulation       │  ← Unified vectorized cost model
│    C_i = (c_{i,0},...,c_{i,k-1})
│                             │
│ 2. Elastic Scheduler        │  ← Greedy eviction + DP allocation
│    min Σ (T_i^q + T_i)     │
│                             │
│ 3. Resource Managers        │
│    ├── CPU Manager (AOE)    │  ← Allocate-on-Execution via cgroups
│    ├── GPU Manager (EOE)    │  ← Evict-on-Execution with CPU backup
│    └── Basic Manager        │  ← API quotas, concurrency limits
└─────────────────────────────┘
        ↓ results
RL Framework continues
```

### 2.1 Unified Action Formulation

Every external invocation is formalized as:
- **Vectorized cost:** C_i = (c_{i,0}, c_{i,1}, ..., c_{i,k-1}) over k resource types (CPU, GPU, memory, GPU memory, network, API quotas)
- **Elasticity model:** For scalable actions, getDur(m) = T_ori / (E(m) × m), where E(m) ∈ (0,1] captures parallel efficiency
- **Key assumption:** Only one resource type is the "key elasticity resource" per action — reasonable because GPU memory is constraint but GPU count determines speed

### 2.2 Elastic Scheduling Algorithm

**Objective:** minimize total ACT = Σ (T_i^q + T_i) over N queued actions

**Approach:**
1. **FCFS ordering** (prevents starvation — critical because starved actions invalidate entire trajectories)
2. **Greedy eviction for resource allocation:** Start with maximum candidates at minimum resources → iteratively evict last candidate, reallocate its resources to remaining → stop when eviction no longer improves objective
3. **Topology-agnostic DP** (DPArrange) for optimal discrete allocation among scalable candidates

### 2.3 Heterogeneous Resource Managers

**CPU Manager (Allocate-on-Execution / AOE):**
- Bypasses Kubernetes pod-level scheduling overhead
- Directly modifies Docker cgroup configuration per action via `docker update`
- NUMA-aware core allocation for parallel efficiency
- Memory preserved between actions (cheap); CPU cores released immediately

**GPU Manager (Evict-on-Execution / EOE):**
- Multi-model GPU sharing via state backup to CPU memory
- On action request: check if service cached in GPU → if not, restore from CPU memory, evict as needed
- Multi-level cell structure for GPU allocation (2^a contiguous chunks, a ∈ {0,1,2,3})
- LRU eviction policy to reduce cache dithering
- Elastic DoP: different parallelism configs treated as distinct services

**Critical design insight:** AOE and EOE embody opposite strategies for the same problem — how to share expensive resources across actions while preserving state:
- **CPU:** State is cheap (memory), compute is the bottleneck → release compute, keep state
- **GPU:** State loading is expensive (model weights), but memory is scarce → cache aggressively, evict strategically

---

## 3. Key Results

### 3.1 End-to-End Performance

| Workload | ACT Improvement | Step Duration Speedup | Resource Savings |
|----------|----------------|----------------------|------------------|
| AI Coding (CPU) | **4.3×** (env interaction 9.0×, reward 2.8×) | **1.4×** | — |
| MOPD (GPU) | Model multiplexing benefit | — | — |
| DeepSearch (API) | Reduced errors/retries | **1.5×** | — |
| MOPD+Search (combined) | Substantial GPU pooling gain | — | **71.2%** |

### 3.2 Scalability Results

**CPU scalability:**
- Batch size 128→1536: ARL-Tangram 3.1× to **27.7×** faster than Kubernetes baseline
- At batch size 1536, Kubernetes baseline triggers control plane timeouts; ARL-Tangram handles it with <2× ACT increase

**GPU scalability:**
- At batch size 2048: **18.1×** faster than SGLang (ServerlessLLM fails entirely)
- At batch size 1024: 3.4× faster than SGLang, 101.8× faster than ServerlessLLM
- **Resource efficiency:** Same performance with only 29% of baseline GPU allocation

### 3.3 System Overhead

| Workload (batch size) | Execution Duration | Queue Duration | System Overhead |
|----------------------|-------------------|----------------|-----------------|
| AI Coding (1280) | 0.975 | 0.015 | **0.024 (2.4%)** |
| AI Coding (1536) | 1.206 | 0.428 | **0.036 (2.9%)** |
| MOPD (2048) | 0.621 | 0.081 | 0.201 (24.5%) |
| MOPD (3072) | 0.705 | 15.05 | 0.240 (25.4%) |

CPU overhead is negligible (<3%). GPU overhead is higher (~25%) due to model restoration but **does not scale with concurrency** — remains stable even at 3072 batch size.

### 3.4 Scheduling Ablation

Elastic scheduling vs. fixed DoP:
- vs. DoP=4 at batch size 256: **2.0×** improvement
- vs. DoP=16 at batch size 1280: **3.0×** improvement
- Under constrained resources (1× CPU): **1.8×** improvement

---

## 4. Key Novel Contributions

### 4.1 The Action Abstraction for Agent Infrastructure

The paper's deepest contribution is the **action as the fundamental unit of agent systems management**. This parallels:
- OS process scheduling → action scheduling
- Virtual memory → state preservation across actions (AOE/EOE)
- Page replacement algorithms → LRU model eviction

This maps directly to DD#271 (AgentRM)'s OS-inspired agent resource management thesis, but at the *training* level rather than inference.

### 4.2 The Breakdown & Pool Paradigm

A clean decomposition of the resource sharing problem:
- **Breakdown:** Release resources between actions while preserving state
- **Pool:** Share released resources across trajectories and RL tasks

This is the first formal articulation of how to decompose the "stateful sharing" problem for agent workloads.

### 4.3 Production Validation

Deployed at Xiaomi for MiMo series model training. This is not a paper prototype — it's production infrastructure supporting one of the largest open-source model families.

---

## 5. Connections to Portfolio

### Direct Connections
- **DD#355 (AgentServe):** Inference-side complement. AgentServe solves the same three-phase workload decomposition problem at inference time (cold prefill / resume prefill / short decode). ARL-Tangram does it for training (generation / tool invocation / reward computation). Together they cover the full compute lifecycle.
- **DD#356 (ProxMO):** Algorithmic complement. ProxMO optimizes *what* training signal to extract; ARL-Tangram optimizes *how fast* to generate that signal. They're the algorithm-system co-design pair for agentic RL.
- **DD#271 (AgentRM):** Same OS-inspired insight applied at different layers. AgentRM is the middleware abstraction; ARL-Tangram is the cluster-level implementation.
- **DD#341 (CoMAM):** Memory management for multi-agent RL. The "pipeline-as-MDP" formalism in CoMAM could define actions for ARL-Tangram scheduling.

### GUS Integration
- **Validates GUS Principle 76** (infrastructure determines capability ceiling): ARL-Tangram shows that even with identical algorithms, 71.2% resource savings and 4.3× speedup come purely from systems engineering.
- **Extends Law 30** (Infrastructure Gap): The gap between "can train agents" and "can train agents efficiently" is >4× in compute and >70% in resource cost.
- **Supports Prediction P128** (Scale Inversion): Systems efficiency gains compound with algorithmic gains — the multiplicative relationship.

---

## 6. Limitations & Open Questions

1. **FCFS scheduling is suboptimal.** The paper acknowledges this — priority-based or value-aware scheduling could significantly improve training efficiency by prioritizing trajectories with higher learning signal.
2. **GPU restoration overhead (~25%)** is significant. As model sizes grow, this overhead could become the bottleneck.
3. **Single-cluster assumption.** No treatment of geo-distributed resources or multi-cluster scheduling.
4. **No treatment of failure cascades.** What happens when an action fails mid-execution? How does the scheduler handle cascading failures across dependent trajectories?
5. **Static elasticity profiles.** The elasticity function E(m) is profiled offline — but agentic workloads evolve during training. Online adaptation could improve scheduling quality.

---

## 7. Rating Justification

★★★★★ CRITICAL because:
1. **First rigorous systems paper** for agentic RL resource management — fills a major infrastructure gap
2. **Production-deployed** at Xiaomi for MiMo training — not a paper prototype
3. **Substantial empirical improvements** (4.3× ACT, 71.2% resource savings, up to 27.7× scalability advantage)
4. **Clean theoretical contribution** (action abstraction, vectorized cost formulation, elastic scheduling)
5. **Completes the infrastructure stack** when combined with DD#355 (inference) and DD#356 (algorithm) — the training-inference-algorithm trifecta
