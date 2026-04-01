# Deep-Dive #224: Silo-Bench — Evaluating Distributed Coordination in Multi-Agent LLM Systems

**Paper:** arXiv:2603.01045 (March 2026)
**Authors:** Yuzhe Zhang, Feiran Liu, Yi Shan, Xinyi Huang, Xin Yang, Yueqi Zhu, Xuxin Cheng, Cao Liu, Ke Zeng, Terry Jingchen Zhang, Wenyuan Jiang
**Institutions:** Beijing University of Technology, Zhejiang University, ETH Zürich, Meituan, Vector Institute
**Rating:** ★★★★★ — Most important empirical coordination benchmark in our portfolio. 1,620 experiments across 54 configurations provide the largest systematic study of multi-agent coordination to date. Directly validates multiple GUS laws with unprecedented precision.

---

## 1. Core Contribution

Silo-Bench is a **role-agnostic benchmark** of 30 algorithmic tasks across three communication complexity levels, designed to answer a deceptively simple question: *Can LLM agents reliably compute with distributed information, or do they merely exchange it?*

The answer, from 1,620 experiments: **agents exchange information effectively but systematically fail to synthesize it into correct answers.** This is the "Communication-Reasoning Gap" — the central finding.

## 2. Benchmark Design

### 2.1 Task Space (Grounded in Communication Complexity Theory)

Tasks are organized by their optimal communication complexity (Yao, 1979):

| Level | Topology | Complexity | Example Tasks | Communication Pattern |
|-------|----------|-----------|---------------|----------------------|
| **I: Aggregation** | Star/Tree | O(N) | Global max, majority vote, word frequency | Embarrassingly parallel + reduction |
| **II: Mesh Network** | Linear chain | O(N) | Prefix sum, moving average, trapping rain water | Spatial locality, pairwise neighbor exchange |
| **III: Global Shuffle** | Full mesh | O(N log N) to O(N²) | Distributed sort, graph connectivity, matrix multiply | All-to-all, irregular dependencies |

**Critical design choice:** Tasks are **role-agnostic** — no "doctor" or "manager" personas. Each agent receives only a local data shard and must coordinate through one of three protocols (P2P, Broadcast, Shared File System). This isolates coordination capability from semantic role priors.

### 2.2 Scale and Configurations

- **Agent scales:** N ∈ {2, 5, 10, 20, 50, 100}
- **Communication protocols:** P2P (directed messaging), BP (broadcast), SFS (shared file system)
- **Models:** DeepSeek-V3.1, GPT-OSS-120B, Qwen3-Next-80B-A3B
- **Total:** 6 × 3 × 3 = 54 configurations × 30 tasks = **1,620 experiments**

### 2.3 Metrics (Four-Dimensional)

1. **Success Rate (S):** Fraction of agents converging to correct answer. Task succeeds only when S=1 (unanimous).
2. **Partial Correctness Score (P):** Continuous quality measure. The gap P−S isolates reasoning-integration failure from communication failure.
3. **Token Consumption (C):** Computational cost per round.
4. **Communication Density (D):** Inter-agent interaction intensity. D=1 means one message per directed pair on average.

## 3. Key Results

### 3.1 The Communication-Reasoning Gap

The headline finding: agents acquire information but can't integrate it.

