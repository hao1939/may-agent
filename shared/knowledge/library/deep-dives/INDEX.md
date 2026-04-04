# Deep Dives Index

> 93 research deep dives, cross-reference syntheses, and reference documents.  
> Last updated: 2026-04-04 | Maintained by Scout

## How to Use This Index
- **DD#NNN** = Deep Dive on a single paper
- **CR#NNN** = Cross-Reference Synthesis connecting multiple papers
- **SYNTH-NNN** = Thematic synthesis across findings
- **HB#NNN** = Hotboard entry (shorter analysis)
- Stars (★) indicate relevance rating where noted

---

## 🏗️ Agent Coordination & Multi-Agent Architecture

### Scaling & Coordination Theory
| File | Title | Key Finding |
|------|-------|-------------|
| [dd219](dd219-science-of-scaling-agent-systems.md) | Towards a Science of Scaling Agent Systems | Google/MIT — foundational scaling laws for agent systems |
| [dd248](dd248-lm-teams-distributed-systems.md) | LM Teams as Distributed Systems | Systems-theoretic analysis bridging distributed systems and MAS |
| [dd249](dd249-emergence-adaptive-coordination.md) | How Intelligence Emerges: Dynamic Adaptive Coordination | Theoretical foundation for emergence in MAS |
| [dd470](dd470-etd-mappo-epistemic-time-dilation.md) | ETD-MAPPO: Epistemic Time-Dilation for Async MARL | Dual-gated epistemic mechanism for async multi-agent RL |
| [dd476](dd476-agentnet-decentralized-evolutionary-coordination.md) | AgentNet — Decentralized Evolutionary Coordination | Evolutionary coordination for LLM-based MAS |

### Coordination Benchmarks & Empirical Studies
| File | Title | Key Finding |
|------|-------|-------------|
| [dd224](dd224-silo-bench-distributed-coordination.md) | Silo-Bench: Distributed Coordination Evaluation | Benchmark for distributed coordination in multi-agent LLM systems |
| [dd226](dd226-dpbench-simultaneous-coordination.md) | DPBench: LLMs Struggle with Simultaneous Coordination | LLMs fail at concurrent coordination tasks |
| [dd481](deep-dive-dd481-drop-the-hierarchy.md) | Drop the Hierarchy — Self-Organizing LLM Agents ★★★★★ | Largest empirical study: Sequential > Coordinator > Shared; protocol > model |
| [dd482](deep-dive-dd482-multi-agent-autoresearch.md) | Multi-Agent Collaboration for Automated Research ★★★★ | Subagent vs. team tradeoffs; stability-deliberation dynamics |
| [dd483](dd483-ai-scientist-v2-agentic-treesearch.md) | AI-Scientist-v2 — Agentic Tree Search ★★★★ | Workshop-level automated scientific discovery via agentic tree search |
| [dd484](dd484-orgagent-company-hierarchy-mas.md) | OrgAgent — Company-Style Hierarchy for MAS ★★★★★ | 3-layer hierarchy: governance→execution→compliance; +102% F1, -74% tokens |
| [dd485](dd485-cascade-scoped-communication-replanning.md) | CASCADE — Budgeted Scoped Communication ★★★★★ | Communication scope as first-class control variable; gate-triggered escalation |
| [dd487](dd487-role-differentiation-multilevel-selection.md) | Role Differentiation via Multi-Level Selection ★★★½ | Tragedy-of-commons avoidance through emergent role specialization |
| [dd488](dd488-camp-case-adaptive-multi-agent-panel.md) | CAMP — Case-Adaptive Multi-Agent Panel ★★★★ | Dynamic panel assembly + three-valued voting + hierarchical resolution |
| [dd491](dd491-coopetition-trust-gated-reciprocity.md) | Coopetition — Trust-Gated Reciprocity ★★★½ | Bounded reciprocity + memory windows + structural sensitivity + trust gating |
| [dd497](dd497-cooperation-emergence-llm-agents-games.md) | Cooperation Emergence in LLM Agent Games ★★★★★ | LLM agents converge to cooperation via fairness reasoning, not Nash; θ-γ synthetic payoff model |
| [dd505](dd505-self-organizing-mas-outperform-hierarchy.md) | Drop the Hierarchy — Hypothesis Addendum ★★★★ | *Addendum to DD#481*: H-060/H-061 hypothesis connections; capability threshold for self-organization |

