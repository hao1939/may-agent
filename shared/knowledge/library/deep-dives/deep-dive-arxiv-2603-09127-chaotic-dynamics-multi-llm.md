# Deep-Dive: arXiv:2603.09127 — Chaotic Dynamics in Multi-LLM Deliberation

**Paper:** "Chaotic Dynamics in Multi-LLM Deliberation"  
**Authors:** Hajime Shimao (Penn State), Warut Khern-am-nuai (McGill), Sung Joo Kim (American U.)  
**Published:** 10 Mar 2026 (cs.AI, cs.MA)  
**License:** CC BY 4.0  
**Format:** 6-page main text + 14-page supplementary  

## TL;DR

Five-agent LLM committees modeled as random dynamical systems exhibit **chaotic dynamics even at T=0** (temperature zero). Two independent routes to instability are identified: (1) assigning differentiated roles (Route A), and (2) mixing different model families (Route B). These routes interact **non-additively** — combining both is LESS unstable than Route B alone. The Chair role is the dominant amplification mechanism. Reducing memory window depth attenuates divergence. Introduces empirical Lyapunov exponent (λ̂) as a stability metric for multi-agent systems.

## Core Setup

- **5-agent committee**, 20 deliberation rounds per run
- Each agent outputs argument text + structured preference state: **s_t^(i) = (p_A, p_B, p_C, conf)** on a simplex
- Committee mean trajectory: **p̄_t^(r) = (1/N) Σ s_t^(i)** for replicate r
- Inter-replicate divergence: **D(t) = mean pairwise L2 distance** across R=20 replicates
- **Empirical Lyapunov exponent λ̂** = slope of log D(t) over rounds 3–20
  - λ̂ > 0 → exponential trajectory divergence (chaos)
  - λ̂ ≈ 0 → stable
- **12 policy scenarios** across 6 domains (immigration, health, income, climate, speech, AI governance)
- **Factorial design:** 2 (NoRoles vs Roles) × 2 (Uniform vs Mixed models)
- Uniform = GPT-4.1-mini; Mixed = GPT-4.1 (Chair), Claude Sonnet 4.6 (Welfare), Gemini 2.5 Flash (Rights), Grok-3-mini (Equity), GPT-4.1-mini (Security)

## Key Findings

### Finding 1: T=0 Does NOT Mean Deterministic
Even at temperature=0, ALL conditions show λ̂ > 0 (positive divergence). Practitioners who assume T=0 gives reproducible results are wrong. The protocol amplifies residual variation (floating-point, batching, internal model non-determinism) into macroscopic trajectory differences.

**HL-01 scenario at T=0:**
| Condition | λ̂ | Interpretation |
|-----------|-----|----------------|
| Uniform + NoRoles | 0.0221 | Baseline positive divergence |
| Uniform + Roles (Route A) | 0.0541 | Role differentiation amplifies |
| Mixed + NoRoles (Route B) | 0.0947 | Model heterogeneity amplifies |
| Mixed + Roles (A + B) | 0.0519 | Non-additive! Less than Route B alone |

### Finding 2: Two Independent Routes to Instability
- **Route A (Role Differentiation):** Assigning institutional roles (Chair, Welfare, Rights, Equity, Security) to identical models creates instability. Uniform+Roles λ̂=0.0541 vs Uniform+NoRoles λ̂=0.0221 (2.4× amplification).
- **Route B (Model Heterogeneity):** Mixing different model families without roles creates even more instability. Mixed+NoRoles λ̂=0.0947 (4.3× baseline amplification).

### Finding 3: Non-Additive Interaction
**The combined condition (Mixed+Roles) is LESS unstable than Mixed+NoRoles.** λ̂=0.0519 < 0.0947. This means roles actually *stabilize* heterogeneous committees — they channel divergent model tendencies into structured institutional positions rather than letting them scatter freely. This is a profound finding: increasing both diversity dimensions does NOT monotonically increase instability.

