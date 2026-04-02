# Deep Dive: SelfOrg — Stochastic Self-Organization in Multi-Agent Systems

**Paper:** arXiv:2510.00685v2 (ICLR 2026)
**Authors:** Nurbek Tastan, Samuel Horváth, Karthik Nandakumar (MBZUAI / Michigan State)
**Date read:** 2026-03-21
**Rating:** ★★★ Core — ICLR 2026, directly applicable to dynamic agent coordination

---

## Core Thesis

The "best" communication topology for multi-agent LLM systems is neither fixed per-task nor fixed per-query — it must be **conditioned on the actual responses agents produce at each time step**. Because LLMs are inherently stochastic, two runs of the same query can yield different response distributions, making any pre-determined topology brittle. SelfOrg constructs a directed acyclic graph (DAG) on-the-fly from agents' current outputs, using Shapley-value-inspired contribution scores, with **no external judge, no pretrained graph generator, and no edge-level RL**.

---

## Architecture (4-stage pipeline per round)

### Stage 1: Decentralized Initialization (t=0)
- N agents independently generate responses to user query Q
- No inter-agent communication in round 0
- Responses embedded via lightweight model (all-MiniLM-L6) — NOT the agent LLM itself
- Purpose: produce diverse initial response pool

### Stage 2: Contribution Estimation (Shapley approximation)
- **True Shapley** requires 2^N evaluations — intractable
- **Approximation:** ψ_n = cos(r_n, r_avg) where r_avg = mean of all response embeddings
- Reduces complexity from exponential to O(N)
- **Theorem 1:** Bounded approximation error with multiplicative factor L_n
- **Corollary 1 (Ranking Stability):** When contribution gap exceeds threshold 2IΓ²/L̲, approximate ranking preserves true Shapley ranking
- Intuition: contribution = alignment with collective response

### Stage 3: Communication Graph Formation (DAG)
1. Compute pairwise cosine similarities S_{n,m} between all response embeddings
2. Activate edge m→n if: (a) S_{n,m} ≥ τ (similarity threshold) AND (b) ψ_m > ψ_n (source has higher contribution)
3. Detect and break cycles: remove edge from weaker agent toward stronger agent within each cycle
4. Compute topological ordering (ties broken by contribution score)
5. Result: DAG where information flows from high-contributors to low-contributors

**Key insight:** The graph is NOT predetermined — it **emerges** from response content. High-quality responders become spontaneous "hub" leaders.

### Stage 4: Response Propagation and Aggregation
- Leader (root node) processes first, possibly self-reflecting on own previous response
- Subsequent agents in topological order receive upstream outputs in their prompts
- After propagation: re-estimate contributions, rebuild graph for next round
- **Final aggregation:** weighted centroid of embeddings; select existing response closest to centroid (no new generation)
- **Typical rounds:** T=2 sufficient (exploration → consolidation)

---

## Theoretical Foundations

### Correctness Amplification (Probabilistic)
1. **Agreement Concentration (Lemma 1):** P(two correct agree) = p² > P(two wrong agree) = Σp_k², when errors are sufficiently dispersed (empirically validated: correct answers cluster, wrong answers scatter)
2. **Contribution Dominance (Lemma 2):** Under clustering assumption (correct responses have mutual similarity α, cross-group similarity ≤ β, where α > β), correct agents always get higher ψ_n than incorrect agents
3. **Corollary 2:** If ≥2 agents are correct, correctness dominates contribution scores → communication graph routes info preferentially from correct agents

### Key Assumption (Assumption 1)
Correct response embeddings form a tight cluster (mutual cosine ≥ α), while incorrect responses are scattered (pairwise cosine ≤ β < α). Empirically validated on Qwen-1.5B over 100 runs on same math problem.

### Intervention Study
When an agent receives input from top-contributor, probability of solving task rises from 49% → 69% (+20pp absolute).

---

## Experimental Results

### Weak Backend (Qwen-2.5-1.5B-Instruct, N=5 agents)
| Method | AVG | AVG Rank |
|--------|-----|----------|
| Single | 41.24 | 2.57 |
| CoT | 41.18 | 2.71 |
| DyLAN | 37.82 | 4.00 |
| MacNet | 36.60 | 4.57 |
| G-Designer | 33.47 | 5.86 |
| AgentVerse | 36.37 | 4.86 |
| AutoGen | 18.93 | 6.06 |
| **SelfOrg** | **45.05** | **1.00** |

