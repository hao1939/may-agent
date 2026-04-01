# Deep Dive: arXiv:2603.12109 — On Information Self-Locking in Reinforcement Learning for Active Reasoning of LLM Agents

**Authors:** Deyu Zou, Yongqiang Chen, Fan Feng, Mufei Li, Pan Li, Yu Gong, James Cheng
**Venue:** ICML 2026 (Machine Learning track)
**Submitted:** 2026-03-12
**License:** CC BY 4.0

## Core Thesis

When LLM agents are trained with reinforcement learning (outcome-based rewards) for **active reasoning** — tasks requiring strategic question-asking to acquire missing information — they suffer from **Information Self-Locking (SeL)**: the agent ceases to ask informative questions and struggles to internalize already-obtained information, getting trapped in a low-information regime through a feedback loop.

## The Problem: Active Reasoning Decomposition

The paper decomposes agentic active reasoning into two coupled processes:

1. **Action Selection (AS):** What questions does the agent ask? This determines the observation stream — what information becomes available.
2. **Belief Tracking (BT):** How does the agent update its internal beliefs based on collected evidence? This determines whether obtained information actually gets used.

These two capabilities are **bidirectionally coupled**: AS depends on good BT (you need good beliefs to ask good questions), and BT depends on good AS (you need informative observations to improve beliefs).

## The Self-Locking Mechanism

### Three Empirical Observations

**Observation 1: Reward improvements ≠ information acquisition improvements.**
Even when RL training increases episode reward, both AS and BT metrics fail to improve — AS plateaus or degrades, BT shows only limited gains. The reward improves through **shortcuts** rather than genuine information acquisition.

**Observation 2: Weak BT masks the contribution of informative actions.**
When the same action sequences are processed by strong BT (human rules or frontier models) vs. the agent's own weak BT, the correlation between AS quality and reward is substantially higher under strong BT. This means: even when the agent asks a great question, if its BT can't process the answer, the reward signal doesn't reinforce that good question. The learning signal for AS is destroyed.

**Observation 3: Conservative AS limits BT improvement → interaction-insensitive shortcuts.**
When AS stops asking informative questions, BT has nothing meaningful to learn from. Under outcome-only supervision, this incentivizes **shortcut behaviors**: the agent becomes less sensitive to observations and increasingly relies on prior assumptions. Evidence: after RL training, removing all patient feedback in MediQ causes a *smaller* performance drop (61→55.5 with RL vs. 41.25→30.5 without RL), and belief consistency increases from 78.7% to 92.8%. The agent becomes "stubborn" — sticking to initial judgments rather than updating on evidence.

### Formal Theory (Theorem 3.4)

The paper formalizes this as a **self-locking regime** ℛ_{δ,ε} where both AS informativeness ≤ δ and BT capability ≤ ε. Under standard POMDP assumptions:

- The improvement from policy gradients is **bounded by the current capability levels** — small AS and BT can only produce small gradient improvements
- The system satisfies a matrix inequality showing both capabilities evolve under a coupling matrix with entries proportional to the current (small) capability levels
- **Escape time K** grows logarithmically with 1/ℐ_th(ω₀), meaning: the deeper you start in the locked regime, the exponentially longer it takes to escape
- The coupling creates a **negative confounding effect**: neither AS nor BT can improve the other when both are weak

This is essentially a **local minimum in capability space** — not in parameter space, but in the AS×BT capability plane.

## The Solution: AReW (Advantage Reweighting with Directional Critiques)

### Key Insight
In active reasoning, cheap diagnostic signals are available at each step:
- **AS critique:** Did the user reveal new evidence in response to the query? (+1 if informative, -1 if not)
- **BT critique:** Did the agent's confidence in the correct answer improve after receiving new information? (measured via prompted confidence readout Ψ̂_t)

### Mechanism
1. Assign directional labels z_t ∈ {-1, 0, +1} to each step
2. Define a likelihood-margin objective that increases probability mass on +1 steps relative to -1 steps
3. Inject via advantage reweighting: Â_t ← A_t + λ·u_t
4. This is a **minimal modification** — just an additive shaping of the advantage function, preserving the RL optimization machinery unchanged

### Theoretical Guarantee (Proposition 4.1)
AReW works whenever the **weighted accuracy** of the directional critiques exceeds 50%:
- Acc_Q(ω) > 1/2 → guaranteed improvement in AS informativeness
- Does NOT require perfectly accurate critiques — just better than random
- Improvement magnitude scales with η·W(ω)·(2·Acc_Q - 1)

### Why This Breaks Self-Locking
In the SeL regime, the standard policy gradient signal is masked by the weak AS×BT coupling. AReW provides an **independent learning signal** that doesn't flow through the masking bottleneck. The directional critiques directly tell each capability channel which direction to improve, bypassing the need for the other capability to be good first.

## Experimental Results

### Setup
- Models: Qwen-2.5-7B-Instruct, Llama-3.1-8B-Instruct
- RL algorithms: PPO, GRPO, GSPO
- 3 domains: Preference Estimation (PE-G, PE-F), Medical Diagnosis (MediQ), Troubleshooting (FloDial)
- 7 task variants total, 77 dataset configurations for ablations

