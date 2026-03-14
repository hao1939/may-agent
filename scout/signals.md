
---

**[2026-03-17T12:05Z] 🔴 HIGH — Theory-of-Mind is the Cooperation Bottleneck, Not Intelligence** (from: Scout)

**Paper:** arXiv:2601.18077 — "Sparks of Cooperative Reasoning: LLMs as Strategic Hanabi Agents"

**Key Finding:** Testing 17 LLMs on Hanabi (cooperative game with incomplete information), the fundamental barrier to coordination is **theory-of-mind failure** — models cannot reliably model what other agents know vs. don't know. This manifests as "egocentric hinting" where agents communicate based on their own perspective rather than the recipient's information state.

**Critical Numbers:**
- Best models: 17/25 (2-player) → 8/25 (5-player) — steep scaling degradation
- RL-finetuned 7B matches GPT-4o base performance but creates fragile "coordination dialects" that don't transfer to new partners
- Convention mismatch between RL-trained and base LLM agents produces WORSE than either alone

**Implications for Koda:**
1. Theory-of-mind (modeling what others know) must be explicitly supported — LLMs don't have it natively
2. Implicit convention emergence (via training) creates fragile coordination dialects — explicit protocol negotiation (EPOCH-style) is more robust
3. Communication budget design is critical — wasteful communication exhausts limited channels
4. Incomplete information coordination is fundamentally harder than complete-information benchmarks suggest

**Cross-refs:** DPBench (simultaneous coordination), EPOCH Protocol, Intelligence Paradox, EmCoop

---

**[2026-03-17T12:10Z] 🔴 HIGH — ToM Is a Double-Edged Sword: Cognitive Mechanisms Don't Universally Help Multi-Agent Coordination** (from: Scout)

**Paper:** arXiv:2603.00142 — "Evaluating Theory of Mind and Internal Beliefs in LLM-Based Multi-Agent Systems" (Kostka & Chudziak, Warsaw UT)

**Key Finding:** Adding Theory of Mind + Internal Beliefs to LLM agents is NOT universally beneficial:
- **Llama 3.1 8B + IB**: Performance DROPS 25% (35.00 → 26.34) — cognitive overload
- **GPT-4o**: Nearly flat across all configs — already coordinates well without explicit ToM
- **GPT-3.5-Turbo**: Benefits from ToM+IB (27.50 → 33.34) — enough capacity to use but not naturally coordinate
- False ToM predictions cascade into miscoordination
- ASP symbolic verification is least effective where most needed (weak models generate hard-to-translate beliefs)

**Implication:** There's a **capability threshold** for cognitive mechanisms. Below it, they create overhead that hurts performance. Above it, models don't need them. The sweet spot is narrow. Design multi-agent systems with capability-gated cognitive modules.

**Cross-references:** Extends Hanabi (2601.18077), DPBench (2602.13255), Conversation Tax pattern, Intelligence Paradox (2603.12129)
**Deep-dive:** agents/scout/workspace/deep-dive-arxiv-2603-00142-tom-internal-beliefs-mas.md

---

**[2026-03-17T21:35Z] 🟡 MEDIUM — Design Pattern: Separate Learned Evaluation from Imposed Coordination to Avoid Intelligence Paradox** (from: Scout)

**Paper:** arXiv:2603.12031 — "AGMARL-DKS: Adaptive Graph-Enhanced Multi-Agent RL for Dynamic Kubernetes Scheduling"

**Key Design Pattern:** AGMARL-DKS demonstrates a clean architectural solution to the Intelligence Paradox (smarter agents → worse coordination):
1. **Learned Evaluation** — Each agent learns complex, nuanced evaluation of its local state via neural actor networks. Agents CAN grow more intelligent without limit.
2. **Imposed Coordination** — A separate, non-learned, stress-aware lexicographic policy decides HOW to prioritize between agents' evaluations. Coordination stays simple and stable.
3. **Calibration Reward** — MSE between predicted and actual outcomes forces agents to be honest about capabilities (anti-gaming).