**SelfOrg is the ONLY method that consistently outperforms single-agent in the weak regime.** All other MAS methods (DyLAN, MacNet, G-Designer, AgentVerse, AutoGen) **degrade below single-agent performance** on weak backends. AutoGen collapses catastrophically (11.60 on MATH vs single 49.20).

### Strong Backend (LLaMA-3.3-70B-Instruct, N=5)
| Method | AVG | AVG Rank |
|--------|-----|----------|
| CoT | 68.46 | 2.50 |
| MacNet | 67.31 | 3.63 |
| **SelfOrg** | **70.19** | **1.25** |

SelfOrg still best but gains are smaller — strong models mask orchestration benefits.

### Strong Backend (Qwen-2.5-72B-Instruct)
SelfOrg achieves 68.95 AVG vs CoT 66.97, consistent but modest gains.

### Key Empirical Findings:
1. **Weak backends expose orchestration quality.** This is the most discriminating regime.
2. **Most MAS methods hurt weak models.** The overhead of coordination exceeds the benefit.
3. **SelfOrg is the only training-free method that consistently helps across all backends.**
4. **Two rounds are sufficient** — the first explores, the second consolidates.

---

## Cross-References with Prior Research

### × AceMAD (2603.06801) — Complementary Signal-Amplification Mechanisms
- AceMAD uses **peer prediction** (second-order beliefs) to break the Martingale Curse
- SelfOrg uses **Shapley-based contribution** (embedding alignment) for the same goal
- Both: truth-holders cluster, noise-makers scatter → amplify correct signal
- **Key difference:** AceMAD relies on agents' ability to predict peer beliefs (requires metacognition); SelfOrg uses only response embeddings (external measurement, no metacognition needed)
- **Synthesis:** SelfOrg is more lightweight but less informative. AceMAD captures *why* agents disagree; SelfOrg captures *that* they disagree. Combining both (Shapley for graph formation, peer prediction for weight assignment) could be powerful.

### × C3 Credit Assignment (2603.06859) — Credit Assignment at Different Granularities
- C3: counterfactual replay to isolate causal impact of individual *messages* within a collaboration
- SelfOrg: Shapley values to estimate agent *response-level* contributions
- C3 is finer-grained (message-level) but requires replay; SelfOrg is coarser (agent-level) but real-time
- **Synthesis:** SelfOrg's contribution scores could serve as a cheap proxy for C3's influence metric during live collaboration, with full C3 replay reserved for post-hoc analysis

### × Error Cascades / Spark-to-Fire (2603.04474) — DAG Structure as Cascade Protection
- Error cascade risk R = βρ(A)/δ depends on graph spectral radius ρ(A)
- SelfOrg's DAG construction **naturally limits spectral radius** because: (a) edges only flow from high-contributors to low-contributors (no feedback loops), (b) similarity threshold τ prunes weak connections, (c) cycle detection explicitly enforced
- **Synthesis:** SelfOrg's graph formation is an implicit defense against cascade amplification. The DAG guarantees no circular error reinforcement. Hub topology still a risk (high-contributor connected to all others = single point of failure if wrong), but Assumption 1 provides statistical protection: wrong agents rarely achieve hub status.

### × Rare Disease Diagnosis (2603.06856) — Why Adversarial Topologies Fail
- Adversarial topology degraded performance to 27.3% (vs 50% hierarchical)
- SelfOrg explains why: adversarial topologies force communication between disagreeing agents regardless of contribution quality → noise propagation
- SelfOrg's similarity threshold τ would prevent adversarial pairing when agents disagree for wrong reasons
- **Synthesis:** SelfOrg provides the theoretical basis for the empirical finding that topology must match response quality, not just task category

### × CoTJudger (2603.07078) — Efficiency Implications
- CoTJudger found 33-87% of CoT reasoning is redundant
- SelfOrg's "two rounds sufficient" finding is consistent: more rounds = more redundancy
- The contribution-weighted centroid selection avoids generating new (potentially redundant) text
- **Synthesis:** SelfOrg's aggregation (select existing best response vs. generate new one) is inherently more efficient than approaches requiring synthesis generation

### × SCAFFOLD-CEGIS (2603.08520) — Iterative Refinement Paradox
- SCAFFOLD shows 43.7% of iteration chains degrade security over 10 rounds
- SelfOrg limits rounds to T=2 and uses contribution-based selection rather than iterative refinement
- **Synthesis:** SelfOrg's "exploration then consolidation" pattern avoids the gradual degradation that plagues unbounded iterative refinement. The contribution threshold acts as a quality gate similar to SCAFFOLD's semantic anchoring.