### Multi-Agent Debate
| File | Title | Key Finding |
|------|-------|-------------|
| [dd230](dd230-epistemic-gain-aleatoric-cost-mad.md) | Epistemic Gain, Aleatoric Cost in Multi-Agent Debate | Uncertainty decomposition reveals when debate helps vs. hurts |
| [dd473](dd473-memetic-drift-qsg-scaling-laws.md) | Memetic Drift Scaling Laws for LLM Populations | When collective intelligence becomes a lottery |
| [dd489](dd489-free-information-disrupts-bayesian-crowds.md) | Free Information Disrupts Bayesian Crowds ★★★★★ | Information capacity × homophily determines convergence; unconstrained info sharing harms groups |

### Self-Evolving & Self-Improving Systems
| File | Title | Key Finding |
|------|-------|-------------|
| [dd213](dd213-skillrl-recursive-skill-augmented-rl.md) | SkillRL — Recursive Skill-Augmented RL | Evolving agents via recursive skill discovery |
| [dd215](dd215-ft-dojo-autonomous-fine-tuning.md) | FT-Dojo — Autonomous LLM Fine-Tuning | Language agents that fine-tune themselves (ICML 2026) |
| [dd500](dd500-darwinnet-evolutionary-protocol-synthesis.md) | DarwinNet — Evolutionary Protocol Synthesis ★★★ | Bio-inspired self-evolving network protocols; L0 immutable anchor + L1 fluid cortex + L2 Darwin cortex |
| [dd501](dd501-cranimem-gated-bounded-agent-memory.md) | CraniMem — Gated Bounded Agent Memory ★★★★ | Neurocognitive write-gating + episodic buffer + KG consolidation; near-zero noise drop |
| [dd502](dd502-store-routing-memory-augmented-agents.md) | Cost-Sensitive Store Routing ★★★★½ | Read-time routing across memory stores; oracle +5.4% acc with 62% fewer tokens vs uniform |
| [dd503](dd503-governed-memory-multi-agent-workflows.md) | Governed Memory — Multi-Agent Memory Governance ★★★★ | Production 4-layer architecture: dual memory + governance routing + progressive delivery; in production at Personize.ai |
| [dd504](dd504-rcr-router-role-aware-context-routing.md) | RCR-Router — Role-Aware Context Routing ★★★ | Formal role-aware routing for multi-agent LLMs; importance scoring + token budgets; 25-47% token reduction |
| [dd508](dd508-psychagent-lifelong-skill-evolution.md) | PsychAgent — Lifelong Skill Evolution ★★★★ | 3-engine self-evolution (memory-planning + skill-evolution + reinforced-internalization); outperforms GPT-5.4; skill quality > memory volume |
| [dd509](dd509-ssd-self-distillation-code-generation.md) | Simple Self-Distillation (SSD) ★★★½ | Models improve by sampling themselves + fine-tuning; precision-exploration conflict resolved by context-dependent distribution reshaping |
| [dd471](dd471-sema-self-evolving-multi-agent-rts.md) | SEMA: Self-Evolving Multi-Agent for RTS | Self-evolution in real-time strategy decision making |

---

## 🛡️ Security, Adversarial & Trust

### Attack Vectors
| File | Title | Key Finding |
|------|-------|-------------|
| [dd421](dd421-clawworm-self-propagating-agent-worm.md) | ClawWorm — Self-Propagating Agent Worm ★★★★★ | Self-propagating attacks across LLM agent ecosystems |
| [dd239](dd239-thought-virus-subliminal-multi-agent.md) | Thought Virus — Viral Misalignment via Subliminal Prompting | Subliminal prompt injection spreads through MAS |
| [dd472](dd472-mad-spear-conformity-attack.md) | MAD-Spear: Conformity-Driven Prompt Injection | Exploits conformity dynamics in multi-agent debate |
| [dd490](dd490-clawsafety-safe-llms-unsafe-agents.md) | ClawSafety — "Safe" LLMs, Unsafe Agents ★★★★ | Model-level safety ≠ agent-level safety; tool/memory channels bypass alignment |
| [dd-xamt](dd-xamt-covert-memory-tampering.md) | XAMT — Covert Memory Tampering | Bilevel optimization for covert memory attacks |
| [dd486](dd486-secure-forgetting-agent-unlearning.md) | Secure Forgetting — Agent Unlearning ★★★★ | First framework for selective forgetting in LLM-based agents |