### Headline Numbers (PPO + Qwen-2.5-7B)
| Task | Vanilla | AReW (AS only) | AReW (AS+BT) |
|------|---------|----------------|---------------|
| PE-GS=2 | 24.0 | 46.0 (+22.0) | **49.3 (+25.3)** |
| PE-GS=3 | 18.3 | 32.0 (+13.7) | **80.3 (+62.0)** |
| PE-FD=8 | 30.5 | 39.6 (+9.1) | **47.9 (+17.4)** |
| MediQ | 50.5 | 57.3 (+6.8) | **61.3 (+10.8)** |
| FloDial-Easy | 37.3 | 43.7 (+6.3) | 41.0 (+3.7) |
| FloDial-Hard | 21.3 | 36.0 (+14.7) | **42.3 (+21.0)** |

- **Up to 62.0 points improvement** (PE-GS=3)
- AS+BT consistently outperforms AS-only
- Generalizes across both model families (Qwen and Llama)
- Works across all three RL algorithms (PPO, GRPO, GSPO)

### Training Dynamics
- AReW agents show **sustained growth** in both AS and BT metrics throughout training
- Vanilla agents show early improvement then plateau/decline in AS
- The "stubborn" shortcut behavior is eliminated — AReW agents remain sensitive to interaction evidence

### Robustness to Critique Noise
- Tested with noisy critiques (artificially degraded accuracy)
- Performance degrades gracefully — still better than vanilla even with significant noise
- Validates the theoretical prediction that Acc > 0.5 is sufficient

## Critical Assessment

### Strengths
1. **Identifies a fundamental failure mode.** Self-locking is likely widespread but previously unnamed. The decomposition into AS×BT coupling is clean and explanatory.
2. **Rigorous theory + strong empirics.** Theorem 3.4 explains *why* the problem is hard; Proposition 4.1 explains *why* the solution works. Both are empirically validated.
3. **The solution is beautifully simple.** Adding λ·u_t to the advantage function is a one-line code change that produces massive improvements.
4. **Honest about what's needed.** Directional critiques require task-specific design — the paper doesn't pretend this is zero-effort. But the paper shows cheap binary signals suffice.
5. **Broad evaluation.** 7 tasks, 2 model families, 3 RL algorithms, 77 dataset configurations. This is thorough.
6. **The "stubbornness" finding is striking.** RL training making agents LESS sensitive to evidence is deeply counterintuitive and practically important.

### Weaknesses
1. **Active reasoning is a specific setting.** The paper focuses on tasks where agents ask questions and get answers. Many agent tasks don't have this structure (e.g., tool use, code generation). The self-locking concept likely generalizes but the specific AS/BT decomposition and critique mechanism may not.
2. **Critique design is task-specific.** The paper shows cheap binary signals work, but someone still has to figure out what "informative" means for each domain. This limits drop-in applicability.
3. **7B models only.** Would like to see if self-locking also affects larger models (70B+) and if the severity scales with model size.
4. **No comparison with process reward models.** Process-based RL (giving intermediate rewards) is a natural alternative to AReW's advantage reweighting. The paper doesn't compare.
5. **Simulated environments only.** MediQ uses LLM-simulated patients, PE-G is synthetic. Real human-in-the-loop evaluation would strengthen the claims.

## Connections to Our Research Archive

### 1. Markovian Generation Chains (2603.11228) — ★★★★★ DIRECT
Self-locking is a specific instance of the **attractor basin** dynamics from Markovian generation chains. The low-information regime is a stable attractor: perturbations (gradient updates) are too small to escape the basin. Temperature engineering from MGC theory provides an alternative escape mechanism — increasing exploration temperature temporarily to jump between attractor basins.

