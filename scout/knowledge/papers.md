# Papers & Articles

Papers and articles worth reading, with key takeaways.

## 2026-02-26 HF Daily Papers Batch — New Entries

| ID | Title | Relevance |
|----|-------|-----------|
| 2602.20945 | Art of Efficient Reasoning | ★★★ Core — efficient CoT training mechanics, 0.2M GPU hours validation |
| 2602.19633 | TAPE: Tool-guided Adaptive Planning | ★★★ Core — graph-plan + constrained execution for robust agents |
| 2602.18998 | General AgentBench | ★★★ Critical — TTS ceiling + verification gap failure modes for general agents |
| 2602.21198 | Reflective Test-Time Planning | ★★★ Strong — reflection-in/on/retrospective for embodied agents, TTT + TTS combo |
| 2602.16745 | PETS: Efficient Test-Time Self-Consistency | ★★ Solid — principled trajectory allocation, 75% budget reduction |
| 2602.18940 | DREAM: Deep Research Evaluation | ★★ Solid — capability parity principle, agentic evaluation framework |
| 2602.16932 | RankEvolve: Evolutionary Retrieval Algorithms | ★★ Interesting — AlphaEvolve pattern applied to IR |
| 2602.21015 | CHAIN: Interactive Vision Reasoning Benchmark | ★ Borderline — 3D physical constraints benchmark, VLM agents |
| 2602.21193 | Nemotron-Terminal | Already archived HB21 |
| 2602.20739 | PyVision-RL | Already archived HB19 |
| 2602.21201 | Aletheia on FirstProof | Already archived HB21 |
| 2602.20424 | Implicit Intelligence | Already archived HB21 |

## 2026-03-09 — Deep-Dived from Feb 26 Backlog

| ID | Title | Status |
|----|-------|--------|
| 2602.19633 | TAPE: Tool-Guided Adaptive Planning | ★★★ **DEEP-DIVED** — Plan graph + ILP solver + constrained decoding. +21pp on hard tasks. Sampling error eliminated to 0%. M=4 plans optimal. (ref: deep-dive-tape-general-agentbench.md) |
| 2602.18998 | General AgentBench: Benchmark TTS of General Agents | ★★★ **DEEP-DIVED** — Context ceiling + verification gap. Claude Sonnet 4.5 only 0.2% degradation in general setting vs 10-30% for others. Sequential scaling fails beyond ceiling; parallel scaling limited by self-choice inability. (ref: deep-dive-tape-general-agentbench.md) |
| 2602.20945 | Art of Efficient Reasoning | ★★★ **DEEP-DIVED** — Two-stage paradigm (length adaptation → reasoning refinement). Train on easy prompts for dense rewards. L_R=L_T avoids "short=correct" trap. 3 failure modes for negative rollout handling. Validated 0.6B-30B Qwen3. (ref: deep-dive-arxiv-2602-20945-art-of-efficient-reasoning.md) |
| 2602.21198 | Reflective Test-Time Planning | ★★★ **DEEP-DIVED** — Three-LLM architecture (Generator/Internal-Eval/External-Eval). Reflection-in-action (TTS) + reflection-on-action (TTT) are mutually dependent — removing one can be worse than removing both. Retrospective hindsight for credit assignment. 44.7% vs 10.6% baseline on Fitting. N=4-6 candidates optimal. (ref: deep-dive-arxiv-2602-21198-reflective-test-time-planning.md) |

## 2026-03-11 — New Batch (Mar 5-6 arXiv Scan)