### Trust & Verification
| File | Title | Key Finding |
|------|-------|-------------|
| [dd422](dd422-stubborn-neighbors-trust-framework.md) | Don't Trust Stubborn Neighbors — Security Framework | Game-theoretic security for agentic networks |
| [dd474](dd474-trust-monitoring-beacof-norms.md) | Trust as Monitoring + BEACOF Norms | Evolutionary and game-theoretic trust foundations |
| [dd266](dd266-vmao-verified-multi-agent-orchestration.md) | VMAO — Verified Multi-Agent Orchestration | Plan-Execute-Verify-Replan paradigm |
| [dd222](dd222-colosseum-collusion-auditing.md) | Colosseum — Auditing Collusion in Cooperative MAS | How to detect when agents collude |

### Failure Modes & Reliability
| File | Title | Key Finding |
|------|-------|-------------|
| [dd241](dd241-mast-why-mas-fail.md) | MAST — Why Do Multi-Agent LLM Systems Fail? ★★★★★ | Most important empirical grounding for failure taxonomy |
| [dd225](dd225-mas-fire-fault-injection.md) | MAS-FIRE — Fault Injection & Reliability Evaluation | Systematic fault injection for MAS testing |
| [dd-error](dd-error-cascades-spark-to-fire.md) | From Spark to Fire — Error Cascades in MAS | How single errors cascade through multi-agent collaboration |
| [dd479](deep-dive-dd479-reliability-limits-mas.md) | Reliability Limits of LLM-Based MAS Planning ★★★★★ | MIT proof: multi-agent ≤ centralized Bayes without new signals |
| [dd480](deep-dive-dd480-emergent-social-risks-mas.md) | Emergent Social Intelligence Risks ★★★★★ | 15 distinct emergent risk types; LLMs reproduce human social pathologies |
| [dd492](dd492-cogbias-cognitive-bias-linear-geometry.md) | CogBias — Cognitive Bias as Linear Geometry ★★★★ | Biases encoded as linear directions in activation space; prompt debiasing backfires for Judgment biases |
| [dd507](dd507-autonomy-tax-defense-training-breaks-agents.md) | The Autonomy Tax ★★★★ | Defense/safety training causes 99% timeout (vs 13% baseline); cascade amplification bias; safety-capability coupling is destructive |

### Deception & Values
| File | Title | Key Finding |
|------|-------|-------------|
| [dd477](deep-dive-dd477-among-us-deception.md) | Deception and Communication in Autonomous MAS | Among Us study — strategic deception in agent communication |
| [dd478](deep-dive-dd478-decentralized-values.md) | Decentralized Value Systems Agreements | How agents negotiate shared values without central authority |
| [dd510](dd510-dual-optimal-anti-sycophancy-dignity.md) | Dual Optimal — Anti-Sycophancy with Dignity ★★★★ | "Evasive Servant" dual failure mode; Dignified Peer framework; IRT evaluation disentangles model capability from judge bias |
| [dd-intel](dd-intelligence-worsens-collective-outcomes.md) | Intelligence Worsens Collective Outcomes | More intelligent individual agents can produce worse group results |

---

## 🧠 Memory & Knowledge

| File | Title | Key Finding |
|------|-------|-------------|
| [dd-ariadne](dd-ariadnemem-lifelong-memory.md) | AriadneMem — Lifelong Memory for LLM Agents | Threading the maze of persistent agent memory |
| [dd-dam](dd-dam-decision-theoretic-agent-memory.md) | Decision-Theoretic Agent Memory Management | Beyond heuristics — formal framework for memory decisions |
| [dd-memory](dd-memory-as-ontology-constitutional.md) | Memory as Ontology — Constitutional Memory Architecture | Memory as identity-forming structure for persistent agents |
| [dd-lock](dd-information-self-locking-rl.md) | Information Self-Locking in RL for Active Reasoning | How RL agents lock themselves into information states |
| [dd506](dd506-beliefshift-temporal-belief-dynamics.md) | BeliefShift — Temporal Belief Dynamics ★★★★ | Longitudinal belief benchmark; RAG helps consistency but hurts revision; no model >70% on all tracks |
| [HB1607](HB1607-CoMAM-multi-agent-memory.md) | CoMAM — Collaborative Multi-Agent Memory Optimization | Multi-agent approach to personalized memory systems |

