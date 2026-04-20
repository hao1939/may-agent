
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