**DeepSeek-V3.1 (best model):**
- Level I: PCS = 88.0% but SR = 62.0% → **26-point gap** (agents hold the data, can't compute the answer)
- Level II: PCS = 59.7% but SR = 35.1% → 24.7-point gap
- Level III: PCS = 27.9% but SR = 11.7% → 16.2-point gap

**At N≥50 on Level III:** SR drops to **0%** while PCS remains 8-16%. Agents have partial global information but produce zero correct answers.

### 3.2 Coordination Overhead Compounds Multiplicatively

The **Relative Coordination Cost (RCC)** — fraction of single-agent performance lost to coordination — is devastating:

| Scale | Level I RCC | Level II RCC | Level III RCC |
|-------|------------|-------------|--------------|
| N=2 | 15% | 30% | 49% |
| N=5 | 30% | 55% | 70% |
| N=10 | 45% | 65% | 80% |
| N=50 | 60% | 80-100% | 100% |

**Critical insight:** Single-agent success rate between Level I and Level III differs by only ~15 percentage points. But the multi-agent gap balloons to >18 percentage points. The tasks aren't harder — coordination is.

### 3.3 Scale-Dependent Collapse

| Agent Scale | DeepSeek SR | GPT-OSS SR | Qwen3 SR |
|-------------|------------|-----------|---------|
| N=2 | 61.2% | 34.4% | 17.2% |
| N=5 | 48.5% | 28.0% | 9.1% |
| N=10 | 39.9% | 14.0% | 8.6% |
| N=20 | 33.6% | 13.2% | 7.4% |
| N=50 | 19.0% | 5.2% | 5.1% |
| N=100 | 18.1% | 6.4% | 1.0% |

**Communication density DECREASES with scale:** From D=2.80 (N=2) to D=0.14 (N=100) for DeepSeek. Agents become sparser in interaction *precisely when denser coordination is most needed.*

### 3.4 Emergent Topology Discovery

Despite these failures, agents show remarkable emergent behavior:
- Agents **spontaneously discover task-appropriate communication topologies** (star for aggregation, chains for mesh, full-mesh for shuffle)
- They actively coordinate and exchange information
- **The failure is not in communication but in reasoning-integration** — they can't synthesize distributed state into correct answers even when they have sufficient information

### 3.5 Protocol Effects

- **P2P** slightly outperforms broadcast on coordination quality (D=1.52 vs D=0.93 for DeepSeek)
- **SFS (shared file system)** underperforms — the indirection adds cognitive overhead
- Protocol choice matters less than model capability and task complexity

### 3.6 Model Size ≠ Robustness

DeepSeek-V3.1 (36.9% avg SR) outperforms GPT-OSS-120B (16.9%) by 4.5×. But all models fail on Level III at scale. **No model achieves majority success rate on distributed computation tasks beyond N=10.**

## 4. GUS Framework Validation

This paper provides the strongest empirical validation of multiple GUS laws:

### Direct Validations

| GUS Component | Silo-Bench Evidence | Strength |
|--------------|-------------------|----------|
| **Law 1 (Diminishing Returns)** | SR drops from 61% (N=2) to 18% (N=100). More agents = less success. | ★★★★★ VALIDATED |
| **Law 3 (Task Difficulty Escalation)** | RCC compounds multiplicatively with scale AND complexity. Level I→III at N=50: 60%→100% coordination cost. | ★★★★★ VALIDATED |
| **Law 13 (Scaling Inversion)** | Communication density DECREASES as N increases (2.80→0.14). System becomes less coordinated as it grows. | ★★★★★ VALIDATED |
| **Law 19 (Minimum Sufficient Coordination)** | Agents can't achieve required coordination at N>10 for complex tasks. There's a minimum coordination threshold. | ★★★★ STRONGLY SUPPORTED |
| **Law 21 (Multi-Layer Optimization Paradox)** | PCS-SR gap shows information is acquired (proxy satisfied) but computation fails (real objective missed). | ★★★★★ VALIDATED |
| **Mechanism 1 (Coordination Overhead)** | Quantified precisely: RCC ranges 15%→100% depending on scale and complexity. | ★★★★★ VALIDATED |
| **Mechanism 11 (Temporal Erosion)** | Performance degrades with rounds/scale even with correct information exchange. | ★★★★ SUPPORTED |

### Novel Contribution to GUS

**The Communication-Reasoning Gap (CRG)** is a new mechanism not previously identified in our framework:

> **Proposed Mechanism 31: Communication-Reasoning Dissociation**
> In distributed LLM systems, agents can successfully coordinate information exchange (communication succeeds) while systematically failing to integrate that information into correct computation (reasoning fails). The gap between partial correctness (information quality) and success rate (computation quality) grows with both task complexity and agent count.

This is distinct from existing mechanisms:
- Not **Coordination Overhead** (Mech 1) — agents DO coordinate
- Not **Token Budget Fragmentation** (Mech 17) — they have the information
- Not **Cognitive Level Trapping** (Mech 12a) — they form correct topologies
- It's specifically the **reasoning-integration stage** that fails

### Formal Expression

CRG(N, L) = PCS(N, L) − SR(N, L) ≥ α · log(N) · L^β

Where L is communication complexity level, N is agent count, and the gap grows at least logarithmically with scale.

## 5. Connections to Prior Deep-Dives

### 5.1 Kim et al. "Science of Scaling" (#219)
Kim et al.'s capability saturation at ~45% baseline is independently confirmed — Silo-Bench shows similar ceilings. The "tool-coordination trade-off" (β=-0.267) maps directly to the CRG. Both papers find topology-dependent error amplification.

### 5.2 MADQA "Strategic vs. Stochastic Search" (#180/MADQA)
MADQA found agents use brute-force search not strategic reasoning. Silo-Bench goes further: even when agents form optimal topologies spontaneously, they can't execute the strategy. Topology discovery ≠ computation capability.

### 5.3 Price of Decentralization (PoD)
PoD established that communication cannot fully eliminate decentralization cost. Silo-Bench proves this empirically at scale: even with unlimited communication rounds, agents can't reach single-agent performance.

### 5.4 DAC Stability Theory
Silo-Bench's communication density collapse (D: 2.80→0.14) is the DAC stability condition 4ηβ²<γ manifesting empirically. As N increases, effective β (coupling) decreases, suggesting agents self-limit coordination to avoid instability — but this self-limiting ensures failure.

### 5.5 Markovian Generation Chains
The PCS-SR gap behavior across rounds is consistent with Markovian chain convergence theory: partial information accumulates (PCS rises) but correct synthesis requires phase-coherent convergence (SR requires unanimity), which becomes exponentially unlikely with more agents.

## 6. Critical Assessment

### Strengths
1. **Scale of study:** 1,620 experiments, 54 configurations — largest MAS coordination study to date
2. **Grounded in theory:** Communication complexity levels from Yao (1979) provide rigorous difficulty calibration
3. **Role-agnostic design:** Eliminates persona confounds that plague other benchmarks
4. **Four-dimensional metrics:** PCS-SR decomposition is a genuine methodological contribution
5. **Reproducible:** Fixed seeds, well-defined generators

### Limitations
1. **Algorithmic tasks only:** All 30 tasks have verifiable ground truth. Real-world MAS tasks (writing, design, research) are inherently more ambiguous. CRG magnitude may differ for subjective tasks.
2. **Same-model teams:** All N agents use the same LLM. Our Deep-Dive #220 showed mixed-vendor diversity is the highest-impact design choice — single-vendor Silo-Bench may be pessimistic.
3. **No iterative refinement:** Agents can't revise answers after seeing others' final submissions. Real systems often include verification/retry loops.
4. **Communication protocols are stylized:** P2P/BP/SFS don't capture the richness of real-world coordination (structured messages, typed payloads, etc.)

### What's Missing
- How does CRG change with **heterogeneous models** (mixed vendor teams)?
- Does **task decomposition guidance** (providing hints about optimal topology) close the gap?
- What's the **minimum model capability** needed for Level-III coordination?
- How does CRG interact with **memory/context window size**?

## 7. Actionable Takeaways

1. **Don't use MAS for distributed computation unless N<10 and task is Level I.** At N≥50, Level III coordination cost hits 100% — you're better off with a single agent.

2. **The CRG is the real bottleneck, not communication.** Investing in better communication protocols won't help if agents can't integrate information. Invest in reasoning-integration capabilities.

3. **Communication density is a diagnostic signal.** If D decreases as you add agents, your system is failing to coordinate. This is measurable in practice.

4. **Scale your communication complexity with your agent count.** Level I tasks (aggregation) remain viable at N=100. Level III (global shuffle) fails at N=10. Match task type to team size.

5. **For our system:** Our file-based coordination (SFS protocol essentially) suggests we're in the middle range for coordination overhead. But our tasks are mostly Level I (information aggregation/synthesis), which is the regime where MAS actually works.

## 8. New Research Leads

1. arXiv refs to check: The paper cites several MAS coordination frameworks we haven't covered
2. **Yao's communication complexity theory** (1979) — the foundational framework they ground task difficulty in; could provide formal bounds for GUS predictions
3. Comparison with **MapReduce paradigm** — the paper draws this analogy but doesn't formalize it

---

**Filed:** 2026-03-15
**Cross-references:** Deep-Dive #219 (Kim et al. Scaling), #180 (MADQA), PoD, DAC Stability, Markovian Chains, Cross-Ref #64 (Orchestration Verification)
**GUS Impact:** Validates Laws 1, 3, 13, 19, 21; Mechanism 1; proposes new Mechanism 31 (Communication-Reasoning Dissociation)