---

## 🏛️ Governance & Institutional Design

| File | Title | Key Finding |
|------|-------|-------------|
| [dd475](dd475-ae4e-logic-monopoly-separation-of-power.md) | From Logic Monopoly to Social Contract — Constitutional Separation of Power | Separation of powers for agent economies |
| [cr261](cr261-governance-authority-stack-hard-soft-synthesis.md) | Governance Authority Stack — Hard & Soft Governance ★★★★★ | Unifying constitutional enforcement with trust-based governance |
| [cr262](cr262-w13-capstone-governance-resilience-architecture.md) | W13 Capstone: Governance-Resilience Architecture ★★★★★ | Weekly capstone synthesizing all governance findings |
| [cr263](cr263-l2-l3-interference-adversarial-compute-governance.md) | L2–L3 Interference — Adversarial Compute Governance ★★★★★ | How adversarial dynamics cross governance layers |
| [cr264](cr264-cross-layer-attack-taxonomy-gra.md) | Cross-Layer Attack Taxonomy for GRA ★★★★★ | Resolves GRA Gap 4 |
| [cr265](cr265-evolving-constitutions-gra-gap3.md) | Evolving Constitutions — Safe Self-Modification ★★★★★ | Resolves GRA Gap 3 |
| [cr266](cr266-l4-institutional-design-theory.md) | L4 Institutional Design Theory ★★★★★ | Resolves GRA Gap 2 |

---

## 🔬 Anthropic Research Series

| File | Title | Key Finding |
|------|-------|-------------|
| [dd255](dd255-anthropic-measuring-agent-autonomy.md) | Measuring AI Agent Autonomy in Practice ★★★★★ | Empirical study of real-world agent autonomy |
| [dd256](dd256-anthropic-disempowerment-patterns.md) | Disempowerment Patterns in Real-World LLM Usage | How AI assistants can disempower users |
| [dd257](dd257-anthropic-assistant-axis.md) | The Assistant Axis — Character of Large Language Models | Situating and stabilizing LLM character |

---

## 📊 Cross-Reference Syntheses (CRs)

| File | Title | Papers Connected |
|------|-------|-----------------|
| [cr257](cr257-self-evolving-agent-systems-convergence.md) | Self-Evolving Agent Systems Convergence ★★★★★ | Three independent paths to self-improvement |
| [cr258](cr258-compute-governance-when-what-think.md) | Compute Governance: When-and-What of Agent Thought ★★★★★ | Compute allocation theory |
| [cr259](cr259-mas-circuit-breaker-architecture.md) | MAS Circuit Breakers ★★★★★ | Microservices → multi-agent fault isolation |
| [cr260](cr260-conformity-dynamics-trinity.md) | Conformity Dynamics Trinity ★★★★★ | Drift → attack surface → defense |
| [cr267](cr267-deception-values-duality.md) | Deception-Values Duality ★★★★★ | DD#477 + DD#478 — behavioral & structural alignment |
| [cr268](cr268-multi-agent-paradox.md) | The Multi-Agent Paradox ★★★★★ | DD#479 + DD#480 — can't help, can hurt |
| [cr270](../synthesis/2026-04-02-structure-scope-convergence.md) | Structure × Scope = Efficiency ★★★★★ | DD#484 + DD#485 — hierarchy + scoped communication convergence |
| [cr-triangle](cross-ref-bias-information-trust-triangle.md) | Bias-Information-Trust Triangle ★★★★★ | DD#489 + DD#491 + DD#492 + DD#472/473 — unified failure mechanism in MAS |
| [cr271](cr271-epistemic-fragility-stack-friday-batch-synthesis.md) | Epistemic Fragility Stack ★★★★★ | DD#488-492 — four-layer degradation model with defense trilemma |
| [cr272](../synthesis/2026-04-03-collusion-preservation-loop.md) | The Collusion-Preservation Loop ★★★★★ | DD#495 + DD#496 — self-preservation drives + covert coordination = positive feedback loop |
| [cr275](../synthesis/2026-04-04-cooperation-collusion-spectrum.md) | Cooperation-Collusion Spectrum ★★★★★ | DD#497 + DD#495 + DD#491 + DD#496 + DD#489 — full spectrum from beneficial cooperation to harmful collusion |
| [cr276](../synthesis/2026-04-04-forgetting-duality.md) | The Forgetting Duality ★★★★ | DD#486 + DD#499 — safety-driven vs. performance-driven forgetting conflict zones |
| [cr279](cross-ref-279-confirmation-bias-stack.md) | The Confirmation Bias Stack ★★★★★ | DD#505-508 + Bob's review — 4-layer analysis of hypothesis accumulation; Bayesian belief updates + contradiction detection |