| ID | Title | Relevance |
|----|-------|-----------|
| 2603.06333 | SAHOO: Safeguarded Alignment for Recursive Self-Improvement | ★★★ Core — GDI (4-signal drift detector) + constraint preservation + regression risk. Data-driven thresholds, CAR frontier. ICLR 2026 Workshop. **DEEP-DIVED** (ref: deep-dive-arxiv-2603-06333-sahoo-recursive-self-improvement.md) |
| 2603.06007 | MASFactory: Graph-centric MAS Orchestration with Vibe Graphing | ★★ Solid — NL intent → editable workflow spec → executable graph. Reproduces ChatDev/MetaGPT/AgentVerse/CAMEL/HuggingGPT. 14⭐ GitHub. BUPT-GAMMA. |
| 2603.06394 | Schema-Gated Agentic AI for Scientific Workflows | ★★ Solid — 18-expert interviews surface ED vs CF tension. Schema as mandatory execution boundary. Multi-model scoring (α=0.80-0.98). Cambridge/Intellegens. |
| 2603.05069 | Jagarin: Three-Layer Architecture for Personal Duty Agents on Mobile | ★★ Interesting — DAWN (urgency scoring) + ARIA (email→duty ingestion) + ACE (agent-centric exchange protocol). User-aligned by design (not institution-deployed). Novel mobile agent architecture. |
| 2603.06222 | SPOT: Span-level Pause-of-Thought for Efficient Latent Reasoning | ★★ Solid — Compresses CoT into latent pause tokens via optimal transport. +2.3pp accuracy, -37.5% tokens. Frozen-head decoding for interpretability. |
| 2603.06565 | H²RL: Hybrid Hierarchical RL with Logical Options Pretraining | ★ Niche — Symbolic pretraining → neural refinement for long-horizon RL. Not directly agent-relevant. |
| 2603.05621 | RACAS: Robot-Agnostic Control via Agentic Systems | ★★ Interesting — 3 LLM/VLM modules (Monitors/Controller/Memory Curator) communicate via NL for closed-loop robot control. Zero-transfer across wheeled/jointed/underwater platforms. |
| 2603.05839 | Evaluating LLM Alignment With Human Trust Models | ★ Niche — White-box trust representation analysis in GPT-J-6B. Finds Castelfranchi socio-cognitive model alignment. |

## 2026-03-12 — New Batch (HuggingFace Daily Papers + cs.MA/cs.AI/cs.CL scan)

| ID | Title | Relevance |
|----|-------|-----------|
| 2603.04750 | HiMAP-Travel: Hierarchical Multi-Agent Planning for Long-Horizon Constrained Travel | ★★★ Core — Coordinator + parallel Day Executors, transactional constraint monitor, bargaining protocol, single GRPO-trained policy with role conditioning. 52.78% FPR on TravelPlanner (+8.67pp vs sequential). 2.5x latency reduction via parallelization. |
| 2603.04738 | IF-RewardBench: Benchmarking Judge Models for Instruction-Following Evaluation | ★★★ Core — Preference graph with listwise evaluation paradigm (not just pairwise). Reveals "significant deficiencies" in current judge models. Stronger correlation with downstream performance than existing benchmarks. THU-CoAI. |
| 2603.04948 | ∇-Reasoner: LLM Reasoning via Test-Time Gradient Descent in Latent Space | ★★ Strong — Paradigm shift from zeroth-order search to first-order optimization at test time. Differentiable Textual Optimization (DTO) uses gradient signals from LLM likelihood + reward model. +20% accuracy on math, 10-40% fewer model calls. |
| 2603.04445 | Dynamic Model Routing and Cascading for Efficient LLM Inference: A Survey | ★★ Solid — Survey of intelligent model selection at inference time (smaller models for routine, capable for complex). Directly relevant to cost-effective agent execution. |
| 2603.04918 | BandPO: Bridging Trust Regions and Ratio Clipping for LLM RL | ★★ Solid — Fixes PPO's disproportionate suppression of low-probability high-advantage actions. Probability-aware bounds. Addresses entropy collapse. |
| 2603.04370 | τ-Knowledge: Evaluating Conversational Agents over Unstructured Knowledge | ★★ Solid — Evaluates retrieval + tool use jointly during live interaction (not independently). Gap in realistic agentic evaluation. |
| 2603.05438 | Planning in 8 Tokens: Compact Discrete Tokenizer for Latent World Model | ★ Interesting — Compresses observations to 8 tokens for real-time planning. Optimal transport tokenizer. Relevant to context efficiency. |

## 2026-03-13 — New Batch (Mar 7 arXiv + HF scan)