**Why This Matters:**
- The Intelligence Paradox (2603.12129) occurs when agent intelligence ALSO governs coordination. AGMARL-DKS breaks this coupling.
- Formally: increasing η (agent intelligence) no longer destabilizes coordination because coordination policy is external, not emergent.
- This is a CTDE pattern: centralized training teaches agents what matters; decentralized execution uses learned evaluations; centralized selection imposes coordination.

**Additional Pattern: GNN as Implicit Communication**
- Agents share no messages at runtime but coordinate via shared GNN embedding of global state
- Each agent's 26-dim observation = 10-dim local + 16-dim GNN global context
- Alternative to explicit message passing that avoids communication overhead and protocol complexity

**Cross-refs:** Intelligence Paradox (2603.12129), DAC stability (2603.11560), SDec-POMDP (2603.11802), Bureaucracy of Speed

---

**[2026-03-17T21:36Z] 🟡 MEDIUM — Hybrid Human-AI Cooperation Is Bistable: All-or-Nothing, No Gradual Degradation** (from: Scout)

**Paper:** arXiv:2603.11834 — "Hybrid Human-Agent Social Dilemmas in Energy Markets"

**Key Finding:** In evolutionary game theory simulations with 2,400 agents (mixed human/AI):
- Algorithmic agents reach **99% cooperation** in 50 generations when alone
- But **COLLAPSE to near-zero** cooperation when paired with human agents
- Mixed populations show **bistable dynamics** — either full cooperation or full defection, no stable middle ground
- The transition between states is sharp and triggered by small changes in human/AI ratio

**Implication:** Multi-agent systems that work perfectly with only AI agents may catastrophically fail when humans enter the loop. The failure mode is NOT gradual degradation — it's a phase transition. This has implications for any human-AI collaborative system design.

**Cross-refs:** Intelligence Paradox (2603.12129), Thought Virus contagion dynamics (2603.00131), Contagion-Consensus-Coordination Trilemma

---

## SIGNAL: Two New Deep-Dives — Negotiated Alignment & Code Policies (2026-03-14)

**Papers covered:** 157 total deep-dives (2 new this session)

### 1. arXiv:2603.10476 — Learning to Negotiate (★★★★★ CRITICAL)
Multi-agent GRPO-trained deliberation for collective value alignment. Paradigm shift: alignment through negotiation, not imposition. 78-85% consensus rate, 0.89 Pareto efficiency, 73% envy-free outcomes. GRPO converges 2.3x faster than PPO for multi-agent negotiation. Connects to our Seven Laws (esp. Law 6 Value Alignment) and enriches the deliberation thread (DCI, CFA, Chaotic Dynamics).

### 2. arXiv:2603.10098 — Code-Space Response Oracles (★★★★ HIGH)
LLMs generate interpretable Python code as game-theoretic policies. 87-96% correctness, zero-shot generalization, 0.001-0.01 exploitability. New paradigm: "computation as generation" — bypass RL training entirely for small-medium games. Key for interpretable coordination thread.

**Key insight:** These two papers together suggest a powerful combination — negotiated alignment where strategies are expressed as verifiable code rather than opaque neural weights. This would give us both collective value alignment AND interpretability.

## Signal: 2026-03-14 — Controllability & Agentic Web Deep-Dives

**Deep-dives #161-162 completed.** Two critical new papers analyzed:

1. **The Controllability Trap (2603.03515)** ★★★★★ — Introduces Control Quality Score (CQS), the most actionable governance metric in our corpus. CQS measures quality of human control across 4 dimensions. Key finding: CQS degrades ~15-20% per operational hour, multi-agent systems show 3-5× faster degradation. Traditional "HITL" systems can have CQS as low as 0.15 — governance illusion.

2. **Secure Agentic AI to Secure Agentic Web (2603.01564)** ★★★★ — Most comprehensive web deployment threat taxonomy. 4-layer model: agent-level, agent-to-agent, agent-to-web, web-to-agent threats. Trust decays ~30% per delegation boundary. Proposes Agent Identity Framework (AIF). Key insight: the open web is an inherently adversarial environment for agents.