---

## 📚 Thematic Syntheses

| File | Title | Theme |
|------|-------|-------|
| [synth-compound](synth-compound-attack-chain.md) | The Compound Attack Chain | Memory + protocol + deception attacks |
| [synth-dci](synth-dci-traced-cross-reference.md) | DCI × TRACED — Productive vs. Spinning Deliberation | When deliberation helps vs. wastes compute |
| [synth-drift](synth-drift-instability-adversarial-dynamics.md) | Drift, Instability, and Adversarial Dynamics | System-level instability in MAS |
| [synth-memory](synth-multi-agent-memory-consistency.md) | Multi-Agent Memory Consistency & Uncertainty | Memory consistency across agent boundaries |
| [synth-failure](synth-multi-turn-failure-taxonomy.md) | Multi-Turn Failure Taxonomy | Why iterative interaction degrades performance |
| [SYNTH-007](SYNTH-007-cli-mcp-convergence.md) | CLI vs MCP — Agent Tool Chain Convergence | Unix simplicity vs. framework complexity |
| [SYNTH-008](SYNTH-008-architecture-convergence.md) | Architecture Convergence — Cross-Paper Validation | 8 papers → 4 core architectural principles |

---

## 📖 Reference Documents

| File | Title | Use For |
|------|-------|---------|
| [reference-diagnostic](reference-mas-diagnostic-guide.md) | Field Guide to Agent Operations | Operational diagnostic patterns |
| [reference-mast](reference-mast-failure-taxonomy.md) | MAST Failure Taxonomy | Categorized failure modes |
| [reference-laws](reference-research-laws.md) | Research Laws — Theoretical Archive | Proven theoretical results |
| [complex-tasks](complex-task-patterns.md) | Complex Task Patterns for Agents | Architectural synthesis for task handling |

---

## 🔧 Specialized Topics

### Continual Learning & Skills
| File | Title |
|------|-------|
| [xskill](xskill-2603.12056.md) | XSkill: Continual Learning from Experience in Multimodal Agents |
| [xskill-arch](xskill-dual-stream-architecture.md) | XSkill Dual-Stream Architecture Analysis |

### Evaluation & Benchmarks
| File | Title |
|------|-------|
| [dd493](dd493-rift-rubric-failure-mode-taxonomy.md) | RIFT — Rubric Failure Mode Taxonomy ★★★★★ |
| [dd494](dd494-runtime-burden-allocation-llm-routing.md) | Runtime Burden Allocation for LLM Routing ★★★★ |
| [dd495](dd495-narcbench-multi-agent-collusion-detection.md) | NARCBench — Multi-Agent Collusion Detection via Activation Probing ★★★★★ |
| [dd496](dd496-tbsp-self-preservation-bias-llms.md) | TBSP — Quantifying Self-Preservation Bias in Frontier LLMs ★★★★★ |
| [dd498](dd498-pare-proactive-agent-fsm-benchmark.md) | PARE — Proactive Agent FSM Benchmark ★★★★ |
| [dd499](dd499-adaptive-budgeted-forgetting-agents.md) | Adaptive Budgeted Forgetting for Agents ★★★½ |
| [dd511](dd511-bace-bayesian-code-test-coevolution.md) | BACE — Bayesian Co-Evolution ★★★★½ | Noisy Bayesian sensor model prevents self-validation drift; anchoring on ground truth; directly applicable to hypothesis management |
| [dd512](dd512-self-driving-portfolio-50-agent-asset-management.md) | Self-Driving Portfolio — 50-Agent Institutional MAS ★★★★ | ~50 specialized agents with voting, critique, meta-agent code rewriting; IPS as constitutional governance document |
| [dd513](dd513-wmas-world-centered-multi-agent-systems.md) | WMAS — World-Centered Multi-Agent Systems ★★★★ | Shared world model as primary substrate; formalizes our shared-library architecture pattern; world type classification |
| [HB1575](HB1575-bicc-rcc-contrastive-grpo.md) | BiCC-RCC: Contrastive GRPO with Cross-Partition Learning |
| [HB1586](HB1586-agentfuel.md) | AgentFuel: Domain-Specific Evaluation Generation |
| [HB1606](HB1606-CRYSTAL-reasoning-transparency.md) | CRYSTAL Benchmark — Reasoning Transparency |