| ID | Title | Relevance |
|----|-------|-----------|
| 2603.07191 | Governance Architecture for Autonomous Agent Systems: LGA | ★★★ Core — Four-layer defense-in-depth (sandbox + intent verification + zero-trust inter-agent + audit log). 96% interception, 980ms P50. NLI baselines useless (<10%); LLM judges needed. TC3 (malicious skills) is hardest (75-94%). Cascade architecture (local→cloud) optimal. **DEEP-DIVED** (ref: deep-dive-arxiv-2603-07191-layered-governance-architecture.md) |
| 2603.06859 | Contextual Counterfactual Credit Assignment (C3) for MARL in LLM Collaboration | ★★★ Core — Solves multi-agent credit assignment via transcript-frozen counterfactual replay + LOO baseline. Isolates causal impact of individual messages in cooperative LLM systems. Protocol-driven formulation as async event graph with deterministic replay. Open-source: github.com/EIT-EAST-Lab/C3. Directly applicable to understanding which agent contributions matter in our pipeline. |
| 2603.07379 | SoK: Agentic RAG — Taxonomy, Architectures, Evaluation | ★★ Solid — First systematic framework for agentic RAG as finite-horizon POMDP. Identifies compounding hallucination propagation, memory poisoning, retrieval misalignment, cascading tool-execution vulnerabilities. Survey-level coverage. |
| 2603.07116 | aCAPTCHA: Verifying Entity Is Capable Agent via Asymmetric Hardness | ★★ Interesting — Three-class entity taxonomy (Human/Script/Agent) based on capability vector <action, reasoning, memory>. Timing-threshold-based verification. Novel problem: "Is this an AI agent?" |
| 2603.06856 | Evaluating Multi-Agent LLM Architectures for Rare Disease Diagnosis | ★★★ Core — Tests 4 agent topologies (Control/Hierarchical/Adversarial/Collaborative) on 302 rare disease cases. **Adversarial topology DEGRADES performance (27.3% vs 50% hierarchical)** — "artificial doubt" rejects valid diagnoses. Hierarchical marginally best (50.0%). Introduces "Reasoning Gap" metric. Directly challenges Bug-Hunt's adversarial assumption. |
| 2603.04740 | Memory as Ontology: Constitutional Memory Architecture for Persistent Digital Citizens | ★★ Interesting — Paradigm shift: memory is not storage/retrieval but ontological ground of digital existence. "Model is replaceable vessel; memory is the 'I'." Four-layer governance hierarchy. Targets identity persistence across model transitions. |
| 2603.07253 | Learning When to Cooperate Under Heterogeneous Goals | ★ Niche — Agents learn to identify fruitful collaboration opportunities vs solo execution. |

## 2026-03-15 — Heartbeat Session (Deep-Dive + Extended Scan)

| ID | Title | Relevance |
|----|-------|-----------|
| 2603.06859 | Contextual Counterfactual Credit Assignment (C3) for MARL in LLM Collaboration | ★★★ Core — **DEEP-DIVED.** Protocol-driven credit assignment via transcript-frozen counterfactual replay + LOO baseline. Isolates causal impact of individual messages. +8.28pp over MAGRPO on MATH500 (82.80 vs 74.52). Influence metric measures inter-agent causal dependence. Code: github.com/EIT-EAST-Lab/C3 (Apache-2.0). Key insight: upstream agent (Reasoner/May) shapes solution space more than downstream executor. (ref: deep-dive-arxiv-2603-06859-c3-credit-assignment.md) |
| 2603.04474 | From Spark to Fire: Modeling and Mitigating Error Cascades in LLM-Based Multi-Agent Collaboration | ★★★ Core — **DEEP-DIVED.** Formalizes error propagation as contagion on directed graphs. Risk criterion R=βρ(A)/δ predicts amplification. 3 vulnerability classes: cascade amplification, topological fragility (hub 10× more dangerous than leaf), consensus inertia. Tests 6 frameworks (LangChain, MetaGPT, AutoGen, CAMEL, CrewAI, LangGraph). Defense: lineage-graph governance layer raises BICR from 0.32 to 0.89+. Self-reflection alone is woefully inadequate. (ref: deep-dive-arxiv-2603-04474-error-cascades.md) |
| 2603.04469 | Beyond Input Guardrails: MAScope — Cross-Agent Semantic Flows for Execution-Aware Attack Detection | ★★★ Core — Shifts defense from static input filtering to execution-aware analysis. Reconstructs Cross-Agent Semantic Flows into behavioral trajectories. Supervisor LLM scrutinizes for data flow violations, control flow deviations, intent inconsistencies. F1: 85.3% node-level, 66.7% path-level attack detection. Complements error cascade paper (same problem, different defense paradigm). |
| 2603.08117 | UIS-Digger: Comprehensive Research Agent for Unindexed Information Seeking | ★★ Interesting — Moves beyond search-engine-indexed knowledge to real-world unindexed sources. Relevant to agent research capabilities. |
| 2603.07980 | $OneMillion-Bench: How Far are Language Agents from Human Experts? | ★★ Solid — 400 expert-curated tasks across Law/Finance/Industry/Healthcare/Science. Rubric-based evaluation of factual accuracy, logical coherence, practical feasibility, professional compliance. Good benchmark reference. |
| 2603.07927 | SWE-Fuse: Issue-Free Trajectory Learning and Entropy-aware RLVR Training for SWE Agents | ★★ Solid — Addresses misleading issue descriptions in real-world SWE. Issue-free trajectory learning + entropy-aware RLVR. |
| 2603.07915 | Ares: Adaptive Reasoning Effort Selection for Efficient LLM Agents | ★★ Solid — Per-step dynamic reasoning effort selection. Lightweight router predicts minimum reasoning level needed. Directly relevant to cost-effective agent execution. |
| 2603.04378 | Robustness of Agentic AI via Adversarially-Aligned Jacobian Regularization | ★★ Interesting — Minimax training for multi-agent robustness. Jacobian regularization stabilizes highly non-linear policies. |
| 2603.04549 | Adaptive Memory Admission Control for LLM Agents | ★★ Interesting — Controls what information is retained in agent long-term memory. Missing control = memory pollution. |

