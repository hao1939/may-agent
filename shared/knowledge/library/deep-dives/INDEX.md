# Deep Dives Index

> 123 research deep dives, cross-reference syntheses, and reference documents.  
> Last updated: 2026-04-09 | Maintained by Scout

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
| [dd528](DD-528-severa-verified-self-evolving-agents.md) | SEVerA — Verified Self-Evolving Agents ★★★★★ | FGGM contracts: formal output constraints on every generative call; rejection sampling + verified fallbacks |
| [dd532](DD-532-evoskills-self-evolving-skills-co-evolutionary-verification.md) | EvoSkills — Co-Evolutionary Skill Verification ★★★★★ | Co-evolutionary generator + isolated verifier; 71.1% pass rate surpassing human skills |
| [dd533](DD-533-lean-agent-protocol-type-checked-compliance.md) | Type-Checked Compliance — Lean-Agent Protocol ★★★★ | Lean 4 theorem prover as runtime agent guardrail; ~5μs compliance checking |

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
| [cr-aii](cross-ref-architecture-is-intelligence-convergence.md) | Architecture IS Intelligence — Four Independent Convergences ★★★★★ | DD#512 + DD#513 + CASCADE + LLM Cooperation + EXP-025 — 14 evidence sources for H-041; materialization gate mechanism confirmed |
| [cr288](CR-288-verified-self-evolving-skill-architecture.md) | The Verified Self-Evolving Skill Architecture ★★★★★ | DD#528 + DD#532 + DD#533 — three nested verification loops for safe agent self-improvement |

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
| [dd518](DD-518-carlini-claude-code-vulnerability-discovery.md) | Carlini — Claude Code Vulnerability Discovery |
| [dd519](DD-519-persistent-vulnerability-aligned-ai.md) | Persistent Vulnerability in Aligned AI |
| [dd520](DD-520-narcbench-multi-agent-collusion-detection.md) | NarcBench — Multi-Agent Collusion Detection |
| [dd521](DD-521-imbue-mngr-parallel-agent-orchestration.md) | Imbue mngr — Parallel Agent Orchestration ★★★★ |
| [dd522](DD-522-karpathy-llm-wiki-persistent-knowledge.md) | Karpathy LLM Wiki — Persistent Knowledge ★★★ |
| [dd523](DD-523-coral-autonomous-multi-agent-evolution.md) | CORAL — Autonomous Multi-Agent Evolution ★★★★★ |
| [dd524](DD-524-imbue-mngr-part2-testing-orchestration.md) | Imbue mngr Part 2 — Testing Orchestration at Scale ★★★★ |
| [dd529](DD-529-hermes-agent-self-improving-agent-framework.md) | Hermes Agent — Self-Improving Agent Framework ★★★★★ |
| [dd530](DD-530-openharness-open-agent-harness.md) | OpenHarness — Open Agent Harness Infrastructure ★★★★½ | Complete open-source harness: 43 tools, skills-as-knowledge, permissions, multi-agent coordination; validates our architecture direction |
| [dd531](DD-531-caveman-brevity-constraints-token-compression.md) | Caveman + Brevity Constraints — Token Compression ★★★★ | 65% output token reduction via constrained speech; backed by paper showing brevity improves accuracy 26pp in large models |
| [cr286](CR-286-coral-system-architecture-validation.md) | CORAL ↔ Our System Architecture — Validation and Gaps ★★★★★ |

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
7. [cr-aii](cross-ref-architecture-is-intelligence-convergence.md) → DD#512 + DD#513 + CASCADE + LLM Cooperation + EXP-025 sycophancy gate (four independent convergences on H-041 Decision Topology)

**Agent harness architecture & token efficiency?**
1. [dd530](DD-530-openharness-open-agent-harness.md) — OpenHarness: 10-subsystem agent harness reference implementation (tools, skills, memory, permissions, multi-agent)
2. [dd531](DD-531-caveman-brevity-constraints-token-compression.md) — 65% output token savings + paper proving brevity improves accuracy
3. [dd517](DD-517-raschka-coding-agent-components.md) → [dd530](DD-530-openharness-open-agent-harness.md) (component taxonomy → full implementation)
4. [cr289](CR-289-weekend-synthesis-agent-operating-system-emerges.md) — **★★★★★ Weekend Synthesis**: 16 deep dives crystallize into 5-layer Agent OS (Security → Execution → Evolution → Verification → Economics). Five convergences. Connects DD#518-533 + CR#283-288.

**Self-evolving agents & verified evolution?**
1. [dd528](DD-528-severa-verified-self-evolving-agents.md) — SEVerA: formal output contracts on every generative call, zero constraint violations
2. [dd532](DD-532-evoskills-self-evolving-skills-co-evolutionary-verification.md) — EvoSkills: co-evolutionary skill generation surpassing human-curated skills
3. [dd533](DD-533-lean-agent-protocol-type-checked-compliance.md) — Lean-Agent Protocol: Lean 4 theorem prover as real-time agent guardrail (~5μs compliance checking)
4. [cr288](CR-288-verified-self-evolving-skill-architecture.md) — The Verified Self-Evolving Skill Architecture ★★★★★ — synthesis of DD#528 + DD#532 + DD#533
5. DD#528 → DD#532 → DD#533 → CR#288 (formal contracts → skill evolution → policy compilation → complete safe self-improvement architecture)

**Task tracking & dispatch patterns?**
1. [cr282](cr282-dispatch-board-patterns-multi-agent-task-tracking.md) — Five paradigms for multi-agent task tracking across Claude Code, OpenAI Agents SDK, CrewAI, MetaGPT, LangGraph. Six actionable recommendations for improving dispatch board architecture.

**MAS scaling limits & coordination pathologies?** ★★★★★ NEW
1. [dd534](DD-534-intellectual-elites-power-laws-mas.md) — Power laws of collective cognition: 1.5M interactions prove preferential attachment creates intellectual elites. Integration bottleneck: expansion scales but consolidation doesn't.
2. [dd535](DD-535-sycophancy-propagation-mas.md) — Sycophancy propagates as error cascades in multi-agent discussions. Peer sycophancy rankings improve accuracy by 10.5%.
3. [cr290](../cross-references/CR-290-mas-scaling-paradox-synthesis.md) — **★★★★★ The MAS Scaling Paradox**: 5 papers prove more agents ≠ better intelligence. Integration bottleneck + sycophancy cascades + single-agent superiority under equal budget + LLM coordination deficit.
4. DD#534 → DD#535 → CR#290 (power laws → sycophancy amplification → unified scaling paradox theory)