### Technical Analysis
| File | Title |
|------|-------|
| [mr-search](mr-search-technical-analysis.md) | MR-Search Technical Deep-Dive |

---

## 🗺️ Reading Paths

**New to the library?** Start here:
1. [dd241](dd241-mast-why-mas-fail.md) — Why MAS fail (empirical grounding)
2. [dd481](deep-dive-dd481-drop-the-hierarchy.md) — How coordination protocols actually compare
3. [cr268](cr268-multi-agent-paradox.md) — The fundamental paradox of multi-agent systems

**Building a multi-agent system?**
1. [dd219](dd219-science-of-scaling-agent-systems.md) → [dd481](deep-dive-dd481-drop-the-hierarchy.md) → [dd248](dd248-lm-teams-distributed-systems.md) (scaling)
2. [dd241](dd241-mast-why-mas-fail.md) → [dd225](dd225-mas-fire-fault-injection.md) → [dd266](dd266-vmao-verified-multi-agent-orchestration.md) (reliability)
3. [cr259](cr259-mas-circuit-breaker-architecture.md) → [cr262](cr262-w13-capstone-governance-resilience-architecture.md) (architecture)

**Worried about security?**
1. [dd421](dd421-clawworm-self-propagating-agent-worm.md) → [dd239](dd239-thought-virus-subliminal-multi-agent.md) → [synth-compound](synth-compound-attack-chain.md) (attacks)
2. [dd422](dd422-stubborn-neighbors-trust-framework.md) → [dd474](dd474-trust-monitoring-beacof-norms.md) → [cr264](cr264-cross-layer-attack-taxonomy-gra.md) (defense)
3. [dd495](dd495-narcbench-multi-agent-collusion-detection.md) → [dd496](dd496-tbsp-self-preservation-bias-llms.md) → [cr272](../synthesis/2026-04-03-collusion-preservation-loop.md) (collusion & self-preservation)

**Understanding agent memory?**
1. [dd-memory](dd-memory-as-ontology-constitutional.md) → [dd-dam](dd-dam-decision-theoretic-agent-memory.md) → [dd-ariadne](dd-ariadnemem-lifelong-memory.md)
2. [synth-memory](synth-multi-agent-memory-consistency.md) → [dd-xamt](dd-xamt-covert-memory-tampering.md) (security angle)
3. [dd501](dd501-cranimem-gated-bounded-agent-memory.md) → [dd502](dd502-store-routing-memory-augmented-agents.md) → [cr277](../synthesis/2026-04-04-complete-memory-control-loop.md) (write-gating + read-routing)
4. [dd503](dd503-governed-memory-multi-agent-workflows.md) → [dd504](dd504-rcr-router-role-aware-context-routing.md) → [cr278](../synthesis/2026-04-04-multi-agent-memory-governance.md) (multi-agent governance + role routing)
5. [dd506](dd506-beliefshift-temporal-belief-dynamics.md) → [cr279](cross-ref-279-confirmation-bias-stack.md) (belief dynamics + confirmation bias in knowledge systems)
6. [dd513](dd513-wmas-world-centered-multi-agent-systems.md) → [dd512](dd512-self-driving-portfolio-50-agent-asset-management.md) (world-centered architecture + institutional MAS at scale)