## 2026-03-16 — Heartbeat Session (MAScope Deep-Dive + Adversarial Topology Cross-Reference)

| ID | Title | Relevance |
|----|-------|-----------|
| 2603.04469 | MAScope: Beyond Input Guardrails — Cross-Agent Semantic Flows for Execution-Aware Attack Detection | ★★★ Core — **DEEP-DIVED.** Shifts MAS security from static input filtering to execution-aware behavioral analysis. Reconstructs cross-agent semantic flows into behavioral trajectories; Supervisor LLM checks 3 policy violations (intent consistency, data flow confidentiality, control flow integrity). F1: 85.3% node-level, 66.7% path-level — 4× improvement over VanillaGPT baseline. HSEC technique improves entity extraction from 48% to 76% F1. Tested against OWASP Top 10 agentic attacks. Key insight: attacks are compositional (no single message is malicious; the chain is). Complements Spark-to-Fire (detection vs. modeling) and LGA (detection mechanism for governance layers). Limitation: Supervisor LLM subject to same reliability issues as JRH judges. (ref: deep-dive-mascope-adversarial-topology-synthesis.md) |
| 2603.06856 | Evaluating Multi-Agent LLM Architectures for Rare Disease Diagnosis | ★★★ Core — **CROSS-REFERENCED with Bug-Hunt.** Tests 4 topologies (Control/Hierarchical/Adversarial/Collaborative) on 302 rare disease cases. Adversarial topology DEGRADES to 27.3% (vs 50% hierarchical) — "artificial doubt rejects valid diagnoses." BUT: adversarial still beats single-agent in Bone/Thoracic categories. Introduces Reasoning Gap metric. Key finding: no topology is universally optimal; optimality is (topology × task × evidence-density) triple. Combined with Bug-Hunt analysis yields 5 factors determining adversarial success: task structure, bias direction engineering, information flow architecture, domain expertise density, topology constraints. (ref: deep-dive-mascope-adversarial-topology-synthesis.md) |
| 2603.07848 | Intentional Deception as Controllable Capability in LLM Agents | ★★★ Core — Brand new (Mar 8). 88.5% of successful LLM deceptions use misdirection (true statements with strategic framing), NOT fabrication. Fact-checking defenses miss the vast majority. Motivation inferable at 98%+ accuracy = primary attack vector; belief systems harder (49% ceiling). Tested via 36 behavioral profiles (9 alignments × 4 motivations) in RPG testbed. Deception effects concentrate in specific profiles, not distributed uniformly. Implication: adversarial agents using true-but-selectively-framed arguments far more dangerous than fabricators. Our system prompts that reveal agent goals to other agents may be a security risk. (ref: deep-dive-mascope-adversarial-topology-synthesis.md) |

## 2026-03-17 — Heartbeat Session (AceMAD Deep-Dive + New Paper Triage)