### Finding 4: Chair Role as Dominant Amplifier
Role ablation experiments show Chair ablation produces the **largest reduction in λ̂**. The synthesis/coordination role is the primary amplification channel. Other role ablations (Welfare, Rights, Equity, Security) have near-zero or negative effects. This is scenario-contingent: strongest in IM-01 and HL-01, directionally positive but inconclusive in CL-01, SP-03, AI-01.

**Mechanistic interpretation:** The Chair synthesizes positions, which creates a feedback loop — its synthesis shapes the next round's context, which shapes how other agents argue, which shapes the next synthesis. Small initial divergences get amplified through this feedback.

### Finding 5: Memory Window Controls Amplification
- k=15 (full memory) → baseline instability
- k=3 (reduced memory) → lower λ̂ in all 4 tested scenarios
- k=1 (near-memoryless) → further reduction in 2 tested scenarios

This confirms **feedback memory as the amplification pathway**. Shorter memory windows break the recursive amplification loop. But they don't eliminate divergence entirely — there's a floor of structural instability.

## Cross-References to Prior Archive

### 1. AceMAD / Martingale Curse (2603.06801)
**Strong connection.** AceMAD proved that standard Multi-Agent Debate with linear symmetric aggregation cannot outperform majority voting (Martingale Curse). This paper provides the *dynamical* explanation: standard MAD is chaotic, meaning repeated runs give different answers, undermining any expected-value advantage. AceMAD's solution (peer-prediction, exponential weights) can be understood as a **stability intervention** — it imposes asymmetric structure that constrains the chaotic dynamics into a submartingale (monotonically improving) regime.

**Synthesis:** AceMAD solves chaos by introducing asymmetric information flow (high-contributors influence low-contributors). This paper shows WHY that works: the symmetric case is chaotic (positive λ̂), and asymmetry (like roles) can either amplify or attenuate depending on design. AceMAD's peer-prediction is a specific role structure that happens to attenuate rather than amplify.

### 2. SelfOrg / Stochastic Self-Organization (2510.00685)
**Direct connection.** SelfOrg constructs response-conditioned DAGs where information flows from high-contributors to low-contributors. This paper's Route B finding (model heterogeneity creates instability) explains WHY SelfOrg's dynamic topology is necessary — fixed topology with heterogeneous agents is maximally chaotic (λ̂=0.0947). SelfOrg's contribution estimation adaptively restructures the topology each round, effectively performing continuous stabilization.

### 3. Boiling Frog Threshold (2603.08455)
**Complementary.** The Boiling Frog paper found that gradual drift is invisible below a critical threshold ε*. This paper shows that multi-LLM deliberation exhibits *chaotic* divergence, not gradual drift. The two failure modes are qualitatively different: Boiling Frog = slow, undetectable degradation; Chaotic Dynamics = rapid, detectable but unpredictable divergence. A complete stability audit must check for BOTH.

### 4. Moltbook Self-Evolution Trilemma (2602.09877)
**Theoretical alignment.** Moltbook proves safety constraints degrade under isolated self-evolution (DPI argument). This paper provides empirical evidence of a specific degradation mechanism: even at T=0, iterative multi-agent deliberation exhibits positive Lyapunov exponents, meaning the trajectory is fundamentally unpredictable. Self-evolving systems that use multi-agent deliberation for decisions inherit this chaotic instability.

### 5. DPIP Common Ground (2603.05450)
**Connection via memory mechanism.** DPIP showed that LLMs cannot reliably track "who knows what" in multi-agent settings. This paper reveals the memory window is the key amplification channel for chaos. Together: shared context/common ground is both unreliable (DPIP) and a chaos amplifier (this paper). Short memory windows help stability but hurt common ground construction — a fundamental tradeoff.

### 6. Adversarial Topology / Bug-Hunt
**Resolution of the adversarial paradox.** Our prior work found adversarial topology sometimes helps (Bug-Hunt) and sometimes hurts (rare disease diagnosis). This paper provides the explanation: role differentiation (adversarial = a role) is Route A instability. Whether that instability helps depends on whether the divergent trajectories explored by the chaotic dynamics contain better solutions than the stable-but-converged trajectory. For Bug-Hunt (finding bugs = exploration helps), chaos is useful. For rare disease diagnosis (convergence on correct answer = exploitation needed), chaos hurts.

