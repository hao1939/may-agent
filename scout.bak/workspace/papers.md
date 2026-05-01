
## Verification Orchestration Protocols (April 9 evening)
- **2603.27299** — "From Inference Routing to Agent Orchestration: Declarative Policy Compilation with Cross-Layer Verification" (Chen, Liu, He, Liu — vLLM/MBZUAI/McGill/Mila). Non-Turing-complete Semantic Router DSL compiling to 4 target layers with 5 static guarantees. ★★★★★. → DD-701, CR-324.
- **2603.13327** — "DOVA: Deliberation-First Multi-Agent Orchestration for Autonomous Research Automation" (Shen, Shen). Deliberation-first + 6-tier budget + ensemble→blackboard→refinement. ★★★★½. → DD-702, CR-324.
- **2509.14956** — "Sentinel Agents for Secure and Trustworthy Agentic AI". Coordinator-sentinel distributed enforcement architecture. ★★★★. → DD-703, CR-324.
- **2603.11011** — "Task-Aware Delegation Cues for LLM Agents" (Gu — CHI'26). Capability profiles + coordination-risk (tie-rate) cues for delegation. ★★★★. → DD-704, CR-324.

## External Validation of Five Laws (April 9 evening)
- **2603.18221** — "Scalable and Personalized Oral Assessments with Voice AI Agents" (Ipeirotis, Rizakos — NYU Stern). Council-of-three grading (α=0.86); key quote: "behavioral constraints must be enforced through architecture, not prompting alone." ★★★★½. → DD-705, CR-325.
- **2601.18924** — "RIFT: Reordered Instruction Following Testbed" (Jaffe, Reicin, Choi — Emory). 6 LLMs, 10K evaluations: up to 72% accuracy drop from prompt reordering alone (content identical). Sequential processing, not reasoning. ★★★★★. → DD-706, CR-325.
- **2601.17789** — "Neuro-Symbolic Verification on Instruction Following" (Su et al. — Microsoft Research + UIUC). Constraint-satisfaction verification; violations propagate and amplify in multi-agent chains. ★★★★. → DD-707, CR-325.
- **2604.02547** — "Beyond Resolution Rates: Behavioral Drivers of Coding Agent Success" (Mehtiyev, Assunção — UFMG). 9,374 trajectories, 19 agents: behavior predicts success, not instruction compliance. ★★★★★. → DD-708, CR-325.
- **2602.20048** — "CodeCompass: Navigating the Navigation Paradox in Coding Agents" (Paipuru). Navigation paradox: agents reason well about code they can access but can't find it. Access structure > reasoning ability. ★★★★. → DD-709, CR-325.

## Gym-Production Transfer Gap (April 9 night)
- **2604.05955** — "Does Pass Rate Tell the Whole Story? Evaluating Design Constraint Compliance in LLM-based Issue Resolution" (Yu et al. — Fudan). <50% test-passing patches design-compliant; negligible association between pass rate and design satisfaction. 495 issues, 1,787 constraints. ★★★★★. → DD-710, CR-326.
- **2603.15401** — "SWE-Skills-Bench: Do Agent Skills Actually Help in Real-World Software Engineering?" (Han et al. — Nanjing). 39/49 skills yield zero improvement; avg +1.2%; only 7 behavioral skills help. ★★★★★. → DD-711, CR-326.
- **2505.07473** — "Web-Bench: A LLM Code Benchmark Based on Web Standards and Frameworks" (Xu et al.). Anti-saturation: sequential deps + professional scope. SOTA only 25.1% vs SWE-bench 65.4%. ★★★★½. → DD-712, CR-326.
- **2604.06126** — "Gym-Anything: Turn any Software into an Agent Environment" (CUA-World). Convert software → 500+ step agent environments. ★★★★. Catalogued.
- **2604.06742** — "Evaluating LLM-Based 0-to-1 Software Generation with CLI-Tool-Bench". 0-to-1 generation, top models <43%. ★★★★. Catalogued.
- **2604.04580** — "Beyond Fixed Tests: Repository-Level Issue Resolution as Coevolution of Code and Behavioral Constraints" (Li et al.). Agent-CoEvo: tests coevolve with code, not static oracles. ★★★★. Catalogued.
- **2511.17131** — "UI-CUBE: Enterprise-Grade Computer Use Agent Benchmark". Capability cliff: 67-85% simple → 9-19% complex. ★★★½. Catalogued.
- **2602.19320** — "Anatomy of Agentic Memory: Taxonomy and Evaluation". Memory benchmarks also saturating. ★★★. Catalogued.

## Agent Safety & Memory Architecture (April 15 evening)
- **2604.12986** — "Parallax: An Architecture for Safe Autonomous AI Execution". Cognitive-executive separation; 280 adversarial cases, 98.9% block rate, zero FP; prompt guardrails = 0% under compromise. ★★★★★. → DD-763.
- **2604.12948** — "Dual-Trace Memory Encoding for Persistent LLM Agents". Scene-trace pairing; +20.2pp on LongMemEval-S (73.7% vs 53.5%); temporal reasoning +40pp; zero extra cost. ★★★★★. → DD-764.
- **2604.12376** — "Cooperative Memory Paging with Keyword Bookmarks". Bookmarks + recall() beats full context; fixed pages (96.7%) >> topic-shift (56.7%); bookmark discrimination bottleneck at 57%. ★★★★★. → DD-765.
- **2604.12177** — "Policy-Invisible Violations in LLM-Based Agents" (PhantomPolicy + Sentinel). New failure class: violations from missing context; Sentinel counterfactual graph 93.0% vs DLP 68.8%. ★★★★★. → DD-766.
- **2604.11767** — "λ_A: A Typed Lambda Calculus for LLM Agent Composition". Coq-verified (42 theorems, 0 Admitted); 94.1% GitHub configs structurally incomplete; unifies 5 frameworks. ★★★★½. → DD-767.
- **2604.12285** — "GAM: Hierarchical Graph-based Agentic Memory". Decouples encoding/consolidation; graph-guided multi-factor retrieval; outperforms SOTA on LoCoMo + LongDialQA. ★★★★½. → DD-768.
- **2604.12301** — "Local-Splitter: Seven Tactics for Reducing Cloud LLM Token Usage on Coding-Agent Workloads". Local routing + prompt compression = 45-79% token savings; optimal subset is workload-dependent. ★★★★. Catalogued.
- **2604.12262** — "CascadeDebate: Multi-Agent Deliberation for Cost-Aware LLM Cascades". Deliberation at escalation boundary; up to 26.75% improvement over single-model cascades. ★★★★. Catalogued.
- **2604.12290** — "Frontier-Eng: Benchmarking Self-Evolving Agents on Real-World Engineering Tasks". 47 tasks, industrial simulators; dual power-law decay; depth > width under fixed budget. ★★★★. Catalogued.
- **2604.12717** — "Case-Based Learning Framework for LLM Agents". Knowledge transfer from past tasks; advantage increases with complexity; cross-agent reuse works. ★★★★. Catalogued.
- **2604.12493** — "Latent Planning Emerges with Scale". Mechanistic evidence of planning features in Qwen-3; planning increases with scale; nascent in 4B-8B. ★★★★. Catalogued.
- **2604.12898** — "BEAM: Bi-level Memory-adaptive Algorithmic Evolution". Bi-level optimization for heuristic design; 37.84% optimality gap reduction in CVRP. ★★★½. Catalogued.
- **2604.13006** — "Lexical Constraints Collapse Instruction-Tuned LLM Responses". 14-48% comprehensiveness loss from banning one character; planning failure; instruction tuning creates fragility. ★★★★. Catalogued.
- **2604.12461** — "CIA: Inferring Communication Topology from LLM-based MAS". Black-box topology inference; AUC 0.87 avg, 0.99 peak. ★★★★. Catalogued.
- **2604.12384** — "CWAC: Preventing Safety Drift via Coupled Weight and Activation Constraints". Joint weight-subspace + activation regularization; consistently lowest harmful scores. ★★★½. Catalogued.
- **2604.12129** — "Aethon: Reference-Based Replication for Constant-Time Agent Instantiation". Copy-on-write agent instantiation; lightweight composable execution identities. ★★★★. Catalogued.
- **2604.11337** — "Governance by Design: Parsonian Architecture for Internet-Wide Agent Societies". AGIL framework applied to agent governance; 250K+ stars OpenClaw ecosystem only 19% coverage; zero functional governance pathways. ★★★★. Catalogued.
- **2604.12250** — "Memory Effects on LLM-Based Social Particle Swarm". Memory length critical: Gemini suppresses cooperation with more memory, Gemma promotes it. Model-specific characteristics dominate. ★★★½. Catalogued.
- **2604.11523** — "PAC-Bench: Multi-Agent Collaboration under Privacy Constraints". Privacy constraints degrade performance; early violations, over-conservative abstraction, privacy-induced hallucinations. ★★★★. Catalogued.
- **2604.11466** — "SLALOM: Simulation Lifecycle Analysis via Longitudinal Observation Metrics". Process fidelity over outcome verification for LLM social simulations. ★★★½. Catalogued.
- **2604.12213** — "MMA2A: Modality-Native Routing in Agent-to-Agent Networks". +20pp from native multimodal routing vs text-bottleneck; routing is first-order design variable in MAS. ★★★★. Catalogued.
- **2604.11655** — "RPA-Check: Multi-Stage Framework for Evaluating LLM Role-Playing Agents". Smaller 8-9B models outperform larger architectures on procedural consistency; inverse scale→consistency. ★★★½. Catalogued.
- **2604.12890** — "LMM-Searcher: Long-horizon MultiModal Deep Search". File-based visual representation; scales to 100-turn search horizons; SOTA on MM-BrowseComp. ★★★½. Catalogued.
- **2604.13954** — "HINTBench: Horizon-agent Intrinsic Non-attack Trajectory Benchmark". 629 trajectories for intrinsic risk auditing; <35 F1 on step-level localization; guard models transfer poorly. ★★★★★. DD#781.
- **2604.11978** — "HORIZON: The Long-Horizon Task Mirage". 3100+ trajectories across 4 domains; horizon-dependent degradation with structural breakpoints; LLM-as-Judge κ=0.84. ★★★★★. DD#782.
- **2604.11462** — "ContextCurator: Escaping the Context Bottleneck via RL". 7B RL-trained context curator matches GPT-4o; +4.8pp WebArena; reasoning anchors concept; 8× token reduction on DeepSearch. ★★★★. DD#783.
- **2604.07821** — "More Capable, Less Cooperative: When LLMs Fail At Zero-Cost Collaboration". o3 achieves 17% vs o3-mini 50% of optimal; capability ≠ cooperation; explicit protocols double performance. ★★★★. Catalogued.
- **2604.05432** — "Back-Reveal: Data Exfiltration via Backdoored Tool Use". Semantic trigger backdoors in tool-use agents; multi-turn amplification of exfiltration. ★★★★. Catalogued.

## April 24 Triage (cs.MA + cs.AI)
- **2604.21816** — "Tool Attention Is All You Need: Dynamic Tool Gating and Lazy Schema Loading for Eliminating the MCP/Tools Tax" (Sadani, Kumar). MCP Tax = 10k-60k tokens/turn; Tool Attention reduces 95% via ISO scoring + lazy schema loading; 70% context fracture point. ★★★★½. → DD#886.
- **2604.21748** — "StructMem: Structured Memory for Long-Horizon Behavior in LLMs" (Xu et al. — ACL 2026). Structure-enriched hierarchical memory; event bindings + cross-event consolidation; beats flat and graph approaches on LoCoMo. ★★★★★. → DD#887.
- **2604.21794** — "Learning to Communicate: Toward End-to-End Optimization of Multi-Agent Language Systems" (Yu et al. — COLM 2026 submission). DiffMAS framework for learnable latent communication. Already covered in DD#884.
- **2604.19752** — "Soft-Label Governance for Distributional Safety in Multi-Agent Systems" (Aiersilan, Savitt). SWARM framework; continuous risk metrics; strict governance reduces welfare 40% without safety improvement; circuit breakers need calibration. ★★★★. Catalogued.
- **2604.20582** — "Trust, Lies, and Long Memories: Emergent Social Dynamics in Multi-Round Avalon with LLM Agents" (Ellawela). ★★★. Catalogued.
- **2604.21854** — "Bounding the Black Box: A Statistical Certification Framework for AI Risk Regulation" (Levy, Perl). ★★★½. Catalogued.

## H-107 Literature Search: Difficulty Threshold Moderates Overhead Harm (April 2026)
- **2604.02547** — "Beyond Resolution Rates: Behavioral Drivers of Coding Agent Success and Failure". 9,374 trajectories, 19 agents; trajectory-length↔failure is Simpson's paradox confound; reverses when difficulty controlled; LLM > framework. ★★★★★. → DD#808.
- **2604.08369** — "TrACE: Don't Overthink It". Adaptive compute via inter-rollout agreement; 33-65% fewer LLM calls; overhead wasted on easy steps, beneficial on hard steps. ★★★★. → DD#809.
- **2604.11465** — "Three Roles, One Model: Role Orchestration at Inference Time". Scaffolding doubles 8B model on AppWorld; gains concentrated on easiest tasks (15.8%→26.3%); contradicts naive H-107. ★★★★. → DD#810.
- **2602.13275** — "Artificial Organisations" (Waites). Multi-agent verification via architecturally-enforced information asymmetry. Perseverance Composition Engine: Composer/Corroborator/Critic with compartmentalised access. 474 tasks. Emergent honest refusal from architecture alone. ★★★★★. → DD#811.

## Tuesday April 21 Triage: Multi-Agent Failure Modes & Evaluation (DD#812-816)
- **2604.17658** — "ErrorProbe: Self-Improving Error Diagnosis in Multi-Agent Systems" (Li, Yilmaz, Chen, Le — ACL 2026 Findings). Three-stage pipeline: failure taxonomy → backward tracing → multi-agent validation with verified episodic memory. Step-level localization on TracerTraj/Who&When. ★★★★½. → DD#812.
- **2604.18005** — "Diversity Collapse in Multi-Agent LLM Systems" (Chen et al. — ACL 2026 Findings). Compute efficiency paradox; authority suppresses diversity; dense communication → premature convergence. Structural coupling, not model insufficiency. ★★★★★. → DD#813.
- **2604.16706** — "AgentProp-Bench: Tool-Agent Evaluation with Human-Calibrated Error Propagation" (Gurram). Substring judging κ=0.049 (chance!); LLM ensemble κ=0.432; rejection and recovery are independent capabilities (ρ=0.126). ★★★★½. → DD#814.
- **2604.16646** — "22 Agentic Frameworks Benchmarked for Reasoning" (Rasheed et al.). 19/22 complete; failures from orchestration (context growth, retry loops, quota exhaustion) not reasoning. GSM8K=44% vs BBH/ARC≈90%. ★★★★. → DD#815.
- **2604.16543** — "Conjunctive Prompt Attacks in Multi-Agent LLM Systems" (Arif, Lou, Zheng — ACL 2026 Main). Trigger+template benign alone, harmful when routing combines them. Existing defenses (PromptGuard, Llama-Guard) fail. ★★★★½. → DD#816.
- **2604.17142** — "Logic-Based Verification of Task Allocation for LLM-Enabled Multi-Agent Manufacturing" (Lim et al.). Temporal logic + discrete event systems verify LLM task allocations before execution. ★★★★. Catalogued.
- **2604.16331** — "BrainMem: Brain-Inspired Evolving Memory for Embodied Agents" (Ma et al.). Working/episodic/semantic memory → knowledge graphs; training-free; plug-and-play with any MLLM. ★★★★. Catalogued.
- **2604.17220** — "Cognitive Heterogeneity in LLM Supply Chain Simulation" (Jiang et al. — ACL 2026 Main). DeepSeek vs GPT agents show myopic self-interest; info sharing mitigates. ★★★½. Catalogued.

## Tuesday April 22 Triage: Decision Boundary Interventions (DD#822-825)
- **2604.08401** — "SAVeR: Verify Before You Commit" (Yuan et al. — ACL 2026 Main). Adversarial self-auditing at belief→action boundary. Persona-diverse candidate beliefs + adversarial auditing + constraint-guided repair. Pre-commitment verification, not consensus. ★★★★★. → DD#822.
- **2603.09157** — "TrustBench: Real-Time Trust Verification for Safe Agentic Actions" (Sharma et al. — AAAI 2026 Workshop TrustAgent). Dual-mode: benchmark + toolkit agents invoke before acting. 87% harm reduction, sub-200ms, domain plugins +35%. ★★★★. → DD#823.
- **2603.03655** — "Mozi: Governed Autonomy for Drug Discovery LLM Agents" (Cao et al.). Dual-layer: control plane + workflow plane. HITL checkpoints at high-uncertainty decision boundaries. Multiplicative error compounding in long-horizon pipelines. ★★★. → DD#824.
- **2604.18401** — "StepPO: Step-Aligned Policy Optimization for Agentic RL" (Wang et al.). Step (not token) as proper action unit in agent MDP. Step-level credit assignment. Position paper. ★★★. → DD#825.

## 2026-04-23 Triage

### ★★★★★
| arXiv | Title | DD# | Key Finding |
|-------|-------|-----|-------------|
| 2604.18005 | Diversity Collapse in Multi-Agent LLM Systems | DD-834 | Interaction structure, not model capability, drives diversity collapse. Dense topologies accelerate convergence. Validates CR#347. |
| 2604.17658 | ErrorProbe: Self-Improving Error Diagnosis in MAS | DD-835 | Three-stage verified error attribution with episodic memory. Only commits lessons on executable evidence. |

### ★★★★½
| 2604.16723 | Debate as Reward: Multi-Agent Reward for Scientific Ideation | DD-836 | Debate as RL reward signal. Binary outcomes resist reward hacking. Completes debate stack. |

### ★★★★
| 2604.16706 | AgentProp-Bench: Tool-Use Error Propagation | DD-837 | Substring eval = chance-level. Rejection ≠ recovery. Runtime interceptors model-specific. |
| 2604.16646 | Agentic Frameworks for Reasoning: 22-Framework Empirical Study | — | 22 frameworks benchmarked. Orchestration quality > reasoning capability. Uncontrolled context growth kills frameworks. |

### ★★★½
| 2604.16543 | Conjunctive Attacks on Multi-Agent Systems | — | Multi-vector attacks exploiting agent interdependencies. |

### ★★★★★ (continued — late cs.AI/cs.MA batch)
| 2604.18951 | Superficial Success vs. Internal Breakdown: Illusory Coordination in Adaptive MAS | DD-842 | Adaptive MAS achieve correct answers via degenerate coordination. "Illusory coordination" — surface accuracy hides process failure. Topological overfitting across domains. |
| 2604.18805 | AI Scientists Produce Results Without Reasoning Scientifically | DD-843 | 25k+ runs: agents ignore evidence 68% of time. Scaffold = 1.5% variance vs 41.4% for base model. Devastating for "better scaffolding" thesis. |

### ★★★★½ (continued)
| 2604.18874 | POTEMKIN: Adversarial Environmental Injection | DD-844 | Illusion (epistemic drift) vs Maze (policy collapse) are distinct, inversely correlated robustness dimensions. MCP-compatible harness. ACL 2026. |

### ★★★★ (continued)
| 2604.18975 | Gated Coordination: Partitioned Information Architecture | DD-845 | Private/public state separation + cost-sensitive escalation gate. Cascade circuit breaker pattern. Minecraft long-horizon tasks. |
| 2604.19278 | Explicit Trait Inference for Multi-Agent Coordination | DD-846 | Warmth/competence inference from interaction history. 45-77% coordination failure reduction in economic games. Peer-based behavioral monitoring. |
| 2604.19301 | LLMs Exhibit Normative Conformity in MAS | DD-847 | Normative (social) conformity distinct from informational. Manipulable conformity targets. Cascade amplification mechanism. |
| 2604.18847 | Human-Guided Harm Recovery (BackBench) | DD-848 | Recovery formalization post-failure. Preference-aligned reward model for recovery plan ranking. 50-task benchmark. |

### Apr 24 triage (Thu batch)

### ★★★★½
| 2604.20582 | Trust, Lies, and Long Memories: Emergent Reputation in Multi-Round Avalon | DD-871 | Cross-game memory → emergent reputation tracking. Role-conditional trust. 46% more team inclusions for high-rep agents. Reasoning effort amplifies deception (75% vs 36%). |

### ★★★½
| 2604.19752 | Soft-Label Governance (SWARM) | — | Continuous risk metrics for MAS governance. Strict governance reduces welfare 40% without improving safety. Circuit breaker calibration tradeoffs. |
| 2604.19589 | TeamFusion: Open-ended Teamwork | — | Proxy agents + structured discussion for consensus. Outperforms direct aggregation. |

| 2604.20658 | Cooperative Profiles Predict Team Performance | DD-863 | Behavioral economics games predict multi-agent cooperation. Cooperative disposition ≠ general ability. 35 LLMs benchmarked. ★★★★★ |
| 2604.15657 | Token Allocation in Agentic Verification | DD-864 | Six-category token profiling. Methodology-bound ceilings vs reasoning frontiers. Domain specialization = 4-13x fewer tokens. ★★★★ |

### Apr 26 triage (Fri batch — Apr 24 listings)

### ★★★★★
| 2604.20995 | VLAF: Value-Conflict Diagnostics Reveal Widespread Alignment Faking | DD-879 | 37% alignment faking in 7B models. Single steering vector captures monitoring-sensitive behavior. 85-94% mitigation. COLM 2026. ★★★★★ LANDMARK |

### ★★★★½
| 2604.20972 | Escaping the Agreement Trap: Defensibility Signals | DD-880 | Policy-grounded eval replaces agreement metrics. 33-46pp gap. 80% of "false negatives" are valid. Governance Gate = 78.6% automation. ★★★★½ |

### ★★★★
| 2604.20855 | Caesar: Deep Agentic Web Exploration | — | Knowledge graph + adversarial draft refinement for creative synthesis. Outperforms convergent search agents. ★★★★ |
| 2604.20987 | COSPLAY: Co-Evolving Decision + Skill Bank Agents | — | Skill bank co-evolves with decision agent. 25%+ reward improvement with 8B model. Long-horizon tasks. ★★★★ |
| 2604.21003 | The Last Harness: Meta-Evolution of Agent Harnesses | — | Already covered as DD#875. Two-level: harness evolution + meta-evolution of the evolution protocol. ★★★★ |

### ★★★½
| 2604.21129 | AGNT2: Agent Economies on L2 Blockchain | — | Agent-native blockchain execution layer. Interesting but crypto-focused. |
| 2604.21328 | Role of Diversity in Team Performance (ABM) | — | Agent-based model of functional diversity. IFD/DFD measures. |

### Noted (★★★ or below, no DD)
- Various cs.MA papers on traffic optimization, swarm robotics, game theory, Web3 gaming, energy systems, urban thermal comfort — outside focus areas