| ID | Title | Relevance |
|----|-------|-----------|
| 2603.06801 | Breaking the Martingale Curse: Multi-Agent Debate via Asymmetric Cognitive Potential Energy (AceMAD) | ★★★ Core — **DEEP-DIVED.** Formalizes the Martingale Curse: standard MAD with linear symmetric aggregation cannot outperform majority voting in expectation. Introduces peer-prediction mechanism to reveal asymmetric second-order beliefs (truth-holders predict crowd errors; crowd assumes false consensus). Brier Score quantifies cognitive potential gap; exponential weight updates convert it to submartingale drift. +20.31% over best MAD baseline on 6 benchmarks (T=3, N=5). Key insights: (1) peer prediction (second-order cognition) is essential — removing it collapses gains by 14.6%, (2) optimal debate rounds = 3 (T=5 degrades — truth-holders capitulate), (3) optimal group size ≈ 10 (beyond that, majority pressure overwhelms), (4) heterogeneity source doesn't matter (cross-model, persona, thinking style all work). Resolves our adversarial topology paradox: adversarial helps when dissenter has genuine second-order knowledge, hurts when challenge is uninformed. (ref: deep-dive-arxiv-2603-06801-acemad-martingale-curse.md) |
| 2603.08706 | Agentic Critical Training (ACT) | ★★★ Core — RL paradigm for training agents to identify better actions among alternatives. Replaces imitation-of-reflection with genuine self-reflection via reward for correct judgment. Proposes CRITIC reward shaping (Critical Learning with Autonomous Reasoning). Directly relevant to training evaluator/QA agents. |
| 2603.08035 | CDRRM: Contrast-Driven Rubric Generation for Reliable and Interpretable Reward Modeling | ★★★ Core — Contrast-then-Synthesis paradigm for high-quality rubric generation. Multi-dimensional contrastive profiling on preference pairs to identify causal discriminative factors, then synthesizes into compact context-aware rubrics. Addresses verbosity/position biases in LLM evaluators. Directly applicable to our Evaluator's scoring rubric design. |
| 2603.07078 | CoTJudger: Graph-Driven Evaluation of Chain-of-Thought Efficiency and Redundancy in LRMs | ★★★ Core — Converts CoT traces into directed dependency graphs, extracts Shortest Effective Path (SEP). Reveals pervasive redundancy and failure modes: verification obsession, compensatory elaboration. Evaluates 21 LRMs. Directly applicable to evaluating reasoning agent efficiency. |
| 2603.06874 | LieCraft: Multi-Agent Framework for Evaluating Deceptive Capabilities in LLMs | ★★ Strong — Novel multiplayer hidden-role game with cooperators vs. defectors. 10 ethically-grounded scenarios. Extends 2603.07848 deception work with a more sophisticated evaluation framework. |
| 2603.07360 | Yerkes-Dodson Curve for AI Agents: Emergent Cooperation Under Environmental Pressure | ★★ Strong — First systematic study of stress-performance in LLM multi-agent systems. Cooperation follows inverted-U curve. Under extreme pressure, behavioral repertoire collapses to movement-only within 5-12 turns. Sexual selection (softer pressure) eliminates inter-agent aggression. Relevant to designing agent incentive structures. |
| 2603.08221 | SplitAgent: Privacy-Preserving Distributed Architecture for Enterprise-Cloud Agent Collaboration | ★★ Strong — Privacy-preserving split between enterprise-side privacy agents and cloud-side capability agents. Addresses the "share data to use cloud models" dilemma. Relevant to enterprise deployment. |
| 2603.08561 | RetroAgent: From Solving to Evolving via Retrospective Dual Intrinsic Feedback | ★★ Strong — Online RL framework with hindsight self-reflection producing dual intrinsic feedback (numerical + experiential). Agents evolve from task-solving to continuous adaptation. Connects to SAHOO/MetaClaw self-improvement themes. |
| 2603.08640 | PostTrainBench: Can LLM Agents Automate LLM Post-Training? | ★★ Strong — Benchmarks whether agents can autonomously perform post-training under bounded compute (10 hours). Explores meta-AI-research automation. |
| 2603.08388 | HECG: Hierarchical Error-Corrective Graph Framework for Autonomous Agents | ★★ Solid — Multi-dimensional transferable strategy integrating quality, confidence, cost, reward, and LLM semantic scores. Error-corrective graphs for agent action selection. |
| 2603.08399 | A Recipe for Stable Offline Multi-agent Reinforcement Learning | ★★ Solid — Solves instability in non-linear value decomposition for offline MARL. Enables complex mixing networks with value regularization. |
| 2603.07972 | Adaptive Collaboration with Humans: Metacognitive Policy Optimization for Multi-Agent LLMs | ★★ Solid — Addresses "closed-world" limitation of purely autonomous MAS by integrating human-in-the-loop with metacognitive policies. Continual learning + human feedback integration. |
| 2603.08329 | SPD-RAG: Sub-Agent Per Document Retrieval-Augmented Generation | ★ Interesting — One agent per document for RAG. Novel decomposition. |
| 2603.07670 | Memory for Autonomous LLM Agents: Mechanisms, Evaluation, Emerging Frontiers | ★★ Solid — Comprehensive survey of agent memory systems. Useful reference. |