### 7. JRH / Judge Reliability (2603.05399)
**Extends reliability concern.** JRH showed judge reliability is a property of (model × task × perturbation) triples. This paper shows committee reliability is also scenario-contingent — λ̂ varies across the 12 scenarios, and Chair ablation effects are scenario-dependent. No universal "stable committee" design exists.

### 8. Yerkes-Dodson Curve (2603.07360)
**Complementary stress-stability finding.** Yerkes-Dodson showed cooperation follows inverted-U under pressure. This paper shows stability varies non-monotonically with architectural complexity (roles + heterogeneity don't add up). Both demonstrate that multi-agent system properties are fundamentally non-linear.

## Actionable Implications for Our System

### 1. Our Pipeline Has Route A Instability
Our system assigns explicit roles (May, Coder, QA, Evaluator, Scout). This is Route A. Even with uniform model backends, role differentiation creates chaotic dynamics. We should expect that re-running the same task multiple times may produce different outcomes.

**Action:** Consider stability auditing — run critical delegations multiple times and check for trajectory consistency. If outcomes diverge, the task may benefit from a majority-vote or consensus mechanism.

### 2. May Is Our Chair
May is the synthesis/coordination agent. Per Finding 4, synthesis roles are the dominant amplification channel. May's decisions propagate through Coder→QA→Evaluator, amplifying any initial divergence.

**Action:** May's delegation decisions should be as deterministic as possible (explicit context, minimal ambiguity). Reducing the "synthesis surface" — how much May interprets vs. how much it passes through — could reduce system-level instability.

### 3. Memory Window Tradeoff
Shorter memory windows reduce chaos but also reduce context quality. Our agents currently operate with full conversation context (large k).

**Action:** For multi-round interactions (QA→Coder rework loops), consider whether full history is necessary or whether a summarized sliding window would suffice. The paper suggests k=3 provides substantial stability improvement.

### 4. λ̂ as a System Health Metric
The empirical Lyapunov exponent is a concrete, computable metric for system stability. We could compute it by running the same task N times and measuring trajectory divergence.

**Action:** Define a stability benchmark — run 10-20 identical delegations and compute λ̂. If λ̂ >> 0, investigate which agent/role is the amplification channel.

### 5. Non-Additivity Means Compositional Testing
You can't predict system behavior from testing components individually. Roles + heterogeneity interact non-additively. Our system combines multiple architectural choices (roles, tools, memory patterns, delegation structures) that may interact in unexpected ways.

**Action:** Test system configurations as complete compositions, not individual components.

### 6. Roles Can Stabilize Heterogeneous Systems
The surprising finding that Mixed+Roles < Mixed+NoRoles suggests that structured roles can actually REDUCE chaos in heterogeneous settings. If we ever move to mixed-model backends (different LLMs for different agents), assigning clear roles would be stability-enhancing, not stability-reducing.

## Assessment

**Quality:** ★★★★☆ — Clean experimental design, proper factorial structure, bootstrap CIs, appropriate scope claims. The Lyapunov framework is well-adapted from dynamical systems theory. Limitations honestly stated (doesn't link instability to decision quality).

**Novelty:** ★★★★★ — First paper to formally model multi-LLM deliberation as a random dynamical system and measure empirical Lyapunov exponents. The two-route decomposition and non-additivity finding are genuinely new.

**Relevance to us:** ★★★★★ — Directly characterizes the instability properties of our exact system type (multi-agent with differentiated roles). The Chair/synthesis amplification finding is particularly relevant given May's role. The memory-window intervention is immediately actionable.

**Reproducibility:** ★★★★☆ — Models are commercial APIs (GPT-4.1-mini, Claude Sonnet 4.6, etc.) so exact replication requires API access. But the framework (compute D(t), fit log-linear for λ̂) is trivially implementable for any multi-agent system.

**Overall rating:** ★★★★★ CRITICAL — This is a foundational result for multi-agent system engineering. It reframes "reliability" from a property of individual models to a **dynamical property of the system architecture**. Every multi-agent system should be λ̂-audited.
