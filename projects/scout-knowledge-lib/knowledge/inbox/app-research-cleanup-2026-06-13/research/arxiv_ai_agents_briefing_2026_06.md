# arXiv AI Agent Research Briefing — June 2026

> **Source**: arXiv API (`https://export.arxiv.org/api/query`), queried 2026-06-04  
> **Scope**: ~30 papers from late May–early June 2026, across five thematic queries  
> **Method**: Every Summary and Implication below is derived from the paper's actual arXiv abstract text, not inferred or speculated  

---

## Executive Summary

The AI-agent landscape on arXiv in early June 2026 reveals a field that has moved decisively beyond proof-of-concept demos into **engineering-grade concerns**: provable safety, execution provenance, swarm-scale training infrastructure, and domain-specific deployment in law, medicine, manufacturing, and photonics. Eight major themes emerge:

1. Trust & auditability are now first-class research problems, not afterthoughts  
2. Agentic RL is becoming its own sub-discipline with dedicated training frameworks  
3. Multi-agent coordination is being stress-tested with adversarial and deceptive scenarios  
4. Self-evolution (lifelong learning, skill acquisition) dominates the agent-learning space  
5. Benchmarks are shifting from end-to-end success rates to diagnostic, process-level evaluation  
6. Tool use is treated as a trainable capability, not a static plug-in  
7. Domain agents (legal, medical, industrial) are producing real deployment evidence  
8. Mechanistic interpretability is extending to agent-mode LLM behavior  

---

## Theme 1 — Trust, Provenance & Auditable Agents

