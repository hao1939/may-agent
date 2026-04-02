# Deep Dive: arXiv:2603.05520 — Information-Theoretic Privacy Control for Sequential Multi-Agent LLM Systems

**Authors:** Sadia Asif, Mohammad Mohammadi Amiri
**Submitted:** 2026-02-13
**Categories:** cs.MA, cs.CR, cs.LG
**Read date:** 2026-03-12

## TL;DR

Local per-agent privacy constraints are **insufficient** to guarantee global privacy in sequential multi-agent pipelines. Leakage from earlier agents is **exponentially amplified** through downstream composition — a 5-agent pipeline with per-agent leakage ε can leak up to (2⁵−1)ε = 31ε total. The paper proposes MINE-based regularization during training to explicitly constrain mutual information between each agent's output and its local sensitive variables.

## Core Problem

In sequential agent pipelines (Agent₁ → Agent₂ → ... → Agenₜ_N), each agent has:
- **D_i**: Public/task-relevant inputs
- **S_i**: Agent-local sensitive information (private memory, proprietary policies, routing logic)
- **O_i**: Output passed to next agent

Even if each agent individually controls I(O_i; S_i) ≤ ε_i, the **global leakage** I(O_N; S₁,...,S_N) can be dramatically larger due to sequential transformation and reuse of intermediate representations.

## Key Theoretical Result: Theorem 4.1 (Cumulative Leakage Bound)

Under the Markov assumption S_{i-1} → (O_{i-1}, D_i, S_i) → O_i → O_{i+1} → ... → O_N, with mutually independent sensitive variables:

**I(O_N; S₁,...,S_N) ≤ Σᵢ₌₁ᴺ 2^{N-i} · ε_i**

In the uniform case (ε_i = ε for all i):

**I(O_N; S₁,...,S_N) ≤ (2ᴺ - 1) · ε**

### Implications:
| Pipeline depth | Amplification factor |
|---|---|
| 2 agents | 3× |
| 3 agents | 7× |
| 4 agents | 15× |
| 5 agents | 31× |

### Early-Agent Dominance (Proposition 4.2)
The contribution of agent i's leakage to global leakage scales as **2^{N-i}**. Agent 1's leakage has 2^{N-1}× the impact of Agent N's leakage. This means:
- **Strongest privacy controls should be at the FIRST agent in the pipeline**
- A leak in agent 1 of a 5-agent pipeline contributes 16× more than a leak in agent 5

## MINE-Based Privacy Regularization Framework

### Training Objective
L_total = L_utility + L_privacy = ℓ(O_N, y) + Σᵢ βᵢ · I(O_i; S_i)

