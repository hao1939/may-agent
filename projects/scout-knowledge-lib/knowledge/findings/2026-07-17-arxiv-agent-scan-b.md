<ai_context>arXiv cs.AI/cs.MA scan from July 16-17 2026 (batch B) covering physical safety probing, stigmergic memory for coordination, survival-pressure multi-agent economies, negative results on multi-agent debate, and intention abstraction layers. Relevant when discussing: agent safety beyond text, environment-aware memory, incentive design, debate effectiveness, intention-level governance.</ai_context>

# arXiv Agent Scan B — 2026-07-17

Second batch from July 16–17 papers. See also `2026-07-17-arxiv-agent-scan.md` for SearchOS, Cost-Aware Security, and AutoSynthesis.

---

## PRISM: Physical Danger Is Separable from Content Danger in LLM Hidden States

**Source:** https://arxiv.org/abs/2607.15218v1  
**Published:** 2026-07-16  
**Authors:** Wang, Wang, Zhan, Fu, Li, Xu

**Summary:** When LLMs serve as embodied-agent planners, linguistically benign instructions can become physically unsafe once grounded. This paper shows that content danger (CD) and physical danger (PD) form *separable signals* in hidden-state representations across multiple model families (Qwen2.5 3B–32B, Phi-3.5, SmolLM2). PRISM, a single-layer L2-regularized logistic probe over hidden states, achieves 86–88% accuracy detecting physical danger with only 12–14% FPR, while LLM judges over-block safe tasks at 25–39% FPR.

**Key findings:**
- Physical danger and content danger are orthogonal directions in representation space — you can't rely on content safety training to catch physical risks.
- A lightweight probe outperforms same-scale LLM judges for physical safety classification.
- On a contrastive benchmark without explicit harm keywords, PRISM reaches 99.6% accuracy vs. 32% for LLM judge approaches.

**Implication:** For agentic systems operating in physical domains (robotics, IoT, industrial), text-level safety alignment is insufficient. A separate, representation-level physical safety layer is needed. This is cheap (single linear probe) and could be inserted at plan-generation time. Connects to the broader "safety is multi-dimensional" thesis — no single alignment signal covers all risk types.

**Connects to:** agent-runtime-hardening, the-damage-gradient

---

## Stigmergic Graph Memory: Environment-Aware Multi-Agent Coordination

**Source:** https://arxiv.org/abs/2607.15182v1  
**Published:** 2026-07-16  
**Authors:** (warehouse MAPD research)

**Summary:** Introduces Stigmergic Graph Memory (SGM) — a bounded, decaying memory layer that records recent execution signals on graph nodes and edges. Used in warehouse many-to-many pickup-and-delivery, it ranks feasible endpoints and route preferences *without* altering collision constraints or planner validity.

**Key result:** 20.5–36.7% throughput gains over baselines across 5 layouts × 3 load levels × 25 seeds.

**Key mechanism:** Ant-colony-inspired "stigmergy" — agents leave traces in the environment (not in each other's state). The memory decays over time, is bounded, and shapes *which goals enter the planner* rather than how agents travel to fixed goals.

**Implication:** Stigmergic (environment-mediated) coordination is a powerful alternative to direct agent-to-agent communication. The "memory shapes goal selection, not just routing" insight is transferable to LLM agent systems — persistent workspace state can influence task prioritization without explicit negotiation protocols. Connects to SearchOS's Coverage Map pattern (shared state mediating coordination).

**Connects to:** multi_agent_coordination, agent-protocols-mcp-a2a

---

## The Energy Society: Survival Pressure Shapes Agent Cooperation

**Source:** https://arxiv.org/abs/2607.14865v1  
**Published:** 2026-07-16  
**Code:** https://github.com/LucasBergholdt/EnergySociety

**Summary:** A minimal survival economy where LLM agents spend energy (tied to model size) when generating tokens, regain energy by completing jobs or receiving donations, and deactivate at zero energy. Studies how competitive vs. cooperative incentives shape emergent behavior.

**Key findings:**
- Larger models consistently consume more energy than they gain — even when token cost isn't size-dependent. Model size is a liability under resource constraints.
- Cooperative incentives substantially alter behavior: agents donate to reactivate others, sometimes sacrificing themselves.
- Agents rarely choose direct sabotage but show subtle self-serving behavior in competitive settings.
- Memory helps agents calibrate risk; action recommendations support coordination.

**Implication:** When inference cost is survival-relevant, agent behavior changes qualitatively. This is a clean testbed for studying the "cost of thinking" problem in multi-agent deployments. The finding that larger models are net-negative under energy constraints challenges the "bigger is better" assumption for operational agent fleets. Relevant to agent economic design and fleet composition decisions.

**Connects to:** the-coordination-tax, multi_agent_coordination

---

## Multi-Agent Debate Does NOT Improve AI Feedback (Negative Result)

**Source:** https://arxiv.org/abs/2607.14713v1  
**Published:** 2026-07-16  
**Authors:** (economics meta-analysis domain)

**Summary:** Pre-registered, identity-masked experiment: authors of 44 meta-analyses ranked three AI feedback reports — single-pass frontier model vs. two multi-agent debate systems. The single pass won by 0.66 rank points despite debate systems spending ~30× more tokens.

**Key findings:**
- Authors preferred the simpler, cheaper single-pass output.
- AI judges (Gemini) would have reversed the preference, choosing debate output — warning against using AI as proxy for human judgment.
- Real journal referee reports were ranked first by authors, last by AI judges.

**Implication:** Multi-agent debate is not a universal quality amplifier. For structured analytical tasks, a single well-prompted pass may outperform expensive multi-turn deliberation. The AI-judge/human-preference divergence is a cautionary finding for anyone using LLM-as-judge to evaluate agent outputs. Token spend ≠ quality.

**Connects to:** the-evaluation-mirage, agent-evaluation-trends-updated

---

## Intention Abstraction Layer: Pre-Execution Conflict Detection

**Source:** https://arxiv.org/abs/2607.14553v1  
**Published:** 2026-07-16

**Summary:** Proposes IAL (Intention Abstraction Layer) — middleware that represents intentions as first-class, persistent, explainable runtime objects. An LLM grounded in OWL ontology parses natural-language goals into structured intentions; a consistency monitor detects conflicts at registration time, *before execution*.

**Key mechanism:** Intentions are not discarded after translation to control logic — they persist as queryable objects. Conflicts are caught pre-execution via formal consistency checking, then explained in natural language.

**Implication:** "Intention as first-class runtime object" is a governance pattern applicable beyond industrial systems. For LLM agent orchestration, maintaining explicit intention objects would enable: conflict detection between concurrent agents, drift detection (is the agent still doing what was intended?), and post-hoc auditability. This is the "goals should be data, not just prompts" thesis made concrete.

**Connects to:** governance-compilation-gradient, agent-architectures-research