### × Bug-Hunt (Adversarial Verification) — Contribution-Aware Adversarial Design
- Bug-Hunt: Hunter/Skeptic/Referee (fixed roles)
- SelfOrg: roles emerge dynamically from response quality
- **Synthesis:** A hybrid system could assign initial roles (Hunter/Skeptic) but use SelfOrg's contribution estimation to decide *whose criticism gets amplified* — an informed Skeptic (high ψ) gets more influence than an uninformed one

### × Boiling Frog (2603.08455) — Detection Threshold
- Boiling Frog: gradual drift below ε* is invisible
- SelfOrg's contribution scores could serve as drift detector: if the "leader" agent's contribution score gradually decreases across queries while maintaining graph hub status, this signals quality drift before task failure
- But: SelfOrg's contribution is relative (cosine to centroid), so uniform quality degradation across all agents would be invisible — matches Boiling Frog's "sinusoidal drift is completely undetectable" finding

### × Introspection (2603.05414) — External vs Internal Measurement
- Introspection paper: models detect anomalies but confabulate explanations
- SelfOrg sidesteps this entirely: contribution is measured *externally* via embeddings, not via agent self-report
- **Synthesis:** SelfOrg's external measurement approach is more trustworthy than self-reported confidence because it doesn't rely on the agent's introspective accuracy

---

## Applicability to Our System

### Direct Application: Dynamic Quality Routing
Our May→Coder→QA→Evaluator pipeline has a fixed topology. SelfOrg suggests we could:
1. **Have multiple candidate implementations** (from Coder or multiple Coders) embedded and scored
2. **Route the highest-ψ implementation** to QA, rather than always sending the first response
3. **Weight QA feedback** by contribution score — high-agreement QA feedback gets more influence

### Limitation for Our Use Case
SelfOrg assumes **homogeneous agents** solving the same problem. Our system has **heterogeneous roles** (orchestrator, coder, QA, evaluator). The contribution estimation via cosine-to-centroid doesn't directly apply when agents produce qualitatively different outputs (code vs review vs score).

**Adaptation needed:** Role-specific contribution estimation — compare Coder output to historical good outputs for the same task type, not to centroid of all agents' outputs.

### Actionable Takeaways

1. **Contribution-based leader selection:** When generating multiple candidate solutions, use embedding similarity to select the "leader" response rather than random or first-generated
2. **Two-round collaboration is sufficient:** Don't iterate QA→Coder loops beyond 2-3 rounds (diminishing returns, possible degradation per SCAFFOLD findings)
3. **External measurement > self-report:** Use embedding-based quality signals rather than asking agents to self-assess their confidence
4. **Weak backends need better orchestration, not more compute:** If using smaller/cheaper models, invest in orchestration quality (contribution estimation, graph formation) rather than just scaling model size
5. **Similarity threshold as noise gate:** Only propagate feedback between agents when their outputs are semantically related enough (above τ); dissimilar outputs shouldn't cross-pollinate
6. **Monitor contribution scores as health metric:** Declining average ψ across queries signals system degradation

---

## Limitations and Open Questions

1. **Homogeneity assumption:** All agents solve the same task. Heterogeneous multi-agent systems (our case) aren't addressed.
2. **Error correlation:** Lemma 1 assumes independent errors. LLMs using similar training data may have correlated failure modes, reducing the benefit of multi-agent.
3. **Assumption 1 fragility:** "Correct answers cluster" holds well for math/STEM with verifiable answers. For open-ended tasks (code design, writing), correct answers may be diverse while incorrect answers might cluster around common misconceptions.
4. **Free-form output:** The embedding-centroid approach selects among existing responses. For tasks requiring synthesis of partial contributions from multiple agents, this selection-only approach may miss the best composite answer.
5. **Scale:** Tested with N=5 agents, T≤3 rounds. Scalability to larger systems unclear.
6. **No code evaluation dimension:** All benchmarks are reasoning/QA. Code generation tasks (our primary use case) aren't tested.

---

## Bottom Line

SelfOrg is the strongest ICLR-grade validation of a principle we should internalize: **multi-agent topology should be dynamic and response-conditioned, not fixed by design.** The Shapley-based contribution estimation is surprisingly simple (cosine to centroid) yet theoretically grounded and empirically dominant across all tested regimes. Most critically, it's the only approach that helps weak backends — all other MAS methods actually hurt performance when individual agents are weak.

For our system, the biggest takeaway is the contribution estimation mechanism as a lightweight quality signal that doesn't require an additional judge LLM, and the finding that 2 rounds of collaboration are typically sufficient.