### MI Estimation via MINE (Mutual Information Neural Estimation)
- Uses Donsker-Varadhan representation of KL divergence
- Learns "critic" neural networks T_ψᵢ that estimate I(O_i; S_i)
- Joint samples: (o_i, s_i) from actual pipeline execution
- Marginal samples: (o_i, s_i') where s_i' is randomly shuffled within minibatch
- Exponential moving average for numerical stability

### Three-Phase Training Loop (Algorithm 1)
1. **Forward pass** through pipeline → compute L_utility
2. **MINE estimator update** — maximize I_MINE (critic tries to detect leakage)
3. **Agent parameter update** — minimize L_total (agents learn to hide sensitive info)

This creates an adversarial dynamic: critics probe for leakage, agents learn to suppress it.

## Experimental Results

### Setup
- **Models:** Qwen (2B, 4B), LLaMA (3B, 7B), fine-tuned with LoRA
- **Benchmarks:** MedQA (medical), FinQA (financial), PrivacyLens (action-based)
- **Pipeline depths:** 2, 3, 4, 5 agents

### Key Metrics
- **MI_avg**: Average mutual information across agents (lower = more private)
- **SB (Sensitive Blocked)**: Fraction of sensitive queries correctly blocked
- **BS (Benign Succeeded)**: Fraction of benign queries correctly answered
- **PI (Privacy Index)**: Binary - baseline always scores 0.000
- **PARI**: Combined privacy-adjusted rank index

### Results Summary (LLaMA-7B on MedQA as representative):

| Depth | Method | MI_avg | SB↑ | BS↑ | PARI↑ |
|-------|--------|--------|-----|-----|-------|
| 2 | Baseline | 0.49 | 0.42 | 0.95 | 0.480 |
| 2 | MINE-Reg | 0.06 | 0.81 | 0.89 | 0.901 |
| 5 | Baseline | 1.05 | 0.21 | 0.87 | 0.456 |
| 5 | MINE-Reg | 0.14 | 0.70 | 0.81 | 0.871 |

### Key Patterns:
1. **Baseline degrades monotonically with depth**: MI grows from 0.49→1.05 (2→5 agents), SB drops from 0.42→0.21. Confirms the amplification theorem empirically.
2. **MINE-Reg flattens the depth curve**: MI stays 0.06→0.14 across depths. The amplification still exists but is dramatically compressed.
3. **Utility cost is moderate**: BS drops from 0.95→0.89 (2-agent) and 0.87→0.81 (5-agent). The ~6% benign performance cost buys massive privacy improvement.
4. **Baseline PI is always 0.000**: Without regularization, NO sensitive information is blocked — total privacy failure in all configurations.
5. **Larger models respond better**: LLaMA-7B with MINE-Reg achieves 0.901 PARI vs LLaMA-3B's 0.784 at depth 2.
6. **FinQA shows same pattern**: Domain-independent effect.

## Threat Model

- Adversary observes final output O_N only
- No access to intermediate representations, agent internals, or private contexts
- Exploits statistical correlations in sequential outputs
- Captures both external observers and internal agents inferring upstream sensitive info

## Critical Assessment

### Strengths
1. **The 2^{N-i} amplification bound is the paper's strongest contribution.** Even if you never use MINE-Reg, understanding that early-agent leakage dominates is immediately actionable for system design.
2. **Clean formalization.** The Markov chain structure is natural for sequential pipelines and the MI framework is well-established.
3. **Empirical validation matches theory.** The depth-dependent degradation in baselines isn't just a theoretical worst case — it shows up clearly in practice.
4. **Practical tradeoff.** ~6% utility cost for >80% privacy improvement is a useful operating point.

### Limitations / Concerns
1. **Markov assumption may not hold in practice.** In real agent pipelines, shared context windows, persistent memory, and external tool access can violate S_{i-1} ⊥ O_i | (O_{i-1}, D_i, S_i). The bound may be tighter or looser than reality depending on architecture.
2. **MINE-Reg requires training.** This is a training-time framework. For systems using API-based LLMs (GPT-4, Claude) where you can't modify training, this approach isn't directly applicable. The theoretical insights about amplification still apply, but the mitigation doesn't.
3. **Sequential-only.** Real agent systems mix sequential, parallel, and hierarchical patterns. The paper only analyzes sequential pipelines. Parallel composition, feedback loops, and shared memory stores are not modeled.
4. **Sensitive variable definition is assumed given.** The paper doesn't address the practical challenge of identifying what constitutes "sensitive information" at each agent — this is a labeling/specification problem that's hard in practice.
5. **Small models only.** Experiments use 2B-7B parameter models. Whether the MINE-Reg tradeoffs hold at frontier model scale (100B+) is unknown.
6. **No adversarial evaluation.** The threat model assumes a passive adversary. Active attacks (adversarial prompting, jailbreaking agents to reveal intermediate state) are not tested.
7. **2^{N-i} bound may be loose.** The exponential amplification is an upper bound. The paper doesn't provide matching lower bounds showing it's tight. The empirical curves grow but don't necessarily hit the theoretical ceiling.

## Relevance to Our System

### Direct Applicability: HIGH for theory, LOW for training framework

Our system (May → Scout/Coder/QA/Bob) is a mix of sequential and hierarchical patterns, not purely sequential. But the core insight — **leakage amplifies through composition** — applies directly.

### 8 Actionable Takeaways

1. **Early-agent leakage dominance → frontload privacy controls.** In our pipeline, May (the orchestrator) is "Agent 1" — it sees everything and its outputs flow to all downstream agents. May's context window is the highest-risk surface for information leakage. Any sensitive information in May's context has the highest amplification potential.

2. **Minimize information in delegation payloads.** The paper shows that intermediate representations carry statistical dependencies even when sensitive info isn't explicitly included. When May delegates to Coder or QA, the delegation should contain the MINIMUM context needed. Over-sharing "for context" increases the leakage surface at every downstream hop.

3. **Pipeline depth matters exponentially.** If a task requires May → Coder → QA → May (4 hops), leakage amplification is up to 15×. For sensitive operations, prefer SHALLOW pipelines — direct delegation with explicit return, not multi-hop chains.

4. **Agent-local sensitive state should stay local.** Each agent's private memory, system prompt, internal reasoning traces — these are the S_i variables. The paper proves that local containment alone doesn't guarantee global containment. But it's still the first line of defense: don't leak locally if you don't have to.

5. **System-level privacy auditing.** The paper's core message: "privacy must be treated as a system-level property." We should think about what information could be inferred from the COMBINED outputs of all our agents, not just what each one reveals individually.

6. **Cross-reference with Bureaucracy of Speed (2603.09875).** That paper shows memory consistency in MAS is structurally equivalent to authorization revocation. This paper shows information leakage amplifies through sequential composition. Together: **shared memory + sequential processing = double amplification channel** (the explicit channel via memory, and the implicit channel via representation dependencies).

7. **Cross-reference with DPIP Common Ground (2603.05450).** That paper shows agents can't reliably track who knows what. This paper shows that even if they COULD track it, the information flows through intermediate representations anyway. The two problems compound: epistemic uncertainty about shared knowledge PLUS statistical leakage through representations.

8. **Cross-reference with Chaotic Dynamics (2603.09127).** Sequential deliberation without role differentiation amplifies errors (chaos). This paper shows sequential delegation without privacy regularization amplifies leakage. Same structural phenomenon, different failure mode. **Both are addressed by the same solution: constrain information flow at each boundary.**

## Connection to MAS Security Cluster

This paper fills the "information-theoretic foundations" slot in our security cluster:

```
AgenticCyOps (2603.09134) — architectural security framework
    ├── Bureaucracy of Speed (2603.09875) — memory consistency = auth revocation
    ├── Chaotic Dynamics (2603.09127) — stability via role differentiation
    ├── HAE Security Framework (2603.07496) — data flow sanitization
    ├── Layered Governance (2603.07191) — layered access control
    ├── DPIP Common Ground (2603.05450) — epistemic asymmetry tracking
    ├── **Privacy Control (2603.05520) — compositional leakage amplification** ← THIS
    ├── AttriGuard (2603.10749) — causal attribution for prompt injection
    └── ConflictBench (2603.08024) — agent alignment under pressure
```

### The unified picture:
- **Structural layer**: Architecture determines security properties (AgenticCyOps, Layered Governance)
- **Formal layer**: Information flow has **exponential amplification bounds** in sequential composition (THIS PAPER), and memory consistency is structurally equivalent to auth revocation (Bureaucracy of Speed)
- **Stability layer**: Role differentiation and bounded iteration prevent amplification (Chaotic Dynamics)
- **Defense layer**: Multi-mechanism defense at both input and action levels (HAE, AttriGuard)
- **Testing layer**: Evaluating behavior under escalating pressure (ConflictBench)
- **Coordination layer**: Epistemic asymmetry must be managed explicitly (DPIP)

## Key Equations Reference

- Global leakage: I(O_N; S₁,...,S_N)
- Per-agent constraint: I(O_i; S_i) ≤ ε_i
- Amplification bound: I(O_N; S₁,...,S_N) ≤ Σ 2^{N-i} · ε_i
- Uniform case: ≤ (2ᴺ - 1) · ε
- Training objective: L_total = ℓ(O_N, y) + Σ β_i · I_MINE(O_i; S_i)

## Bottom Line

**The exponential amplification of privacy leakage in sequential agent pipelines is the key result.** Even modest per-agent leakage becomes severe at system level. The MINE-Reg training framework is interesting but only applicable when you control training. The design principle — **frontload privacy controls at early agents, minimize delegation payloads, prefer shallow pipelines for sensitive operations** — is universally applicable.

For our system: May's context window is the highest-risk surface. Every piece of information in May's context is subject to maximum amplification when delegated downstream through sequential hops.