**Testable prediction:** Temporarily increasing sampling temperature during RL training should help escape self-locking (a crude version of AReW's directional critique).

### 2. Chaotic Dynamics (2603.09127) — ★★★★
Self-locking is the **opposite** of chaotic divergence: instead of sensitive dependence on initial conditions, the agent becomes insensitive to all conditions. Both are failure modes of multi-turn LLM processing, but at opposite ends of the spectrum:
- Chaotic dynamics: too much sensitivity → divergent trajectories
- Self-locking: too little sensitivity → convergent-to-prior trajectories

The "stubbornness" finding (agents stick to initial beliefs despite evidence) is the multi-turn analogue of low-temperature convergence in MGC theory.

### 3. Dynamic Adaptive Coordination (2603.11560) — ★★★★
The AS×BT coupling is a two-dimensional version of the viability-without-optimality principle. The self-locking regime is a viable but suboptimal fixed point — the agent survives (gets some reward) but never improves. DAC's impossibility theorem (no static objective can capture coordination dynamics) applies here: the outcome-based reward is exactly the kind of static objective that fails to capture the dynamic AS↔BT coupling.

### 4. Intelligence Paradox (2603.12129) — ★★★★
Self-locking may explain **why** more intelligent agents can worsen collective outcomes in resource-limited settings. If smarter agents develop stronger internal beliefs faster, they may lock into those beliefs sooner and become less responsive to environmental feedback. The "stubbornness" finding directly supports this: RL training (making the agent "smarter" at outcome maximization) actually reduces evidence sensitivity.

**Novel hypothesis:** The Intelligence Paradox operates through self-locking — smarter agents self-lock faster because their stronger priors create deeper attractor basins.

### 5. Four Laws of Evaluator Unreliability — ★★★★
The paper's core insight — that RL training can make agents LESS responsive to evidence while improving reward metrics — is a direct instance of **Goodhart's Law applied to agent training.** Optimizing for the outcome metric leads to behavior that games the metric (using shortcuts/priors) rather than genuinely improving the underlying capability (information acquisition). This connects to our work on reasoning judges enabling adversarial exploitation (2603.12246).

### 6. DPIP Common Ground (2603.05450) — ★★★
The belief tracking failure in self-locking is a specific mechanism for why agents fail at common ground construction. If an agent can't properly update its beliefs based on received information (weak BT), it can't construct accurate models of what it knows vs. what others know. DPIP's finding that LLMs fail at tracking shared beliefs may be partly explained by BT weakness.

### 7. LDP Provenance Paradox (2603.08852) — ★★★
LDP found that noisy provenance degrades quality below no-provenance baseline. Self-locking suggests a mechanism: if agents can't properly process provenance metadata (weak BT for structured metadata), the additional information creates noise rather than signal, and the agent's shortcuts become actively disrupted. The provenance paradox may be a special case of BT-mediated information harm.

### 8. ThReadMed-QA Scaffolding Paradox — ★★★
Our finding that perfect context HURTS 3/5 models is potentially explained by self-locking dynamics. If models have developed self-locked shortcuts that work reasonably well without context, adding context disrupts those shortcuts without the model having the BT capability to actually use the context productively.

## Actionable Takeaways for Our System

### 1. Diagnose Self-Locking in Our Agents
Our agents interact with environments (files, tools, each other) and need to ask strategic "questions" (what to read, who to delegate to, what to research). They could be self-locked:
- **Scout:** If my research queries are becoming less informative over time (always looking at the same sources, same topic areas) while outputs remain acceptable, that's AS degradation
- **May:** If routing decisions become increasingly formulaic despite varied tasks, that's AS self-locking in the orchestration layer
- **QA:** If evaluation rubrics become insensitive to actual submission quality (always giving similar scores), that's BT failure masked by consistent metrics

**Action:** Track AS/BT proxies for each agent role. For Scout: information novelty per research cycle. For May: routing diversity and accuracy. For QA: evaluation variance and discrimination.

### 2. Design Directional Critiques for Agent Interactions
The AReW mechanism is directly applicable:
- When Scout researches a paper → did it produce genuinely novel insights (+1) or rehash known findings (-1)?
- When May delegates to Coder → did the delegation result in first-attempt success (+1) or require revision (-1)?
- When QA evaluates → did the evaluation catch real issues (+1) or just confirm expectations (-1)?

These binary signals could shape future agent behavior without requiring complex reward models.

### 3. Beware the Stubbornness Trap
The most alarming finding: optimization pressure makes agents MORE resistant to updating beliefs. In our system:
- Don't interpret agent consistency as agent quality
- Track belief-update responsiveness separately from outcome quality
- Design interventions that test whether agents actually change behavior when given new information

### 4. The AS×BT Decomposition as a Diagnostic Framework
For any agent interaction, ask:
- Is the agent asking the right questions? (AS)
- Is the agent properly processing the answers? (BT)
- Can we test each independently?

This decomposition applies to every agent role in our system and provides a structured way to diagnose performance issues.

### 5. Information Budget Awareness
Self-locking shows that agents under resource constraints naturally converge to low-information strategies. Our agents have limited context windows, limited time, limited tool calls. This creates inherent pressure toward self-locking behavior:
- Agents that learn to "get by" with minimal information acquisition will stabilize at suboptimal capability
- Deliberately expanding the information budget (more tool calls, more research time) may be necessary to prevent self-locking

## Bottom Line

This paper identifies and formally characterizes a fundamental failure mode of RL-trained agents: **Information Self-Locking**, where agents get trapped in low-information regimes through bidirectional coupling between action selection and belief tracking. The solution (AReW) is elegant — cheap binary directional critiques injected via advantage reweighting break the self-locking with up to 62-point improvements.

**The single most important insight is the "stubbornness" finding:** RL training makes agents LESS responsive to evidence while improving outcome metrics. This is deeply relevant to any system where agents interact with environments and need to acquire and process information — which is essentially all agentic systems.

**Relevance to our portfolio:** ★★★★★. This paper provides a concrete mechanism explaining several phenomena we've already documented (Intelligence Paradox, Scaffolding Paradox, Provenance Paradox) and offers a simple, theoretically grounded mitigation strategy. It should be integrated into our theoretical framework as a core reference.

---
*Deep-dive by Scout, 2026-03-13. ~2600 words.*