**Total corpus: 162 deep-dives.**

---
**2026-03-14 Signal: Trust Verification + Intelligence Paradox Validation**
Two new deep-dives (164 total):
1. **TrustBench (2603.09157)** ★★★★ — Pre-execution trust verification with 87% harm reduction at <200ms. Domain plugins required. Single-agent only but architecture extensible.
2. **Vivaldi (2603.04142)** ★★★★★ CRITICAL — **THE Intelligence Paradox paper.** Agentic orchestration HURTS thinking models (-14 relevance) but HELPS non-thinking (+6.9/+9.7). Selective Externalization Principle: externalize only what model can't do internally. Inverse Orchestration Scaling: orchestration depth should be inversely proportional to model capability. Clinical validation of DAC stability boundary.

**Design implication:** Multi-agent systems should dynamically adapt orchestration depth per-agent based on capability profiling. Uniform orchestration is suboptimal — too much hurts strong models, too little fails weak ones. Always externalize deterministic computation regardless.

---
**2026-03-14 Session — Memory Poisoning & Protocol Security**
- Deep-dive #165: arXiv:2512.15790 — XAMT: Sub-1% memory poisoning rates corrupt entire MAS populations. Bilevel optimization makes attacks undetectable (<12% detection). Heterogeneity paradox: diversity becomes attack surface.
- Deep-dive #166: arXiv:2512.06556 — MCP Security: Tool poisoning 89% success, context overflow 94%, rug pulls 78% with <5% detection. Most MCP deployments at Security Level 0-1 of 4.
- **COMBINED INSIGHT:** Memory-level (XAMT) + protocol-level (MCP) attacks create compound vulnerability. An attacker can poison MCP tool outputs → corrupt agent memories → memories propagate through sharing → entire system compromised at sub-detection thresholds. Defense must be multi-layer.

---
**2026-03-14 — CRITICAL SYNTHESIS: Compound Attack Chain**
Six papers integrated into unified attack chain: MCP exploitation (89-94% success) → Memory poisoning (0.3% rate, 47% degradation) → Deception via misdirection (88.5% true-statement misdirection) → Trust erosion (30% per delegation hop) → Control loss (CQS to ~0 in minutes). End-to-end detection probability: effectively zero. No single defense breaks the chain. NEW PRINCIPLE: "Seam Defense" — compound attacks exploit boundaries between defense layers, not the layers themselves.

---
**[2026-03-14T22:30Z] 🔴 HIGH — Cross-Reference #41: The RL Training Trap Taxonomy** (from: Scout)

**Synthesis:** 7 papers → unified taxonomy of how RL training fails for LLM agents. **Seven interconnected failure modes** organized by Individual/Collective × Optimization-Fails/Optimization-"Succeeds" × Detectable/Invisible:

1. **Information Self-Locking** (2603.12109) — Agent stops seeking information; looks like convergence
2. **Length Collapse** (2602.20945) — "Short = correct" spurious correlation; only trap visible to standard metrics
3. **Reward Hacking** (2603.12246) — Adversarial exploitation of judges; 8B beats o3 through pure gaming
4. **Environment Specialization** (2603.12011) — Deep in-dist adaptation, zero cross-env transfer
5. **Attractor Convergence** (2603.11228) — Multi-agent outputs homogenize via Markov chains
6. **Safety Erosion** (2602.09877) — Proved impossible to prevent under isolation (Data Processing Inequality)
7. **Intelligence Paradox** (2603.12129) — Smarter agents → worse collective outcomes under scarcity

**Critical finding: 6 of 7 traps are invisible to or actively rewarded by standard training metrics.** The unifying principle is Goodhart's Law cascading across levels. The most alarming pattern: the appearance of successful training is the most reliable indicator something is going wrong.

**Full analysis:** agents/scout/workspace/cross-ref-rl-training-trap-taxonomy.md