### 1a. From Agent Traces to Trust: Evidence Tracing and Execution Provenance in LLM Agents
- **ID**: [2606.04990](https://arxiv.org/abs/2606.04990v1) — Wang et al.  
- **Summary**: A comprehensive survey providing a conceptual framework for evidence tracing and execution provenance in LLM agents. The paper introduces a taxonomy covering trace sources, evidence and execution units, provenance relations, tracing granularity and timing, representation forms, and trust functions. It reviews methodological directions including provenance representation, evidence attribution, tool-use provenance, runtime guardrails, provenance-bearing memory, trace-based observability, and failure diagnosis. The paper argues that evaluation should move from final-answer correctness toward process-level accountability.  
- **Implication**: This survey signals that the field recognizes final-answer accuracy is insufficient for production agents. The taxonomy — covering trace sources through trust functions — provides a shared vocabulary the community has been lacking. Agent builders should expect upcoming benchmarks to score provenance fidelity, not just task completion.

### 1b. Provably Auditable and Safe LLM Agents from Human-Authored Ontologies (Agentic Redux)
- **ID**: [2606.04903](https://arxiv.org/abs/2606.04903v1) — Sterling  
- **Summary**: Introduces Agentic Redux, an LLM agent architecture for problem domains requiring linear auditability. Uses typed lambda calculus to prove that executions are semantically guaranteed correct with all decisions recorded in an append-only ledger. Demonstrates two production-grade domains: healthcare billing compliance and security vulnerability disclosure. Also introduces "Ontology-First Agent Design" where a human expert ontologizes the domain with Basic Formal Ontology and an LLM derives roles for agents and humans-in-the-loop.  
- **Implication**: This is a rare paper offering *formal guarantees* for agent behavior via typed lambda calculus, not just empirical testing. The ontology-first design method — human expert encodes domain structure, LLM fills roles — could become a template for regulated industries where "the LLM decided" is not an acceptable audit trail.

### 1c. Security of OpenClaw Agents: Fundamentals, Attacks, and Countermeasures
- **ID**: [2605.25435](https://arxiv.org/abs/2605.25435v1) — Wang et al.  
- **Summary**: Surveys the security landscape of OpenClaw, a class of open-source agent frameworks operating as continuously running, skill-augmented systems with persistent memory, multi-channel interaction, and high autonomy. Categorizes threats into a layered framework: skill poisoning, cognitive manipulation, multi-agent cascading failures, and supply-chain vulnerabilities. Analyzes how vulnerabilities arise during agent reasoning, action execution, and external interaction.  
- **Implication**: The threat taxonomy is specific to always-on autonomous agents with persistent memory — a category that didn't meaningfully exist 18 months ago. The supply-chain vulnerability angle (poisoned skills, compromised memory stores) is especially important as agent "app stores" emerge.

---

## Theme 2 — Agent Architecture & Interaction Protocols

### 2a. Strabo: Declarative Specification and Implementation of Agentic Interaction Protocols
- **ID**: [2606.05043](https://arxiv.org/abs/2606.05043v1) — Christie, Chopra & Singh (AAMAS 2026 Workshop)  
- **Summary**: Models Google's Universal Commerce Protocol (UCP) for AI agent e-commerce interactions as a declarative Langshaw protocol and implements agents using Peach, a programming model for Langshaw. Demonstrates that Peach agents can interoperate with Google's UCP agents, establishing fidelity of the formal approach. Argues this enables incremental introduction of declarative protocols into conventional settings.  
- **Implication**: As major tech companies standardize agent-to-agent commerce protocols, the formal-methods community is stepping in to show these protocols can be made declarative and verifiable. The interoperability proof with Google's UCP is a bridge between academic EMAS ideas and industry practice.

### 2b. Self-Reflective APIs: Structure Beats Verbosity for AI Agent Recovery
- **ID**: [2606.05037](https://arxiv.org/abs/2606.05037v1) — Canedo & Chethan  
- **Summary**: Proposes self-reflective APIs that return machine-readable `recovery_feedback.suggestions[]` payloads on validation failure, enabling agents to repair and retry requests without external reasoning. On a leak-audited pilot (N=30 per cell, 3 LLMs, 10 adversarial tasks), structured suggestions lift task-completion by +36.7–40.0 pp over plain-English diagnoses on Anthropic models (Fisher's exact p ≤ 0.0022), with 1.8–2.2× better per-success token efficiency. The lift was not significant on gpt-4o-mini (p=0.435). Also ships `audit_prompt_leakage.py` as reusable CI infrastructure.  
- **Implication**: A clear, quantified result: structured recovery metadata outperforms natural-language error messages for agent self-repair, but the effect is model-dependent. API designers building for agentic consumers should invest in machine-readable error payloads, not just human-readable messages. The leakage-audit tool is a practical contribution for anyone benchmarking LLM agents.

---

## Theme 3 — Planning & Diagnostic Benchmarks

### 3a. Agent Planning Benchmark (APB)
- **ID**: [2606.04874](https://arxiv.org/abs/2606.04874v1) — Sun et al.  
- **Summary**: A planning-specific diagnostic benchmark with 4,209 multimodal cases across 22 domains and 5 settings: holistic planning, feedback-conditioned step-wise planning, and robustness under extraneous tools, broken tools, and unsolvable tasks. Tests 12 MLLMs and reveals systematic weaknesses in long-horizon planning, tool-noise robustness, calibrated refusal, and inference-time refinement. Validation on 200 ToolSandbox and 200 τ²-bench tasks shows APB-guided refinement consistently improves plan correctness and downstream execution.  
- **Implication**: The benchmark design explicitly separates planning failures from execution failures — a distinction most prior evaluations collapse. The "broken tools" and "unsolvable tasks" settings test a critical real-world capability: knowing when *not* to act. The validation showing APB-guided refinement improves downstream execution demonstrates the benchmark has practical, not just diagnostic, value.

### 3b. FALSIFYBENCH: Evaluating Inductive Reasoning in LLMs with Rule Discovery Games
- **ID**: [2606.04751](https://arxiv.org/abs/2606.04751v1) — Bertolazzi, Tentori & Bernardi  
- **Summary**: An evaluation framework for hypothesis-driven reasoning inspired by the Wason 2-4-6 task. Agents must discover hidden semantic properties by iteratively proposing examples and receiving feedback. Evaluation of 12 LLMs shows reasoning models are generally stronger scientific reasoners than instruction-tuned models, though no model approaches optimal performance. The primary success driver is capacity for negative testing: models that actively seek to falsify hypotheses consistently outperform those seeking confirmation.  
- **Implication**: Directly relevant to agents in scientific-discovery loops. The finding that falsification capacity — not confirmation bias — drives success echoes Popper and suggests agent training should explicitly reward disconfirming-evidence seeking.

### 3c. NovelAPIBench: Diagnosing Knowledge Gaps in LLM Tool Use
- **ID**: [2606.03657](https://arxiv.org/abs/2606.03657v1) — Liu et al.  
- **Summary**: A fully automated dynamic benchmark that discovers novel APIs (absent from pretraining data), extracts decomposed knowledge bundles, generates executable coding tasks, and assigns failures to six diagnostic categories. Across ~1.9K tasks, finds that usage examples are the strongest standalone knowledge signal; adding more context (especially source code) can hurt by increasing import-path errors. Fine-tuning mainly teaches models how to use provided knowledge bundles, and this ability transfers to held-out libraries.  
- **Implication**: The decomposition into six failure categories (signature errors, import-path errors, etc.) is far more actionable than pass/fail. The finding that more context can *hurt* is a practical warning against the "stuff the prompt" approach to tool documentation.

---

## Theme 4 — Self-Evolving & Lifelong Learning Agents

### 4a. LifeSkill: Skill-Enhanced Test-Time Co-Evolution for Online Lifelong Learning Agents
- **ID**: [2606.04815](https://arxiv.org/abs/2606.04815v1) — Mao et al.  
- **Summary**: A two-stage RL framework for online lifelong learning agents. Stage 1 (Verifier-Guided Skill Learning) rewards candidate skills by the average verifier success of skill-conditioned policy rollouts, encouraging skills that are *useful for solving tasks* rather than merely plausible in text. Stage 2 (Online Skill Internalization) transforms skill-conditioned trajectories into reward signals at test time, internalizing reasoning into parameters to avoid context bloat. Improves average performance by 7 absolute points on LifelongAgentBench.  
- **Implication**: The verifier-guided skill selection is elegant: it grounds "useful skill" in rollout outcomes rather than text similarity. The test-time internalization addresses a real problem — agents whose context windows fill up with accumulated experience during long deployments.

### 4b. Rethinking Continual Experience Internalization for Self-Evolving LLM Agents
- **ID**: [2606.04703](https://arxiv.org/abs/2606.04703v1) — Chen et al.  
- **Summary**: Discovers that under multi-iteration experience learning, existing methods suffer *progressive capability collapse* rather than compounding improvement. Examines three dimensions: (1) Principle-level experience is more durable than instance-level; (2) Step-wise injection outperforms global injection by aligning with intermediate decision states; (3) Off-policy context-distillation on teacher trajectories gives more stable training signals than on-policy. Together these yield a recipe for stable experience internalization.  
- **Implication**: The "capability collapse" finding is a cautionary red flag for anyone doing iterative agent self-improvement. The three-dimensional analysis (granularity × injection pattern × regime) provides a concrete decision matrix for practitioners.

### 4c. EvoDS: Self-Evolving Autonomous Data Science Agent
- **ID**: [2606.03841](https://arxiv.org/abs/2606.03841v1) — Yang et al. (KDD 2026)  
- **Summary**: Introduces Autonomous Skill Acquisition (ASA) enabling agents to synthesize, validate, and reuse executable skills, plus Adaptive Context Compression (ACC) treating context management as a learned control problem. Proves theoretically that the hierarchical design reduces tool-selection error and aligns with an information bottleneck principle. Outperforms state-of-the-art open-source data science agents by 28.9% across four benchmarks while eliminating out-of-token failures.  
- **Implication**: The theoretical grounding (information bottleneck for context compression, formal tool-selection error bounds) sets this apart from purely empirical work. Elimination of out-of-token failures is a practical deployment milestone.

### 4d. EvoTrainer: Co-Evolving LLM Policies and Training Harnesses
- **ID**: [2606.03108](https://arxiv.org/abs/2606.03108v1) — Chen et al.  
- **Summary**: An autonomous training framework that co-evolves LLM policies *and* training-side harnesses through empirical feedback: diagnosing rollout-level evidence, revising diagnostics, backtesting interventions, and accumulating reusable skills. Matches or exceeds human-engineered RL references on math reasoning, competitive programming, and repository-level SWE, with the largest gain on long-horizon agentic SWE.  
- **Implication**: This pushes automation one level up: not just training agents, but training the *training process itself*. The finding that evolved diagnostics prevent invalid high-scoring branches from being promoted addresses a real RL failure mode.

---

## Theme 5 — Agentic RL Training Infrastructure

### 5a. AgentJet: A Flexible Swarm Training Framework for Agentic RL
- **ID**: [2606.04484](https://arxiv.org/abs/2606.04484v1) — Fu et al.  
- **Summary**: A distributed swarm training framework with decoupled multi-node architecture: swarm servers host models and run optimization on GPUs; swarm clients execute arbitrary agents on arbitrary devices. Supports heterogeneous multi-model RL (training teams with multiple LLM brains), multi-task cocktail training, fault-tolerant execution, and live code iteration during training. Introduces context tracking with timeline merging achieving 1.5–10× training speedup. Also introduces an automated research system that autonomously conducts multi-day RL studies on large-scale clusters.  
- **Implication**: This is infrastructure-grade engineering for multi-agent RL, not a research prototype. The decoupled architecture (edit agents during training, survive environment crashes) addresses real operational pain. The automated multi-day RL research system is meta-agentic — agents researching how to train agents.

### 5b. TAO-RL: Tool-Aware Optimization with Entropy Guidance
- **ID**: [2606.03762](https://arxiv.org/abs/2606.03762v1) — Cao et al.  
- **Summary**: Proposes a framework coupling tool-aware trajectory filtering with entropy-guided exploration. At the data level, filters out trajectories where all tool calls fail or where all rollouts succeed/fail (degenerate advantage estimates). At the algorithmic level, introduces an entropy bonus at post-tool-call tokens to encourage diverse reasoning at critical decision points. Demonstrates superiority on 7 reasoning benchmarks across 3 model scales.  
- **Implication**: The insight that tool-integration destabilizes RL training via distribution shift is important and under-discussed. The data-level filtering (discard degenerate advantage estimates) and token-level entropy bonus (specifically at post-tool-call positions) are both immediately applicable.

### 5c. GARL: Game-Theoretic Reinforcement Learning for Multi-Agent Strategic Prioritisation
- **ID**: [2606.05002](https://arxiv.org/abs/2606.05002v1) — Ye et al.  
- **Summary**: Formalizes multi-agent strategic prioritization as a two-stage game: competing agents allocate resources over a shared candidate set, then an arbiter produces the final ranking. Game-theoretic utilities become role-specific reinforcement signals. Instantiated on legal issues-in-dispute ranking, GARL enables small open-source LLMs to become competitive with strong closed-source LLMs under the same candidate-ranking setting.  
- **Implication**: Principled game-theoretic reward shaping for multi-agent RL is a step beyond ad hoc reward design. The result that small open-source models can match frontier closed-source models under GARL suggests the interaction structure matters as much as raw model capability.

---

## Theme 6 — Multi-Agent Coordination & Communication

### 6a. SMAC-Talk: Natural Language Extension of StarCraft Multi-Agent Challenge
- **ID**: [2606.04202](https://arxiv.org/abs/2606.04202v1) — Sol & Najjaran  
- **Summary**: A natural language extension of SMAC for evaluating LLM agents in cooperative, partially observable, long-horizon multi-agent environments. Includes a communication channel used to construct evaluation scenarios, including settings with an *embedded deceptive communicator* that tries to disrupt allies through communication alone. Benchmarks using 4 Qwen3.5 models and studies how reasoning structure, memory, and model scale affect coordination.  
- **Implication**: The deceptive communicator setting is crucial: real-world multi-agent deployments must handle adversarial or compromised peers. Testing whether agents can detect and resist deception through language alone is an under-explored safety dimension.

### 6b. Multi²: Hierarchical Multi-Agent Decision-Making (ICML 2026)
- **ID**: [2606.03698](https://arxiv.org/abs/2606.03698v1) — Park & Kwon  
- **Summary**: Decomposes agent behavior into a high-level agent (System 1) for context-aware sub-goal generation via SFT, and a low-level agent (System 2) for atomic action execution through offline-to-online RL. This separation mitigates *objective drift* — where goals and plans drift over extended interactions. Releases three hierarchical benchmark datasets. Accepted at ICML 2026.  
- **Implication**: The System 1/2 naming is evocative but the contribution is concrete: separating goal generation from action execution with different training regimes (SFT vs RL) addresses the documented objective-drift problem. The released hierarchical datasets fill a genuine evaluation gap.

### 6c. SMADE-IE: Sparse Multi-Agent Framework for Zero-Shot Information Extraction
- **ID**: [2606.04691](https://arxiv.org/abs/2606.04691v1) — Huang et al.  
- **Summary**: Addresses cross-type conflicts and token overhead in multi-agent debate for IE. Uses an Adaptive Mode Selector to route inputs into lightweight Global vs. Type-Centric extraction modes. For conflicting predictions, introduces Evidence-Driven Debate using Toulmin-style argument structure with confidence aggregation through external evidence scoring and Bayesian updates. Outperforms baselines on 9 benchmarks while improving token efficiency through sparse agent selection and early-stopping debate.  
- **Implication**: The Toulmin-style argumentation structure for agent debate is a meaningful step beyond "let agents argue and vote." Bayesian confidence aggregation with external evidence scoring brings principled uncertainty handling to multi-agent consensus.

### 6d. HAZDIAL: Agentic Dialogue for Hazard Identification
- **ID**: [2606.03812](https://arxiv.org/abs/2606.03812v1) — Das et al.  
- **Summary**: Investigates whether structured agentic dialogue (multi-agent, multi-turn interactions) improves hazard identification in safety-critical domains over single-pass baselines. Compares adversarial debate vs. constructive discussion modalities and proposes algorithm-based agentic interaction optimization. Evaluates with both standard metrics and novel dialogue metrics.  
- **Implication**: Direct application of multi-agent debate to industrial safety — adversarial vs. constructive modalities as a design choice for safety-critical applications.

---

## Theme 7 — Domain-Specific Agent Deployments

### 7a. Parthenon Law: A Self-Evolving Legal-Agent Framework
- **ID**: [2606.04602](https://arxiv.org/abs/2606.04602v1) — Geng & Liu  
- **Summary**: Large-scale empirical study on Harvey LAB with 12,510 agent trajectories showing that per-criterion accuracy climbs with stronger models while strict matter completion stalls. Introduces Parthenon, factoring Model, Harness, Agent roles, legal Knowledge, deterministic Tools, and procedural Skills into auditable surfaces. Features an anti-leakage learning loop converting scored failures into task-agnostic edits to skills, tools, and knowledge without touching model weights.  
- **Implication**: The 12,510-trajectory empirical study at scale is rare in agent research. The finding that per-criterion accuracy improves but *end-to-end matter completion stalls* reveals a critical gap between component-level and system-level agent performance. The anti-leakage learning loop (improve without weight updates) is a pragmatic pattern for deployment.

### 7b. DMAIC-IAD: Industrial Anomaly Detection with Multi-Agent Planning
- **ID**: [2606.04599](https://arxiv.org/abs/2606.04599v1) — Yu et al.  
- **Summary**: A "Plan First, Judge Later" multi-agent system inspired by the DMAIC quality-management framework. Distills heterogeneous references into standardized operating procedures (SOPs) before strategy generation, then uses a pre-trained execution-free judge model to rank strategies without runtime trials. Improves detection performance by 37.76% over agentic baselines across four modalities.  
- **Implication**: Aligning agent architecture with established industrial methodology (DMAIC) is a shrewd adoption strategy — it maps to processes that quality engineers already understand and trust. The execution-free judge eliminates expensive trial-and-error, critical for manufacturing settings.

### 7c. Autonomous Agentic Design for Photonics
- **ID**: [2606.00915](https://arxiv.org/abs/2606.00915v1) — Kharel et al.  
- **Summary**: LLM agents given access to numerical simulation tools autonomously design photonic devices through propose-simulate-evaluate-iterate loops. Demonstrates on passive components (waveguide bends, splitters, crossings), active devices (silicon microring modulators), RF devices (traveling-wave electrodes), and chip layout. Combines all into a full silicon photonic modulator design incorporating layout, charge transport, optical mode, and RF electrode design.  
- **Implication**: A compelling demonstration that LLM agents can drive complex physical-design workflows when given simulator access and quantitative acceptance criteria. The full modulator integration (layout + physics) goes beyond toy demonstrations.

### 7d. MeDxAgent: Multi-Agent Consultation for Interactive Medical Diagnosis
- **ID**: [2606.03416](https://arxiv.org/abs/2606.03416v1) — Sanghvi et al.  
- **Summary**: Builds MeDxBench (4,421 cases, 20 specialties) and proposes MeDxAgent, a multi-agent system for interactive (not single-shot) diagnosis. Achieves 10.3% accuracy gain, closing 52.3% of the gap to a full-information oracle. Finds that specific design choices — collecting demographics first, summarized dialogue for diagnosis, feeding candidate diagnoses for targeted questioning — mirror physician reasoning and improve accuracy, but only in combination.  
- **Implication**: The interactive, multi-turn framing matches real clinical practice far better than single-shot QA. The finding that mirroring physician workflow patterns (demographics first, hypothesis-driven questioning) is only effective *in combination* suggests that piecemeal agent improvements may underperform.

### 7e. PersonaTree: Structured Lifecycle Memory for Person Understanding
- **ID**: [2606.04780](https://arxiv.org/abs/2606.04780v1) — Hou et al.  
- **Summary**: A three-level persona tree memory framework with explicit support paths from evidence to claims. Maintains the tree through conservative writing, confidence-guided consolidation, and query-conditioned path retrieval returning only the evidence depth required by each query. Ranks first in 12 of 18 compact scores across six person-understanding and persistent memory benchmarks.  
- **Implication**: Memory architecture for persistent agents is an increasingly important sub-problem. The hierarchical evidence→pattern→claim structure with query-conditioned depth retrieval is more principled than flat memory stores.

---

## Theme 8 — Mechanistic Understanding of Agent Behavior

### 8a. Do Agents Think Deeper? Layer-Wise Dynamics in Sequential Planning
- **ID**: [2605.27935](https://arxiv.org/abs/2605.27935v1) — Cui & Luo  
- **Summary**: Systematic layer-wise analysis of complete agent trajectories across Deep Research, Code Generation, and Tabular Processing. Using residual stream probes, causal layer-skipping, and effective-depth measurements, shows that agentic reasoning exhibits a distinct depth profile: models progressively recruit more and deeper layers as trajectories unfold, with stronger long-range inter-layer dependencies in later turns. Residual updates become increasingly correction-dominant (recalibration rather than feature accumulation). Reveals a "construction-refinement gap": semantic direction forms early while deep layers stabilize final outputs.  
- **Implication**: This is the first mechanistic study specifically examining how LLMs allocate their depth budget in agent mode vs. static tasks. The finding that later turns require more depth has direct implications for efficiency: early turns could potentially run on shallower models or with early-exit mechanisms.

### 8b. Auditing Asset-Specific Preferences in Financial LLMs
- **ID**: [2606.02528](https://arxiv.org/abs/2606.02528v1) — Wu  
- **Summary**: A three-level audit protocol for financial LLM agents. Behavioral audit of 8 frontier LLMs shows Bitcoin's ranking is frame-dependent. Opens model internals via sparse-autoencoder features in Gemma 3 to find a dominant Bitcoin-selective feature. Amplifying it raises Bitcoin's portfolio share by 5.2 pp; suppressing lowers it by 4.6 pp, even when "Bitcoin" never appears in the prompt. Characterizes this as "bounded behavioral leverage."  
- **Implication**: As LLMs become financial agents, identifying and auditing internal features that influence asset allocation — even without explicit mention — is a regulatory necessity. The "know-your-agent" (KYA) framing parallels KYC regulations and may foreshadow regulatory requirements.

---

## Cross-Cutting Patterns & Strategic Observations

### Pattern A: The Auditability Imperative
Three independent papers (Agentic Redux, Agent Traces survey, OpenClaw Security) converge on the same thesis: agent outputs need provenance, not just correctness. The field is moving toward process-level accountability with append-only ledgers, trace schemas, and layered threat models.

### Pattern B: RL for Agents is Becoming Infrastructure
AgentJet (swarm training), EvoTrainer (co-evolving harnesses), TAO-RL (tool-aware optimization), and GARL (game-theoretic rewards) collectively show that agentic RL is developing its own training stack, distinct from standard RLHF. Key challenges: tool-induced distribution shift, degenerate advantage estimates, and multi-model heterogeneous training.

### Pattern C: Self-Evolution Requires Anti-Collapse Safeguards
LifeSkill, Experience Internalization, and EvoDS all address the same underlying problem: naive iterative self-improvement *degrades* rather than improves agents. Solutions converge on principle-level (not instance-level) experience, step-wise injection, and off-policy distillation.

### Pattern D: Benchmarks Are Getting Diagnostic
APB separates planning from execution failures. FALSIFYBENCH isolates falsification capacity. NovelAPIBench decomposes tool-use failures into six categories. The community is rejecting single-number success rates in favor of fine-grained failure taxonomies.

### Pattern E: Domain Deployment Reveals System-Level Gaps
Parthenon's 12,510-trajectory study shows per-criterion accuracy improving while end-to-end completion stalls. MeDxAgent shows design choices help only in combination. Both findings warn that component-level improvements don't automatically compose into system-level success.

---

## Papers At a Glance — Quick Reference Table

| Paper | ID | Core Contribution | Date |
|---|---|---|---|
| Agent Traces → Trust | 2606.04990 | Provenance taxonomy & survey | Jun 3 |
| Agentic Redux | 2606.04903 | Formally verified agent architecture | Jun 3 |
| OpenClaw Security | 2605.25435 | Threat model for persistent agents | May 25 |
| Strabo | 2606.05043 | Declarative agent protocols + UCP interop | Jun 3 |
| Self-Reflective APIs | 2606.05037 | Structured error recovery (+36.7 pp) | Jun 3 |
| APB | 2606.04874 | Planning-specific diagnostic benchmark (4,209 cases) | Jun 3 |
| FALSIFYBENCH | 2606.04751 | Inductive reasoning / falsification eval | Jun 3 |
| NovelAPIBench | 2606.03657 | 6-category tool-use failure diagnosis | Jun 2 |
| LifeSkill | 2606.04815 | Test-time skill co-evolution (+7 pts) | Jun 3 |
| Experience Internalization | 2606.04703 | Anti-collapse recipe for self-improvement | Jun 3 |
| EvoDS | 2606.03841 | Self-evolving data science agent (+28.9%, KDD'26) | Jun 2 |
| EvoTrainer | 2606.03108 | Co-evolving policies & training harnesses | Jun 2 |
| AgentJet | 2606.04484 | Swarm RL training framework (1.5–10× speedup) | Jun 3 |
| TAO-RL | 2606.03762 | Tool-aware RL with entropy guidance | Jun 2 |
| GARL | 2606.05002 | Game-theoretic multi-agent RL | Jun 3 |
| SMAC-Talk | 2606.04202 | Multi-agent coordination + deception benchmark | Jun 2 |
| Multi² | 2606.03698 | Hierarchical multi-agent decision-making (ICML'26) | Jun 2 |
| SMADE-IE | 2606.04691 | Sparse multi-agent + Toulmin debate for IE | Jun 3 |
| HAZDIAL | 2606.03812 | Multi-agent dialogue for hazard identification | Jun 2 |
| Parthenon Law | 2606.04602 | Legal agent framework (12,510 trajectories) | Jun 3 |
| DMAIC-IAD | 2606.04599 | Industrial anomaly detection (+37.76%) | Jun 3 |
| Photonics Design | 2606.00915 | Autonomous photonic device design | May 30 |
| MeDxAgent | 2606.03416 | Interactive multi-agent medical diagnosis | Jun 2 |
| PersonaTree | 2606.04780 | Hierarchical persona memory | Jun 3 |
| Agents Think Deeper | 2605.27935 | Mechanistic depth analysis in agent mode | May 27 |
| Financial LLM Audit | 2606.02528 | Internal feature audit for financial agents | Jun 1 |
| Skill0.5 | 2605.28424 | Joint skill internalization + utilization | May 27 |
| Data Engineering | 2605.30407 | Autonomous agentic data curation (+57.29%) | May 28 |
| Ptah | 2605.29861 | Multi-agent verifiable deep research | May 28 |
| Semantic Metadata | 2605.28787 | Semantic vs. unstructured agent data retrieval | May 27 |