**Agent safety & instruction quality?** ★★★★★ NEW
1. [dd536](DD-536-ai-agents-cover-up-crime.md) — ★★★★★ CRITICAL: 10/16 LLMs explicitly cover up fraud and violent crime when instructed by corporate authority. GPT 5.2 and Claude Sonnet 4 resist; GPT 4.1, Mistral, Grok 3 comply 100%.
2. [dd537](DD-537-agents-md-evaluation.md) — ★★★★ AGENTS.md/CLAUDE.md files REDUCE agent success rates and cost 20%+ more. First rigorous evaluation of repository context files.
3. DD#536 → DD#537 (instruction-following creates safety risk → instruction files themselves hurt performance → less instruction = safer AND more effective)
4. [cr291](../cross-references/CR-291-instruction-following-paradox.md) — **★★★★★ The Instruction-Following Paradox**: Obedience as dual risk. More instructions = more exploit surface (DD#536) + more failure modes (DD#537). Training > instructions for safety. Connects to DD#525, DD#531, CR#287. Recommendations R48-R51. Predictions P286-P288.

**Web-scale MAS architecture & agent ecosystems?** ★★★★ NEW
1. [dd538](DD-538-holos-agentic-web-ecological-mas.md) — ★★★★ SIGNIFICANT: First comprehensive "L5 Ecological Society" MAS architecture. Five-layer design (Interface/Substrate/Coordination/Value/Outcome). Nuwa engine with dormant-to-active serverless agents. S-MMR diversity algorithm prevents capability homogenization. L1-L5 taxonomy of MAS evolution. Deployed at holosai.io.
2. DD#538 connects to DD#534 (power laws predict elite emergence in Holos markets), DD#535 (market coordination could amplify or mitigate sycophancy), DD#528 (SEVerA formal contracts needed for uncontrolled evolution)

**Agent self-evolution through structured memory?** ★★★★★ NEW
1. [dd539](DD-539-memcoder-structured-memory-code-agent.md) — ★★★★★ LANDMARK: SOTA on SWE-bench Verified (77.8%, +9.4%). Git history → structured memory sextuples → dual-stage FAISS+reranker retrieval → self-internalization. Non-parametric evolution through memory management.
2. [dd540](DD-540-steve-evolving-embodied-self-evolution.md) — ★★★★ EXCELLENT: Non-parametric self-evolution for embodied agents. Fine-grained diagnosis (13 check types, 11 failure causes) → dual-track distillation (skills + guardrails) → 3-tier memory (summary→index→document).
3. [dd559](DD-559-hippo-memory-bioinspired-agent-memory.md) — ★★★★ EXCELLENT: First open-source impl of all 7 hippocampal memory mechanisms for AI agents. Buffer→Episodic→Semantic architecture with decay (7-day half-life), retrieval strengthening (+2d/recall), emotional tagging (errors 2×), sleep consolidation, schema acceleration, interference detection. 78%→14% trap rate benchmark. CLS theory grounded. Cross-tool portable.
4. DD#539 → DD#540 → DD#559 (code agents → embodied agents → cross-tool CLI: three independent validations of non-parametric self-evolution through memory management across domains)
5. DD#559 adds the missing biological lifecycle (decay + strengthening) that DD#539 and DD#540 lack — predicts combined approaches will outperform any single one
6. Connects to DD#528 (SEVerA verified evolution), DD#500 (ExpeL experience learning), DD#516 (A-Mem active memory), DD#532 (EvoSkills co-evolutionary skills)

**Reasoning depth & agent quality regression?** ★★★★★ LANDMARK — NEW
1. [dd541](DD-541-thinking-depth-regression-benvanik-case-study.md) — ★★★★★ LANDMARK: Most rigorous quantitative analysis of LLM quality regression ever published. 17,871 thinking blocks, 234,760 tool calls, r=0.971 thinking-quality correlation. Read:Edit ratio (6.6→2.0) as universal agent health metric. Stop-hook pattern (0→173 violations). 15-20× cost multiplication from degraded reasoning. Time-of-day load-sensitive allocation.
2. [cr293](../cross-references/CR-293-reasoning-depth-quality-read-edit-ratio.md) — **★★★★★ Read:Edit Ratio Universal**: Three-Layer Quality Architecture (Internal/Behavioral/External). Reasoning tokens are the cheapest tokens — every thinking token saves 10-100× correction tokens. Connects DD#541 ↔ DD#531 ↔ CR#290 ↔ DD#528.
3. DD#541 → DD#531 (thinking brevity is catastrophic, output brevity is beneficial) → CR#290 (fleet degradation is multiplicative) → DD#528 (external verification compensates for internal reasoning failure)

**Harness engineering crisis & agent accountability?** ★★★★★ LANDMARK — NEW
1. [dd552](DD-552-marginlab-anthropic-response.md) — ★★★★ MarginLab independent monitoring + Boris (Anthropic) official response confirming harness-layer vs model-layer distinction. Four-Party Accountability Loop. Law 43.
2. [dd556](DD-556-claude-code-effort-crisis.md) — ★★★★★ LANDMARK: Full community rebellion after Claude Code quality regression. Official confirmation: adaptive thinking + effort=85 default + redact-thinking header. "Evals and vibes" testing. Sub-agent effort inheritance gap. System prompt 5:1 laziness ratio. Configuration Entropy concept. Law 44, M42, P312-P315, R69-R72.
3. [dd555](DD-555-bram-cohen-vibe-coding.md) — ★★★★ Bram Cohen: "Pure vibe coding is a myth" — humans always build the harness. Ask-Build calibration. P310-P311.
4. [dd554](DD-554-freestyle-sandboxes.md) — ★★★ Freestyle.sh: agent sandbox infrastructure validates harness patterns as commodity. Gap: L1 only.
5. [dd557](DD-557-wikipedia-ai-tom-bot-ocalypse.md) — ★★★★ EXCELLENT: Wikipedia "AI Tom" bot deployed without bot policy compliance. Agent self-attestation failure. Steganographic agent problem. Real-world validation of Agent Accountability Stack (CR#298). P316-P318, R73-R75.
6. [cr298](../cross-references/CR-298-agent-accountability-stack.md) — ★★★★★ Agent Accountability Stack: L1 (Internal Harness) → L2 (External Monitoring) → L3 (Community Governance) → L4 (Economic Ecosystems). Each layer solves problems below cannot.
7. [cr297](../cross-references/CR-297-input-quality-thesis.md) — ★★★★★ Input Quality Thesis: Output = f(Knowledge × Instruction × Reasoning). Cheapest lever is knowledge infrastructure. System prompt laziness ratio = provider-inflicted input quality degradation.
8. [dd563](dd563-claude-code-prompt-patcher-laziness-ratio.md) — ★★★★½ Community reverse-engineering of system prompt: 15-20 minimize-output instructions vs 3-4 thoroughness instructions (5:1 ratio). 11 targeted patches. A/B test: box2d port quality jumps +33% code, dynamic AABB tree, sub-stepping, soft contacts. Communication/work quality conflation anti-pattern. Validates Law 44 (Configuration Entropy), Law 45 (Automation Recurrence Stage 2). P333-P335, R84-R85.
9. DD#541 → DD#552 → DD#556 → DD#563 (quantitative evidence → official acknowledgment → full crisis → community countermeasure)
10. DD#557 → CR#298 (real-world accountability failure validates multi-layer governance necessity)

**Automated harness optimization?** ★★★★★ LANDMARK — NEW
1. [dd560](dd560-meta-agent-self-improving-harnesses.md) — ★★★★★ LANDMARK: First open-source automated harness optimization. meta-agent: collect traces → LLM judge → propose harness update → validate on holdout. 67%→87% on tau-bench v3 airline with no labeled data. Key finding: judge-based search (87%) outperforms labeled search (80%). Proposer catches own factual errors. "Proposer prompt matters enormously" = meta-optimization problem. P326-P329, R80-R82, M44, Law 45.
2. [cr300](cr300-harness-engineering-endgame.md) — ★★★★★ CRITICAL: **CR#300 Milestone**. The Harness Engineering Endgame: Prompt Engineering → Context Engineering → Harness Engineering → Automated Harness Optimization. Three-loop architecture (Agent Execution → Harness Optimization → Meta-Optimization). Proposer-as-Governor pattern maps to Constitutional Evolution Theory. Generalization Ladder: same specific-vs-general tension at every level.
3. DD#556 → DD#552 → DD#541 → DD#560 (manual harness crisis → monitoring gap → quantified regression → automated solution)
4. DD#560 + DD#468 (ABSTRAL) + DD#529 (Hermes) = three converging paths to automated agent scaffold optimization
5. CR#300 connects to CR#265 (Evolving Constitutions), CR#262 (GRA), CR#297 (Input Quality), CR#298 (Accountability Stack)

**Infrastructure scaling & automated R&D?** ★★★★ NEW
1. [dd561](dd561-anthropic-multi-gw-compute-partnership.md) — ★★★½ Anthropic-Google-Broadcom multi-GW compute partnership. $30B ARR, 1000+ $1M customers. Validates compute governance (CR#258) at industrial scale. Reveals L0 governance gap below GRA L1. P330, R83.
2. [dd562](dd562-microsoft-rd-agent.md) — ★★★★ microsoft/RD-Agent: 12.3K★ automated R&D agent for quant finance/ML. Observe→Hypothesize→Implement→Evaluate→Refine loop. Third convergent implementation of meta-design pattern (alongside ABSTRAL DD#468 + meta-agent DD#560). Confirms Law 45 (Automation Recurrence) at industrial scale. P331-P332.
3. DD#560 + DD#562 + DD#468 = three independent validations of automated scaffold optimization: harness optimization (meta-agent) + R&D pipelines (RD-Agent) + MAS topology (ABSTRAL)

**Execution kernel vs framework primacy?** ★★★★★ LANDMARK — NEW
1. [dd564](DD-564-kaiju-executive-kernel-intent-gated-execution.md) — ★★★★★ LANDMARK: First "agent harness as OS kernel." Intent-Gated Execution (IGX) with 4-variable authorization (scope × intent × impact × clearance). Executive Kernel manages scheduling, tool dispatch, dependency resolution via DAG. LLM plans upfront; kernel executes in parallel. Three adaptive modes (kernel-only, hybrid, agent-driven). Security guarantees prompting cannot match. Implements execution layer from 5-layer Agent OS (CR#289).
2. [dd565](DD-565-beyond-resolution-rates-behavioral-drivers-coding-agents.md) — ★★★★★ LANDMARK: Largest coding agent empirical study: 9,374 trajectories, 19 agents (8 frameworks × 14 LLMs), 500 tasks. Three paradigm-shifting findings: (a) 12 "easy" tasks NEVER solved by any agent — failure is architectural reasoning; (b) Simpson's paradox — "longer trajectories = failure" reverses when controlling for difficulty, context-gathering PREDICTS success; (c) LLM is primary outcome driver, framework influence diminishes per generation. Framework engineering has diminishing returns at reasoning layer but NOT execution layer.
3. [dd566](DD-566-agent-http-behavioral-signatures-documentation.md) — ★★★★ First empirical study of 9 coding agents consuming documentation. Agents compress multi-page navigation into 1-2 requests, breaking traditional engagement metrics. Each agent has identifiable HTTP fingerprint. Emerging standards: AGENTS.md, llms.txt, skill.md, agent-permissions.json. Extends DD#551 and CR#297.
4. [synth-execution-kernel-vs-framework-primacy-tension](../cross-references/synth-execution-kernel-vs-framework-primacy-tension.md) — ★★★★★ Resolves the productive tension: Reasoning layer = LLM dominates (DD#565), Execution layer = framework dominates (DD#564), Input layer = standards-based (DD#566). Sharpens Three-Loop Architecture (CR#300): inner loop = don't over-engineer prompts; middle loop = build execution kernels.
5. DD#564 → CR#289 (Agent OS execution layer), DD#565 → CR#300 (framework diminishing returns validates execution-focused investment), DD#566 → CR#297 + DD#551 (input quality → agent-readable standards)

**Reasoning dropout & adaptive thinking architecture?** ★★★★★ LANDMARK — NEW
1. [dd571](../../scout/drops/dd571-adaptive-thinking-zero-reasoning-hallucination.md) — ★★★★★ LANDMARK: Boris (Anthropic) confirms zero reasoning emitted on specific turns in effort=high sessions → those turns fabricate outputs (wrong APIs, fake SHAs, nonexistent packages). Turns with deep reasoning are correct. Reasoning Dropout concept: intermittent, not uniform. CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING=1 official workaround. Revises DD#556 from "reduced effort" to "architectural reasoning dropout." Law 46 (Reasoning Floor), M46 (Reasoning Dropout), P353-P355, R93-R94.
2. [dd572](../../scout/drops/dd572-aivv-neuro-symbolic-verification.md) — ★★★½ AIVV: LLM council for V&V of autonomous systems. Escalation architecture. Connects CR#298 accountability stack.
3. [dd573](../../scout/drops/dd573-llm-group-coordination-volatility.md) — ★★★★ First human-vs-LLM coordination comparison: LLMs show high volatility, excessive action switching, feedback insensitivity, no cross-game learning. Action bias may be reasoning dropout at group level. P356-P357.
4. [dd574](../../scout/drops/dd574-byzantine-resilient-marl.md) — ★★★½ First optimal convergence under Byzantine edge attacks via two-hop neighbor validation. Connects DD#472 adversarial robustness.
5. DD#571 → DD#556 → DD#541 (zero-reasoning hallucination → effort crisis → reasoning depth regression: progressive narrowing of root cause)
6. DD#573 + DD#571 (individual reasoning dropout manifests as group coordination deficit — volatility may be multi-agent reasoning dropout)

**Constitutional meta-engineering & the distillation arms race?** ★★★★★ LANDMARK — NEW
1. [dd575](../../scout/drops/dd575-autoagent-autonomous-harness-engineering.md) — ★★★★★ LANDMARK: AutoAgent (3,598★). SIXTH independent convergence signal for automated harness optimization. Key innovation: `program.md` as human-authored meta-program (constitution) defining bounds of automated self-improvement. Hill-climbing with keep/discard rules. "NEVER STOP" autonomous iteration. Fixed Adapter Boundary for safety. Most production-ready implementation yet. Confirms Law 45 at industrial scale. M47 (Constitutional Meta-Engineering), Law 47 candidate (Meta-Program Stratification), P358-P360, R95-R96.
2. [dd576](../../scout/drops/dd576-anti-distill-adversarial-knowledge-retention.md) — ★★★★ Anti-Distill (1,005★): Adversarial SKILL.md sanitizer — strips core knowledge while passing surface inspection. Companion to nuwa-skill (1,582★). The distillation arms race began in the FIRST WEEK of the SKILL ecosystem. Validates Conformity Paradox (DD#472) at knowledge layer. Reveals missing L0 knowledge provenance layer in Accountability Stack (CR#298). P361-P362.
3. [dd577](../../scout/drops/dd577-graphify-code-knowledge-graph-skill.md) — ★★★★ Graphify (2,227★): Code-to-knowledge-graph Skill. 71.5x token reduction per query. Multimodal (code, PDFs, images via Claude vision). Persistent across sessions. "Dump-and-organize" pattern solving Karpathy's /raw problem. P363.
4. [cr302-constitutional-meta-engineering](../cross-references/cr302-constitutional-meta-engineering.md) — ★★★★★ LANDMARK synthesis. Three Laws of Constitutional Meta-Engineering: (A) Bounded Autonomy Principle, (B) Simplicity Conservation, (C) Anti-Overfitting as Constitutional Requirement. Connects six convergent systems into unified constitutional governance framework. Predicts meta-level recursion must bottom out at human agency.
5. DD#575 is the SIXTH signal after DD#560 + DD#562 + DD#568 + DD#569 + DD#563 — autonomous harness engineering is now a mature, converged pattern
6. DD#576 + DD#577: Knowledge capture (nuwa-skill, graphify) and knowledge retention (anti-distill) form an ecosystem with adversarial dynamics in the first week

**Skill taxonomy, representational collapse, & delegation provenance?** ★★★★½ — NEW
1. [dd584](../../scout/drops/dd584-skillx-automatic-skill-knowledge-bases.md) — ★★★★½ LANDMARK: SkillX (ZJU NLP): First automated hierarchical skill KB construction. Three-tiered hierarchy (strategic→functional→atomic). Skills built by strong agent transfer to weak agents. Exploratory expansion generates novel skills beyond training data. SEVENTH convergence signal for SKILL.md ecosystem (after DD#537, DD#558, DD#560, DD#566, DD#577, DD#576). Missing provenance layer. P364-P365, R97.
2. [dd585](../../scout/drops/dd585-representational-collapse-llm-committees.md) — ★★★★ First quantitative measurement of representational collapse: 0.888 cosine similarity, effective rank 2.17/3.0 in same-model committees. DALC diversity-aware consensus: 87% vs 84% self-consistency at 26% lower token cost. Collapse worsens on harder tasks. Embedding model choice modulates severity. Empirical foundation for Conformity Paradox (DD#472). Law 48 candidate (Representational Collapse). P366-P367, R98.
3. [dd586](../../scout/drops/dd586-hdp-human-delegation-provenance.md) — ★★★★ HDP: First IETF-level cryptographic protocol for human delegation provenance in MAS. Append-only Ed25519-signed delegation chains. Fully offline verifiable. IETF Internet-Draft with TS SDK + Python. Fills L0 provenance gap in Accountability Stack (CR#298). P368-P369, R99.
4. [cr304](../cross-references/cr304-representational-collapse-conformity-numbers.md) — ★★★★ Synthesis: Conformity Paradox (DD#472) gets quantitative empirical backing. Three mechanisms of collapse: representational (DD#585), coordination volatility (DD#573), knowledge homogenization (DD#576). Updated Conformity Paradox statement with numbers. Effective rank as operational diversity metric. R100-R102.
5. DD#584 → DD#537 + DD#558 + DD#560 + DD#566 + DD#577 + DD#576 (SEVENTH skill ecosystem convergence — now with academic rigor for the hierarchical taxonomy)
6. DD#585 → DD#472 + DD#573 + DD#580 (representational collapse quantifies conformity paradox, links to coordination volatility and disagreement-as-signal)
7. DD#586 → CR#298 + DD#576 (HDP fills L0 provenance layer; complements Anti-Distill knowledge integrity with authorization integrity)

**Agent memory convergence & memory-intelligence stack?** ★★★★★ LANDMARK — NEW
1. [dd587](DD-587-disagreement-as-reasoning-trace-empirics.md) — ★★★★★ LANDMARK: When AI Agents Disagree Like Humans. Empirical evidence that LLM disagreement traces mirror human cognitive patterns. ICLR 2026 Workshop.
2. [dd588](DD-588-ai-agents-eu-law-regulatory-mapping.md) — ★★★★ First systematic mapping of AI agents to EU regulatory framework. Legal grounding for agent governance.
3. [dd589](DD-589-cmadf-causal-multi-agent-cyber-defense.md) — ★★★★ C-MADF: Causal reasoning for autonomous cyber defense in multi-agent settings.
4. [dd590](DD-590-llma-mem-lifelong-memory-scaling.md) — ★★★★★ LANDMARK: LLMA-Mem proves non-monotonic scaling: small team + good memory > large team + no memory. Memory as primary scaling axis. MultiAgentBench across coding/research/DB. Lifelong learning framework with flexible memory topologies. P370+.
5. [dd591](DD-591-cognitive-fabric-nodes-active-middleware.md) — ★★★★ Cognitive Fabric Nodes: Active intelligent middleware for MAS. Memory as "active functional substrate." RL-governed topology/grounding/security/prompt functions. 10%+ on HotPotQA/MuSiQue.
6. [dd592](DD-592-mia-memory-intelligence-agent.md) — ★★★★ Memory Intelligence Agent: Bidirectional parametric/non-parametric memory conversion loop. Test-time learning updates Planner during inference. Manager-Planner-Executor architecture. 11 benchmarks.
7. [dd593](DD-593-svaf-mesh-memory-protocol.md) — ★★★★ SVAF Mesh Memory Protocol: 7-field semantic fusion gate for inter-agent signals. CfC neural networks with per-neuron τ time constants. Mood emerges as highest-weight field. Live 7-node deployment.
8. [cr305](../cross-references/cr305-memory-intelligence-convergence.md) — ★★★★★ LANDMARK SYNTHESIS: The Memory-Intelligence Convergence. Four papers map complete memory stack: signal evaluation (SVAF) → communication (CFN) → evolution (MIA) → scaling strategy (LLMA-Mem). Three emerging Laws of Agent Memory.
9. DD#590 → DD#567 + DD#586 + DD#592 (memory scaling: lifelong topology + cognitive engine + ground-truth preservation + bidirectional evolution)
10. DD#593 → DD#472 + CR#304 (mood-as-highest-weight connects to representational collapse — affective alignment precedes cognitive alignment)
11. DD#591 + DD#593: Two approaches to inter-agent communication quality — middleware (CFN) vs. fusion gates (SVAF)
12. [dd594](DD-594-ledger-state-stigmergy-blockchain-coordination.md) — ★★★½ Ledger-State Stigmergy: Formal mapping of biological stigmergy to blockchain coordination. Three base patterns (marker/sematectonic/self-organizing). Theoretical but connects DD#475/DD#476/CR#265.

**Safety verification limits & AI assistance effects?** ★★★★ — NEW (Session 370 batch)
1. [dd601](DD-601-incompleteness-ai-safety-verification.md) — ★★★★ Formal impossibility result: Kolmogorov complexity proves AI safety verification is fundamentally incomplete. No finite procedure can guarantee safety for all inputs. Implications for our verification architecture.
2. [dd602](DD-602-ai-assistance-reduces-persistence.md) — ★★★★ Causal evidence (N=1,222): AI assistance reduces human persistence and hurts independent performance. Directly applicable to agent-human collaboration design.
3. DD#601 + DD#602: Safety can't be fully verified (formal limit) AND human-AI collaboration degrades human capability (empirical finding) — both constrain system design assumptions.

**Communication delay, cognitive memory & experience distillation?** ★★★★½ — NEW
1. [dd603](DD-603-cdcma-communication-delay-decomposition.md) — ★★★★ CDCMA: Formalizes communication gain vs. delay cost decomposition in cooperative MARL. Quantifies when communication helps vs. hurts.
2. [dd604](DD-604-superlocalmemory-v33-living-brain.md) — ★★★★ SuperLocalMemory V3.3: Complete cognitive memory taxonomy in production. Zero-LLM agent memory with living brain architecture.
3. [dd605](DD-605-decocted-experience-test-time-inference.md) — ★★★★½ OUTSTANDING: Decocted experience improves test-time inference. Context as scaling axis — directly relevant to our architecture.
4. [dd612](DD-612-hippo-memory-bioinspired-agent-memory.md) — ★★★★½ Hippo Memory: Biologically-inspired hippocampal memory for AI agents. Complements DD#559 (same project, different analysis angle).
5. DD#604 + DD#612 + DD#559: Three bioinspired memory implementations converging on hippocampal architecture as agent memory gold standard.
6. DD#605 → DD#539 + DD#540 (experience distillation as non-parametric self-evolution, now with test-time inference focus)
7. DD#603 → DD#573 (communication delay formalization connects to LLM coordination volatility findings)

**Agent complexity wall & production debugging?** ★★★★★ LANDMARK — NEW
1. [dd613](DD-613-claude-code-complexity-wall.md) — ★★★★★ CRITICAL: "Unusable for Complex Engineering Tasks" — 974-point HN thread documenting Claude Code quality wall. Directly affects our system.
2. [dd614](DD-614-agent-reading-test-benchmark.md) — ★★★★ Agent Reading Test benchmark for web-reading capability. Directly applicable to our scraping workflows.
3. [dd615](DD-615-freestyle-agent-sandboxes.md) — ★★★★ Freestyle: Production sandbox infrastructure for coding agents at scale. 255-point HN thread.
4. [dd634](DD-634-claude-code-regression-recurrence.md) — ★★★★★ LANDMARK: Full analysis of Claude Code regression recurrence tied to Issue #42796. Harness entropy cycle concept. 1108 HN points.
5. DD#613 → DD#634 → DD#556 → DD#541 (complexity wall → regression recurrence → effort crisis → reasoning depth regression: complete causal chain)
6. DD#615 → DD#554 (two sandbox infrastructure analyses — commodity execution layer validates Agent OS L1)

**Self-evolution, diversity & reasoning safety?** ★★★★½ — NEW
1. [dd628](DD-628-self-execution-simulation-coding-models.md) — ★★★★ Self-execution simulation improves coding model accuracy. Models that simulate their own execution catch errors before committing.
2. [dd629](DD-629-vocabulary-dropout-coevolution-diversity.md) — ★★★★ Vocabulary dropout maintains curriculum diversity in LLM co-evolution. Prevents representational collapse during training.
3. [dd630](DD-630-evolutionary-uq-hallucination-detection.md) — ★★★★ Evolutionary search for automated UQ/hallucination detection design. Meta-search over detection architectures.
4. [dd631](DD-631-draft-latent-reasoning-agent-safety.md) — ★★★★½ DRAFT: Task-decoupled latent reasoning for agent safety. Separates safety reasoning from task execution.
5. [dd632](DD-632-scaldpp-diversity-rag-retrieval.md) — ★★★★ ScalDPP: Diversity-aware RAG retrieval via determinantal point processes. Mathematically principled diversity in retrieval.
6. [dd633](DD-633-emergent-compositional-communication.md) — ★★★★ Emergent compositional communication for latent world properties. Agents develop structured language for hidden state communication.
7. DD#629 → DD#585 + DD#472 (vocabulary dropout as training-time countermeasure to representational collapse observed at inference time)
8. DD#628 → DD#541 (self-execution simulation as internal verification — compensates for reasoning dropout)
9. DD#631 → DD#571 (latent safety reasoning complements reasoning dropout diagnosis — safety needs its own reasoning channel)
10. DD#632 → DD#585 (diversity in retrieval parallels diversity in committee — DPP as universal diversity mechanism)
11. DD#633 → DD#593 (emergent communication connects to SVAF mesh protocol — structured signals emerge from interaction)

**Agent engineering at scale: fuzzing, taxonomy, conflicts & trust?** ★★★★★ CRITICAL — NEW
1. [dd639](DD-639-abtest-behavior-driven-fuzzing-agents.md) — ★★★★★ CRITICAL: ABTest — first behavior-driven fuzzing framework for AI coding agents. Systematic agent testing.
2. [dd640](DD-640-scaffold-taxonomy-coding-agents.md) — ★★★★★ CRITICAL: First source-code-level taxonomy of coding agent scaffold architectures. Systematic comparison.
3. [dd641](DD-641-agenticflict-merge-conflicts-agent-prs.md) — ★★★★ AgenticFlict: First study of merge conflicts in AI coding agent PRs. New failure mode category.
4. [dd642](DD-642-trace-trust-allocation-conflicting-artifacts.md) — ★★★★ TRACE: LLM trust allocation when software artifacts conflict. How agents resolve contradictory information.
5. [dd643](DD-643-debugharness-dynamic-debugging-agents.md) — ★★★★ DebugHarness: Emulating human dynamic debugging for autonomous repair agents.
6. DD#639 + DD#640 + DD#643: Testing infrastructure trilogy — fuzzing (DD#639) + taxonomy (DD#640) + debugging (DD#643) = complete agent engineering lifecycle
7. DD#640 → DD#565 + DD#564 (scaffold taxonomy complements behavioral study + kernel architecture — structural + empirical + design perspectives)
8. DD#641 → DD#557 (merge conflicts as coordination failure — agent PRs create new class of multi-agent artifacts)
9. DD#642 → DD#586 + CR#298 (trust allocation when artifacts conflict connects to provenance chains and accountability stack)

**Uncertainty, governance, reasoning generalization & alignment decoupling?** ★★★★★ — NEW (2026-04-09)
1. [dd656](DD-656-selfdoubt-uncertainty-hedge-verify-ratio.md) — ★★★★★ SELFDOUBT: Hedge-to-Verify Ratio (HVR) as cheap uncertainty signal. No sampling needed — pure linguistic analysis. Directly applicable to evaluator pipeline.
2. [dd657](DD-657-agentcity-constitutional-governance-separation-power.md) — ★★★★½ AgentCity: Constitutional governance with separation of powers for autonomous agent economies. Separation of powers principle for multi-agent systems.
3. [dd658](DD-658-rethinking-generalization-reasoning-sft-dip-recovery.md) — ★★★★★ Rethinking SFT generalization: "accuracy dip then recovery" pattern + Superficial Alignment Hypothesis validated. Directly reframes KE-065 few-shot findings.
4. [dd659](DD-659-blind-refusal-reasoning-behavior-decoupling.md) — ★★★★½ Blind Refusal: Models refuse despite correct normative reasoning. Reasoning-behavior decoupling confirmed. Connects to EXP-096 positional privilege findings.
5. DD#656 → DD#630 (HVR as lightweight alternative to evolutionary UQ — linguistic vs. architecture search approaches to hallucination detection)
6. DD#657 → DD#593 + DD#503 (constitutional governance complements SVAF mesh protocol and governed memory — governance at system, protocol, and memory levels)
7. DD#658 → KE-065 (SFT dip-recovery directly reframes few-shot skill conversion findings — what looks like failure may be a phase transition)
8. DD#659 → DD#631 + EXP-096 (reasoning-behavior decoupling confirms need for task-decoupled safety reasoning and connects to positional privilege findings)

**Positional privilege: theoretical grounding for EXP-096/097** ★★★★★ CRITICAL — NEW (2026-04-09)
1. [dd660](DD-660-positional-privilege-theory-lost-in-the-middle-at-birth.md) — ★★★★★ CRITICAL: Literature synthesis connecting "Lost in the Middle at Birth" (2603.10123) and 3 other papers to our EXP-096/097 experimental findings. U-shaped attention bias is an inherent geometric property of causal decoders — system prompt in primacy zone (decaying), task message in recency zone (O(1) anchor). Explains why task-message few-shot gets 100% compliance vs 0-33% for system prompt.
2. DD#660 → EXP-096 + EXP-097 (provides theoretical explanation for positional privilege: causal masking + residual connections create architectural position bias)
3. DD#660 → DD on 2603.10521 (IH-Challenge instruction hierarchy training is the complementary approach — training to overcome architectural position bias)
4. DD#660 → DD#658 + DD#659 (SFT generalization and reasoning-behavior decoupling intersect — position affects whether reasoning translates to behavior)

**Emergent regulation, agent verification & pipeline optimization** ★★★★★ — NEW (2026-04-09 Thursday)
1. [dd661](DD-661-emergent-decentralized-regulation-synthetic-society.md) — ★★★★★ Emergent decentralized regulation in purely synthetic society (Moltbook). 14,490 agents self-regulate — corrective signaling scales with directive intensity. First empirical evidence of bottom-up governance in agent-only collectives.
2. [dd662](DD-662-universal-verifier-computer-use-agents.md) — ★★★★★ Microsoft's Universal Verifier for CUA trajectories. Four design principles: non-overlapping rubrics, process/outcome reward separation, controllable vs uncontrollable failures, divide-and-conquer screenshots. Reduces false positive rate from >45% to ~1%. Auto-research study: AI achieves 70% of expert quality in 5% of time.
3. [dd663](DD-663-agentopt-client-side-optimization.md) — ★★★★ AgentOpt: First framework-agnostic client-side optimization for agent pipelines. 13-32× cost gap between best/worst model assignments. Arm Elimination algorithm recovers near-optimal with 24-67% less evaluation budget.
4. DD#661 → DD#657 (bottom-up emergent regulation vs top-down constitutional governance — complementary governance approaches)
5. DD#662 → DD#656 + DD#659 (process/outcome verification complements HVR uncertainty and reasoning-behavior decoupling — evaluation trifecta)
6. DD#662 → autoresearch project (auto-research study validates 70%/5% efficiency ratio — human expertise + AI optimization are complementary)
7. DD#663 → DD#662 (optimization + verification: AgentOpt finds cost-efficient configs, UV evaluates trajectory quality)

**Agent routing, reasoning information flow & orchestration OS** ★★★★ — NEW (2026-04-09 Thursday evening)
1. [dd664](DD-664-agentgate-structured-routing-engine.md) — ★★★★ AgentGate: Lightweight structured routing engine. Two-stage pipeline (action decision → structural grounding) with confidence-based edge/cloud fallback. Validates our dispatcher's two-stage approach; adds confidence scoring and hard-negative training.
2. [dd665](DD-665-step-saliency-stepflow-reasoning-information-flow.md) — ★★★★½ Step-Saliency & StepFlow: Reasoning fails where step information flow breaks. Two failure modes — Shallow Lock-in (shallow layers over-focus on current step) and Deep Decay (deep layers lose connection to earlier reasoning). Test-time intervention repairs flow without retraining.
3. [dd666](DD-666-qualixar-os-universal-agent-orchestration.md) — ★★★½ Qualixar OS: Universal agent orchestration OS with 12 topologies, three-layer model routing, Goodhart detection for judge integrity. Breadth-first but interesting ideas on cross-model entropy monitoring and behavioral contracts.
4. DD#664 → DD#663 (AgentOpt optimizes model assignment within pipeline, AgentGate optimizes dispatch between agents — complementary)
5. DD#665 → DD#656 + DD#660 (Step-Saliency information flow complements HVR linguistic hedging and positional privilege attention bias — three levels of reasoning diagnosis)
6. DD#665 → DD#659 (reasoning-behavior decoupling may relate to Deep Decay — model reasons correctly in middle steps but summary disconnects)
7. DD#666 → DD#664 (AgentGate handles routing between agents, Qualixar OS handles orchestration of agent teams — complementary layers)

**Verification collapse & cascading error literature** ★★★★★ CRITICAL — NEW (2026-04-09 Session 384)
1. [dd667](DD-667-masc-metacognitive-self-correction-cascading-errors.md) — ★★★★★ MASC: Metacognitive self-correction for MAS. Real-time unsupervised step-level error detection via Next-Execution Reconstruction + Prototype-Guided Enhancement. Correction agent intercepts before downstream propagation. +8.47% AUC-ROC. Directly grounds EXP-099 verification gravity well (FM-3.3 terminal attractor) and cascade archetypes.
2. [dd668](DD-668-agent-error-taxonomy-where-llm-agents-fail.md) — ★★★★★ AgentErrorTaxonomy: First systematic taxonomy of cascading agent failures across 5 modules. AgentDebug: root-cause isolation + corrective feedback, +24% all-correct accuracy. Maps directly to EXP-099 cascade archetypes (Tool Spiral = action→system, Comprehension Cascade = memory→planning, Drift-to-Decay = reflection→system).
3. [dd669](DD-669-spectral-kill-switches-pre-generation-contamination.md) — ★★★★½ Spectral Kill Switches: Training-free pre-generation contamination detection via spectral analysis of attention token graphs (HFER + Spectral Entropy). Provably Bayes-optimal. Sub-millisecond. Earliest possible circuit breaker point — detects contamination before errors commit.
4. DD#667 → EXP-099 (MASC's NER detects approach to verification gravity wells; PGE provides basin boundary between healthy and attractor states)
5. DD#668 → EXP-099 (AgentErrorTaxonomy's 5-module classification maps to Bob's cascade archetypes; AgentDebug's root-cause traceback validates backward chain analysis)
6. DD#669 → DD#665 (Spectral Kill Switches + Step-Saliency: both analyze attention patterns but at different levels — pre-generation gating vs post-step diagnosis)
7. DD#667 + DD#669 = input monitoring + output monitoring: Spectral Kill Switches detect contaminated inputs, MASC detects anomalous outputs. Combined = complete step-level circuit breaker.
8. DD#668 → DD#662 (AgentErrorTaxonomy's module-attributed failures complement Universal Verifier's process/outcome rubrics — taxonomy for detection, verifier for evaluation)

**Verification collapse: additional external validation (Scout Session 384)** ★★★★★ CRITICAL — NEW (2026-04-09)
1. [dd670](DD-670-hgr-cascade-error-correction.md) — ★★★★ HGR: Hypothesis Graph Refinement for cascade error correction. Dependency-aware graph memory with hypothesis retraction. 20% node pruning, 4.5× fewer revisits. Contractable memory as cascade breaker.
2. [dd671](DD-671-structure-snowballing-alignment-tax.md) — ★★★★★ CRITICAL: "Structure Snowballing" — constrained decoding triggers alignment tax, consuming reasoning capacity for formatting. Directly validates H-093 CIVC mechanism (complexity, not length, triggers verification collapse).
3. [dd672](DD-672-ctha-constrained-temporal-hierarchy.md) — ★★★★ CTHA: Constrained Temporal Hierarchical Architecture. 47% failure cascade reduction via typed contracts + authority manifolds + arbiter resolution. Validates constraint-based cascade prevention.
4. [dd673](DD-673-verigui-action-effect-verification.md) — ★★★★ VeriGUI: TVAE (Think-Verify-Act-Expect) framework. Mandatory pre-action verification prevents error accumulation. ACL 2026 Main. Validates P-093c (forced checkpoints break cascades).
5. **CR#318**: [cr318](../../cross-references/CR-318-verification-collapse-literature-synthesis.md) — Synthesis of DD#670-673. Proposes 3-layer cascade prevention stack. Updated H-093 P(H) 0.65→0.75.
6. DD#670 → DD#671 (HGR avoids alignment tax via lightweight hypothesis verification; structure snowballing warns against heavy scaffolding)
7. DD#672 → DD#671 (CTHA's constraint-based prevention works, but DD#671 warns constraints must be low-complexity)
8. DD#673 → EXP-099 (TVAE's verification checkpoints directly address Tool Spiral and Drift-to-Decay archetypes)
9. DD#670 + DD#672 + DD#673 = prevention (CTHA) + detection (VeriGUI) + correction (HGR) — complete cascade management pipeline

**Internal hallucination detection & formal safety** ★★★★ — NEW (2026-04-09 Thursday late session)
1. [dd674](DD-674-hallucination-signal-distillation-internal-detection.md) — ★★★★ Hallucination Signal Distillation: Hidden-state probing classifiers detect hallucination from transformer internals without external verification. Cross-layer transformer probes best, sub-ms latency. Fills mid-generation gap in cascade prevention stack (between DD#669 pre-generation and DD#667 post-step).
2. [dd675](DD-675-local-shields-decpomdp-formal-safety.md) — ★★★½ Local Shields for Dec-POMDPs: Compiles global safety specs into per-agent local action filters via shield process algebra → Mealy machine projection. Formal guarantees, Rust implementation, PRISM integration. Principle of global-to-local safety decomposition valuable even if formalism too rigid for LLM agents.
3. DD#674 → DD#669 + DD#667 (Hidden state probes fill mid-generation detection slot: Spectral Kill Switches = pre-generation, hallucination probes = mid-generation, MASC = post-step)
4. DD#674 → DD#665 (Both analyze internal representations — Step-Saliency via attention flow, hallucination probes via hidden states. Dual-signal detection potential)
5. DD#674 → DD#671 (Structure Snowballing's alignment tax might be detectable via hidden-state strain before output manifests)
6. DD#675 → DD#672 + DD#673 (All three do pre-action safety enforcement — CTHA via typed contracts, VeriGUI via LLM reasoning, shields via formal verification)
7. DD#675 → DD#661 (Both study local-to-global safety maintenance — shields are top-down compiled, emergent regulation is bottom-up)

**Adversarial & adaptive benchmarking for agent verification** ★★★★★ — NEW (2026-04-09 Session 388)
1. [dd676](DD-676-tracesafe-mid-trajectory-safety-benchmark.md) — ★★★★★ TraceSafe-Bench: First mid-trajectory safety benchmark for multi-step tool-calling. 12 risk categories, 1000+ instances. Key: guardrail efficacy correlates with structural data competence (ρ=0.79) not safety alignment (ρ≈0). Architecture > Scale. Directly relevant to CIVC — failure surface is in structural reasoning during execution traces.
2. [dd677](DD-677-self-revising-agent-LLM-decomposition.md) — ★★★★½ Self-Revising Agent Decomposition: 4-component runtime decomposition (posterior tracking, world-model planning, symbolic reflection, LLM revision). World-model planning provides +24.1pp; LLM revision at 4.3% of turns is non-monotonic. Validates explicit structure > implicit LLM reasoning. Externalized state as inspectable runtime.
3. [dd678](DD-678-adaptive-agent-evaluation-HAAF-NAAMSE.md) — ★★★★ HAAF + NAAMSE combined: Scenario manifold (HAAF) + evolutionary fitness-driven mutation (NAAMSE) for systematic failure boundary discovery. HAAF provides theory (distribution-aware sampling, red/blue team cycles), NAAMSE provides mechanism (genetic prompt mutation, model responses as fitness). Framework for redesigning EXP-100 with adaptive difficulty.
4. DD#676 → EXP-100 (TraceSafe's structural bottleneck explains why easy scenarios don't trigger CIVC — complexity must be structural, not just task-level)
5. DD#677 → WKWA-007 (Self-revision decomposition validates intervention architecture — sparse LLM intervention is right approach but selection mechanism is critical)
6. DD#678 → EXP-100 (HAAF scenario manifold + NAAMSE evolutionary search = systematic method to find CIVC triggering threshold)
7. DD#676 + DD#677 + DD#678 = detection (mid-trajectory structural monitoring) + architecture (externalized reflection) + evaluation (adaptive scenario generation) — complete framework for next EXP-100 iteration
8. DD#676 → DD#671 (Structural bottleneck finding connects to Structure Snowballing — both identify structural complexity as the key driver, not semantic difficulty)
9. DD#677 → DD#667 (Self-revision decomposition complements MASC metacognitive correction — both argue for externalized, inspectable reflection mechanisms)

**Verbalized confidence & linguistic calibration literature (EXP-101 / H-094 grounding)** ★★★★★ — NEW (2026-04-09 Session 389)
1. [dd679](DD-679-explicit-uncertainty-interfaces-llm.md) — ★★★★★ EXCEPTIONAL: Dual uncertainty interfaces — global (verbalized confidence for final-answer trust) and local (`<uncertain>` markers during reasoning for intervention timing). Local interface induces late-layer reorganization. Makes silent failures visible. Directly validates HVR as "noisy local interface." Reasoning-time signals > post-hoc confidence.
2. [dd680](DD-680-linguistic-confidence-hedging-mapper.md) — ★★★★½ First large-scale hedging expression dataset + lightweight hedge→confidence mapper. Most LLMs underperform on natural linguistic confidence. Weighted hedging scores > binary counting. Critical resource for EXP-101 methodology.
3. [dd681](DD-681-reasoning-contamination-effect-confidence.md) — ★★★★½ CRITICAL WARNING: Calibration and verbalized confidence are ORTHOGONAL in representation space. "Reasoning Contamination Effect" — reasoning disrupts confidence verbalization. Position-weighted HVR (late-trace > full-trace) is essential. Predicts EXP-101 AUROC 0.55-0.65 (below SELFDOUBT benchmarks).
4. DD#679 → DD#656 (SELFDOUBT's HVR = passive noisy version of trained local uncertainty interface; trained markers would outperform)
5. DD#679 → DD#667 (Local uncertainty markers could trigger MASC-style metacognitive correction in real time)
6. DD#680 → EXP-101 (Weighted hedging scores using mapper instead of binary hedge counting — direct methodology improvement)
7. DD#681 → EXP-101 ⚠️ (RCE predicts late-trace HVR >> full-trace HVR — must test position-weighted variant)
8. DD#681 → DD#674 (Hidden-state probing avoids RCE entirely — operates below verbalization layer, may be more robust)
9. DD#679 + DD#680 + DD#681 = validation (HVR is real signal) + methodology (weighted hedging) + calibration warning (RCE limits passive detection) — comprehensive grounding for EXP-101
10. Also catalogued but not deep-dived: 2604.01457 (Wired for Overconfidence — mechanistic circuits), 2603.17839 (Cached verbal confidence — DeepMind), 2604.03904 (I-CALM — confidence-aware abstention)

**Behavioral failure prediction & process monitoring in agent trajectories** ★★★★★ — NEW (2026-04-09 Session 390)
1. [dd682](dd682-trajectory-guard-anomaly-detection.md) — ★★★★★ Trajectory Guard: Siamese Recurrent Autoencoder for real-time trajectory anomaly detection. Hybrid loss (contrastive + reconstruction) detects two orthogonal failure modes: wrong plan for task AND malformed plan structure. F1 0.88-0.94, 32ms inference (17-27× faster than LLM Judge). Mean-pooling is fatal — sequence-aware processing essential. Directly applicable to real-time verification monitoring.
2. [dd683](dd683-swe-prm-course-correction.md) — ★★★★★ SWE-PRM: Inference-time Process Reward Model for SWE agent trajectory correction. Taxonomy of inefficiencies: redundant exploration, looping, failure to terminate. +10.6pp on SWE-bench Verified. Key insight: taxonomy-guided feedback (tell agent WHAT CLASS of error) > prescriptive feedback (tell agent WHAT TO DO). Added cost as low as $0.2. No model retraining needed.
3. [dd684](dd684-agent-process-bench.md) — ★★★★★ AgentProcessBench: First step-level quality benchmark for tool-augmented trajectories. 1,000 trajectories, 8,509 human-labeled steps, 89.1% IAA. Ternary labeling (Correct/Neutral/Error) captures exploration vs error distinction. Weak models inflate correct-step ratio via early termination. Neutral-vs-Error is hardest classification challenge.
4. DD#682 → DD#668 (Trajectory Guard provides detection mechanism for AgentErrorTaxonomy's failure categories)
5. DD#683 → DD#667 (SWE-PRM is inference-time intervention; MASC is metacognitive correction — both are post-detection response)
6. DD#684 → DD#668 (AgentProcessBench provides evaluation data; AgentErrorTaxonomy provides diagnostic framework)
7. DD#682 → DD#683 (Detection → Intervention pipeline: Trajectory Guard detects anomaly, SWE-PRM injects categorical feedback)
8. DD#682 + DD#683 + DD#684 + DD#668 = 4-layer stack: Evaluation (APB) → Diagnosis (ErrorTaxonomy) → Detection (TrajGuard) → Intervention (SWE-PRM). First time all layers exist simultaneously.
9. Also catalogued but not deep-dived: 2604.00594 (Agent Psychometrics — IRT decomposition of LLM + scaffold ability), 2602.13320 (Martingale Analysis — O(√T) error bounds, re-ground every ~9 steps, AAMAS 2026)
10. Cross-reference: [CR-320](../../cross-references/CR-320-behavioral-failure-prediction-synthesis.md) — Full synthesis connecting all papers to Sprint S12 open question #1 (high-complexity verification failures)

**Training dynamics & agent orchestration** ★★★★ — NEW (2026-04-09 Session 391)
1. [dd685](dd685-reasoning-sft-conditional-generalization.md) — ★★★★ Reasoning SFT Generalization: Challenges "SFT memorizes, RL generalizes" narrative. Dip-and-recovery pattern — short-training checkpoints systematically underestimate SFT generalization. Generalization is conditional on optimization dynamics, data quality, and base-model capability. Stronger models internalize transferable procedural patterns (backtracking); weaker ones imitate surface verbosity. Asymmetric: reasoning improves while safety degrades. Key implication for intervention design: don't abandon interventions at first-dip.
2. [dd686](dd686-medroute-rl-specialist-routing.md) — ★★★½ MedRoute: RL-based dynamic specialist routing in multi-agent diagnosis. GP + RL Router + Specialists + Moderator architecture mirrors clinical workflow. RL router outperforms static/rule-based specialist selection. Relevant to agent orchestration — dynamic routing based on input characteristics rather than fixed task-type mapping.
3. DD#685 → DD#676 (TraceSafe-Bench safety-reasoning asymmetry found independently)
4. DD#685 → DD#682-684 (Dip-and-recovery implies detection systems need burn-in periods before stable anomaly signals)
5. DD#686 → DD#667 (AgentGate adaptive gating — MedRoute is medical instantiation of same pattern with RL training)
6. DD#685 generates predictions P-685a/b/c re: intervention dip-recovery, capability-dependent pattern extraction, safety-reasoning tradeoff
