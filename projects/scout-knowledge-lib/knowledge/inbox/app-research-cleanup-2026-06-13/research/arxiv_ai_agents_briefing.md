# arXiv AI Agent Research Briefing
**Generated:** 2025-06-12 | **Source:** https://export.arxiv.org/api/query | **Corpus:** ~3,200+ papers matching "AI agent", ~3,400+ matching "LLM agent"

---

## Executive Summary

The AI agent landscape on arXiv is experiencing explosive growth. Five targeted queries surfaced **30+ distinct recent papers** spanning benchmarking, memory management, tool use, multi-agent orchestration, reinforcement learning for agents, software engineering integration, privacy, and infrastructure. The field is converging on several clear fronts: **(1)** a benchmarking arms race exposing how far agents still fall short in scientific reasoning and real-world tool use, **(2)** the memory/context bottleneck as the central unsolved engineering problem, **(3)** multi-agent orchestration moving from toy setups to production-grade scheduling and reward modeling, and **(4)** RL-based agent training overtaking prompting as the dominant performance lever.

---

## I. Benchmarking & Evaluation — The Reality Check

The single largest cluster of papers. The community is systematically stress-testing agents across scientific, geospatial, software-engineering, and personal-computing domains.

### 1. EpiBench — Verifiable Evaluation on Epigenomics Analysis
- **arXiv:** [2606.13602](https://arxiv.org/abs/2606.13602) (Jun 11, 2026)
- **Authors:** Muralidharan, Baskar, Lee, Proctor, Workman
- **Summary:** A benchmark of 106 evaluations across CUT&Tag/CUT&RUN, ATAC-seq, ChIP-seq, and DNA methylation workflows. Tested 16 model-harness pairs over 5,088 trajectories. No system passed a majority of attempts — GPT-5.5/Pi led at only 45.0%. Agents could find the right files and compute intermediate results but failed when tasks demanded deeper assay-specific scientific judgment.
- **Implication:** Even frontier models struggle with domain-expert reasoning in biology. The "last mile" of scientific judgment — not file retrieval or code execution — is the bottleneck.

### 2. SciAgentArena — Scientific Challenges Across Scales
- **arXiv:** [2606.12736](https://arxiv.org/abs/2606.12736) (Jun 10, 2026)
- **Authors:** Liu, Wang, Panescu, Chen, Long, Wei, et al.
- **Summary:** ~200 tasks with stepwise verification in an interactive, agent-agnostic environment spanning multiple scientific domains. Agents contributed effectively to well-specified data-analysis workflows but struggled to generate genuinely novel insights, sustain self-directed exploration, or formulate robust solutions for open-ended research questions.
- **Implication:** Agents are best as structured-analysis assistants today, not autonomous researchers. The gap between "follow a protocol" and "do science" remains vast.

### 3. GeoNatureAgent Benchmark — Environmental Geospatial Analysis
- **arXiv:** [2606.12821](https://arxiv.org/abs/2606.12821) (Jun 11, 2026)
- **Authors:** Diaz-Ireland, Prieto-Herráez, García Peces, Velázquez, Jain
- **Summary:** 93 tasks across 18 categories tested against a production-style geospatial API via structured tool calling. Claude Sonnet 4 led at 60.8%, DeepSeek V3.2 followed at 56.3%. Critical finding: comparison tasks were universally unsolved (0% on close-value comparisons). Open-weight models dominated the cost-accuracy Pareto frontier — DeepSeek V3.2 offered 93% of Claude's capability at 11× lower cost ($0.011/case).
- **Implication:** For domain-specific tool-use, open-weight models are becoming cost-competitive. But systematic numerical-reasoning limits remain — agents cannot reliably compare close values.

### 4. AgentBeats — Agentified Agent Assessment (AAA)
- **arXiv:** [2606.13608](https://arxiv.org/abs/2606.13608) (Jun 11, 2026)
- **Authors:** Liu, Tu, Chen, Xie, Ren, et al. (incl. Dawn Song)
- **Summary:** Proposes Agentified Agent Assessment where evaluation is performed by judge agents via standardized protocols (A2A for task management, MCP for tool access). Validated via a 5-month open competition drawing 298 judge agents across 12 categories and 467 subject agents. Uses a single unified interface rather than separate benchmark/agent interfaces.
- **Implication:** Evaluation infrastructure is becoming agent-native. The convergence on A2A + MCP as interoperability standards is notable.

### 5. STAGE-Claw — State-Based Agent Benchmarking
- **arXiv:** [2606.10394](https://arxiv.org/abs/2606.10394) (Jun 9, 2026)
- **Authors:** Liang, Yu, Wang, Guo, Hu, Cao, et al.
- **Summary:** An automated framework for building and evaluating realistic personal-agent scenarios. Agents are evaluated in realistic operating environments where performance is measured by the correctness of the final system state, not just textual responses. Benchmarked 11 frontier models on 40 challenging real-scenario tasks.
- **Implication:** The shift from "text output correctness" to "world-state correctness" is a maturation of agent evaluation methodology.

### 6. EvoArena — Dynamic Environment Adaptation
- **arXiv:** [2606.13681](https://arxiv.org/abs/2606.13681) (Jun 11, 2026)
- **Authors:** Xu, Li, Wu, Lan, Li, Zhou, et al.
- **Summary:** Models environment changes as progressive update sequences across terminal, software, and social domains. Current agents average only 39.6% accuracy on evolving tasks. The proposed EvoMem (patch-based memory recording evolution as structured update histories) yields gains of 1.5% on EvoArena and 6.1%/4.8% on GAIA/LoCoMo.
- **Implication:** Static benchmarks hide a critical weakness: agents are poor at tracking environmental change over time. Memory-of-evolution is a new architectural requirement.

---

## II. Memory & Context Management — The Core Engineering Challenge

### 7. MemRefine — LLM-Guided Compression for Long-Term Memory
- **arXiv:** [2606.13177](https://arxiv.org/abs/2606.13177) (Jun 11, 2026)
- **Authors:** Kim, Baek, Jeong, Hwang
- **Summary:** Addresses storage-budgeted memory management. Uses similarity only to propose candidate pairs and defers delete/merge/preserve decisions to an LLM judge based on factual content, iterating until budget is met. Consistently meets target budgets while preserving downstream performance, outperforming rule-based baselines under tight budgets.
- **Implication:** Memory management is transitioning from rule-based (FIFO, LRU) to LLM-judged semantic compression. This is analogous to how garbage collection evolved in programming languages.

### 8. Less Context, Better Agents — Enterprise Context Engineering
- **arXiv:** [2606.10209](https://arxiv.org/abs/2606.10209) (Jun 8, 2026)
- **Authors:** Lodha, Pahlavikhah Varnosfaderani, Chakraborty, Mithal (Microsoft)
- **Summary:** Studied context management for GPT-5 on automated expense itemization in Microsoft Dynamics 365 using MCP tools. Full-context retention achieved 71.0% but consumed 1.48M tokens. Pruning to last 5 tool calls *improved* completion to 79.0% while halving tokens. Adding summarization reached 91.6% completion with only 553K tokens and 5.79 hours (vs. 14.56 hours for full context).
- **Implication:** **More context hurts.** This is a counterintuitive but now well-evidenced finding. Selective retention + summarization beats full-history retention for enterprise tool-use workflows. Context engineering > context length.

### 9. HIPIF — Hierarchical Planning and Information Folding
- **arXiv:** [2606.10507](https://arxiv.org/abs/2606.10507) (Jun 9, 2026)
- **Authors:** Diao, Lu, Li, Zhou, Tian, Li, Weng, Wang, Cai
- **Summary:** Addresses "long-context interference" — where growing histories weaken agents' ability to track global task state. Trains agents to organize execution around explicit subgoals while "folding" completed subgoal histories. Combines hierarchical reflection and subgoal-oriented process rewards. No reliance on costly auxiliary models or expert trajectories.
- **Implication:** "Information folding" is the right metaphor — agents need to compress past into summaries while keeping the planning horizon clear. This parallels how humans chunk completed subtasks.

---

## III. Tool Use & Execution — Beyond Step-by-Step

### 10. HyperTool — Beyond Step-Wise Tool Calls
- **arXiv:** [2606.13663](https://arxiv.org/abs/2606.13663) (Jun 11, 2026)
- **Authors:** Du, Zhou, Ge, Wang, Pang, Tang, Zheng, Dai, Yang, Chen
- **Summary:** Identifies the "execution-granularity mismatch" problem — deterministic tool workflows unfolded into individual model-visible decisions waste context. HyperTool is an MCP-style interface where the model invokes a single outer call containing a code block that can call multiple tools, manipulate returned values, and pass intermediate results locally. Improved Qwen3-32B from 15.69% to 35.29% on MCP-Universe, surpassing GPT-OSS and Kimi-k2.5.
- **Implication:** The tool-calling interface itself is a performance bottleneck. Batching deterministic tool subroutines into code blocks is a simple insight with dramatic results — a 2× improvement on smaller models.

### 11. KATE — Knowledge-Augmented Tool Execution
- **arXiv:** [2606.10875](https://arxiv.org/abs/2606.10875) (Jun 9, 2026)
- **Authors:** Hao, Jin, Liao, Liu, Zhao
- **Summary:** Systematic study on how knowledge influences tool-use performance. Key findings: (1) simple instance-level knowledge provides strong gains; abstract intent-level knowledge offers limited benefit; (2) expanding reasoning *width* (parallel sampling + aggregation) outperforms expanding reasoning *depth*; (3) RL outperforms SFT for knowledge internalization. The KATE framework integrates these insights.
- **Implication:** For tool use, *breadth-first* reasoning beats *depth-first*. This challenges the "longer chain-of-thought = better" assumption. Also: concrete examples > abstract descriptions for tool knowledge.

### 12. NovelAPIBench — Diagnosing Knowledge Gaps in Tool Use
- **arXiv:** [2606.03657](https://arxiv.org/abs/2606.03657) (Jun 2, 2026)
- **Authors:** Liu, Peng, Niu, et al.
- **Summary:** A fully automated dynamic benchmark that discovers novel APIs, extracts decomposed knowledge bundles, and generates executable coding tasks. Usage examples are the strongest standalone knowledge signal. Adding more context (especially source code) can actually hurt by increasing import-path errors. Fine-tuning teaches models how to *use* provided bundles (procedural integration), not the knowledge itself.
- **Implication:** Retrieval and tuning are complementary: retrieval supplies volatile API content, tuning improves procedural integration. Dumping source code into context is counterproductive.

---

## IV. Multi-Agent Systems — From Toy to Production

### 13. OrchRM — Orchestration Reward Modeling
- **arXiv:** [2606.13598](https://arxiv.org/abs/2606.13598) (Jun 11, 2026)
- **Authors:** Tsang, Zhao, Venkataramani, Shi, Ke, Yavuz, Joty, Wang
- **Summary:** A self-supervised framework for evaluating multi-agent orchestration quality. Leverages intermediate artifacts from executions to construct win-lose pairs for Bradley-Terry reward model training. Operates directly at the orchestration level (not sub-agent rollouts), achieving 10× training efficiency improvement in token usage and up to 8% accuracy gains across math reasoning, web QA, and multi-hop reasoning.
- **Implication:** The orchestrator — not the individual agents — is becoming the trainable bottleneck in MAS. Orchestration-level reward modeling is a scalable new paradigm.

### 14. Internet of Agentic AI (IoAI) — Vision Paper
- **arXiv:** [2606.12835](https://arxiv.org/abs/2606.12835) (Jun 11, 2026)
- **Author:** Zhu (single author)
- **Summary:** Develops a vision of an open ecosystem where heterogeneous agents discover one another, negotiate responsibilities, exchange context, invoke tools, and execute workflows across cloud, edge, device, organizational, and cyber-physical environments. Synthesizes distributed computing, game theory, and security engineering. Identifies central research challenges: controlled emergence, semantic interoperability, secure identity, incentive-compatible coordination, resource-aware orchestration, and governance.
- **Implication:** The "Internet of Agents" framing — agents as networked services with discovery, negotiation, and trust — is the natural next step beyond single-agent and team-of-agents paradigms.

### 15. MIDSim — Multi-Channel Information Diffusion Simulation
- **arXiv:** [2606.13140](https://arxiv.org/abs/2606.13140) (Jun 11, 2026)
- **Authors:** Liu, Cao, Liu, Shen, Cheng
- **Summary:** An LLM-powered multi-agent system for simulating multi-channel information diffusion across Sina Weibo, RedNote, and Twitter. Jointly models social and algorithmic exposure streams (including recommender systems). Realistically simulates macro diffusion phenomena and generates diverse comment content.
- **Implication:** LLM agents as social-simulation substrates — used not to *act* but to *model* human behavior at scale. This has implications for misinformation research and platform policy testing.

### 16. Cognitively-Aligned Multi-Agent Robotics via BCI
- **arXiv:** [2606.13190](https://arxiv.org/abs/2606.13190) (Jun 11, 2026)
- **Authors:** Kosmyna, Jenkins, Sinha
- **Summary:** Uses consumer-grade EEG brain-computer interfaces to monitor human cognitive load in real time. When high engagement is detected, the primary agent defers communications, while secondary agents process delegated tasks in the background. Demonstrates feasibility of neurophysiologically-aware agent systems.
- **Implication:** The human-in-the-loop is getting a physiological signal channel. Agents that can sense when to interrupt (and when not to) based on brain state represent a new frontier for HCI.

---

## V. RL-Based Agent Training — The New Performance Lever

### 17. 3SPO — State-Score-Supervised Policy Optimization
- **arXiv:** [2606.09961](https://arxiv.org/abs/2606.09961) (Jun 8, 2026)
- **Authors:** Han, Li, Jiao, Dai, Fu, Zhuo, Qian
- **Summary:** Performs post-step policy optimization with dynamic state-score supervision. At each step, computes state score from historical success rates, supervising step-wise credit assignment without value function estimation. Outperforms GRPO by +22.6% on ALFWorld and +15.6 points on WebShop, with 2.4× more state exploration and 1.8× faster convergence.
- **Implication:** Step-level credit assignment is dramatically better than trajectory-level for agent RL. The field is moving from "reward at the end" to "reward at every step."

### 18. TRACE — Tree Rollout Allocation for Agentic RL
- **arXiv:** [2606.11119](https://arxiv.org/abs/2606.11119) (Jun 9, 2026)
- **Authors:** Zou, Wang, Qu, Jiang, Cai, Mao, Peng, et al.
- **Summary:** Models each ReAct-style thought-action-observation turn as a node, enabling budget allocation from prompt roots to turn-level prefixes. A generalizable predictor estimates conditional success probability at anchor points to guide allocation. Improved Qwen3-14B Multi-Hop QA by 2.8 points over baselines at equal sampling cost.
- **Implication:** Tree-structured rollouts with smart budget allocation are a more efficient alternative to flat parallel sampling for agent training.

### 19. SkillCAT — Contrastive Skill Self-Evolution
- **arXiv:** [2606.13317](https://arxiv.org/abs/2606.13317) (Jun 11, 2026)
- **Authors:** Chen, Zhong, Liu, Du
- **Summary:** A training-free framework using three stages: Contrastive Causal Extraction (comparing success/failure pairs), Assessment-Augmented Evolution (replaying patches on task clones before merging), and Topology-Aware Task Execution (routing to relevant skill sub-nodes at inference). Raises average scores by up to 40.40% over baselines without any model training.
- **Implication:** Skill libraries can be evolved without gradient updates — by systematically comparing what worked vs. what didn't and testing patches before committing them. This is essentially test-driven skill development.

---

## VI. Software Engineering Agents — Field Data

### 20. Understanding Rejection of Agentic Pull Requests
- **arXiv:** [2606.13468](https://arxiv.org/abs/2606.13468) (Jun 11, 2026)
- **Authors:** Abujadallah, Arabat, Sayagh — MSR '26
- **Summary:** Analyzed the AIDev dataset; 46.41% of fixes proposed by Copilot, Devin, Cursor, and Claude are rejected. Qualitative study of 306 non-merged PRs identified 14 rejection reasons in 4 categories: incorrect implementation, CI/test failures, agent inability to complete (session loss, no code generated), and low priority. Key guidance: agents need hints about approach, constraints about what NOT to do, and instructions on CI validation.
- **Implication:** Nearly half of agent-generated PRs are wasted effort. The main failure modes are *approach selection* and *validation*, not code generation itself. Agents need guardrails, not just capabilities.

### 21. Instructions-as-Code — Impact of Instruction Files on Agentic PRs
- **arXiv:** [2606.13449](https://arxiv.org/abs/2606.13449) (Jun 11, 2026)
- **Authors:** Arabat, Sayagh — MSR '26
- **Summary:** Analyzed 15,549 agentic PRs from 148 projects. Instruction files for AI agents do NOT necessarily improve results: 27.7% of projects increased merge rate by ≥20%, but 26.35% *decreased* it. Projects that improved had substantially longer, well-structured instruction files with more sections and sub-sections.
- **Implication:** The quality of agent instructions matters enormously — bad instructions are worse than none. The paper coins "Instructions-as-Code" as a new software engineering discipline, treating agent instruction files as first-class engineering artifacts.

### 22. Getting Better at Working With You — Compiling User Corrections
- **arXiv:** [2606.13174](https://arxiv.org/abs/2606.13174) (Jun 11, 2026)
- **Summary (from title/context):** Compiles user corrections into runtime enforcement for coding agents — learning from human feedback during operation.

---

## VII. Privacy, Security & Safety

### 23. OCELOT — Privacy-Preserving LLM Agents
- **arXiv:** [2606.12341](https://arxiv.org/abs/2606.12341) (Jun 10, 2026)
- **Authors:** Xie, Li
- **Summary:** Recasts agent privacy as posterior-risk control. OCELOT is a runtime mediator that budgets how much an adversary's belief about a secret may improve across an *entire trajectory*, not per-release. Uses "Witness-Verified Declassification" — an untrusted defender model proposes, a deterministic verifier audits, charging certified min-entropy cost. Resists adaptive injection, jailbreak, cumulative inference, and sink collusion with modest overhead.
- **Implication:** Agent privacy is fundamentally different from single-output privacy because leakage is cumulative across a trajectory. OCELOT's budget-based approach (analogous to a privacy spending account) is a principled framework.

---

## VIII. Infrastructure & Efficiency

### 24. Can I Buy Your KV Cache? — Prefill CDN for Agents
- **arXiv:** [2606.13361](https://arxiv.org/abs/2606.13361) (Jun 11, 2026)
- **Author:** Zhang (single author)
- **Summary:** Identifies that AI agents globally repeat redundant prefill computation over identical documents. Proposes precomputing KV caches and letting agents load them. The reuse is token-exact (24/24 greedy tokens match). On Qwen3-4B, reuse is 9–50× cheaper than prefill, with the gap widening with length (attention scales L²). Serving one hot 3,774-token document to 80M agents costs ~$1.5M to re-prefill but only ~$0.03M of reuse compute (49.7× less). Frames an "agent-native prefill CDN."
- **Implication:** A CDN for KV caches is the agent infrastructure equivalent of a web CDN for HTML. The economics are compelling at scale. The open problems (lossless KV compression, cross-party payment) are tractable.

### 25. MiniMax Sparse Attention (MSA)
- **arXiv:** [2606.13392](https://arxiv.org/abs/2606.13392) (Jun 11, 2026)
- **Authors:** Lai, Xu, Yang, Chen, Xu, Zeng, et al. (MiniMax)
- **Summary:** A blockwise sparse attention mechanism designed for ultra-long contexts needed by agentic workflows. A lightweight Index Branch scores KV blocks per GQA group; the Main Branch performs exact block-sparse attention on selected blocks. On a 109B model, matches GQA quality while reducing per-token attention compute by 28.4× at 1M context. Achieves 14.2× prefill and 7.6× decoding speedups on H800.
- **Implication:** The million-token context window demanded by agents is becoming practically efficient. MSA makes it deployable at production scale.

### 26. Maestro — Cross-Cluster Scheduling for Multi-Agent Systems
- **arXiv:** [2606.12950](https://arxiv.org/abs/2606.12950) (Jun 11, 2026)
- **Summary (from title):** Workload-aware cross-cluster scheduling specifically designed for LLM-based multi-agent systems — treating MAS as a scheduling/infrastructure problem, not just an AI problem.

---

## IX. Domain-Specific Applications

### 27. LLM System for Autonomous Variational Quantum Circuit Design
- **arXiv:** [2606.13380](https://arxiv.org/abs/2606.13380) (Jun 11, 2026)
- **Authors:** Sakka, Mizukami, Mitarai
- **Summary:** A 7-component agentic framework (Exploration, Generation, Discussion, Validation, Storage, Evaluation, Review) for iterative quantum circuit design. The best generated feature map outperforms representative quantum feature maps and surpasses the classical RBF kernel when scaled. Generated ansatze attain competitive accuracy with established constructions while respecting scaling constraints.
- **Implication:** AI agents designing quantum circuits — a concrete example of agents participating in iterative scientific optimization where the search space is too large for manual exploration.

### 28. QBugLM — LLM-Based Quantum Software Debugging
- **arXiv:** [2606.07314](https://arxiv.org/abs/2606.07314) (Jun 5, 2026)
- **Authors:** Pham, Nguyen, Usman
- **Summary:** Multi-agent framework automating quantum software debugging from bug injection through LLM-based detection/repair to simulation-based validation. A single retry raised Pass@1 from below 25% to above 80%. Simpler structured prompting can outperform Chain-of-Thought and ReAct for reasoning-capable models under fixed-resource constraints.
- **Implication:** Even in specialized domains like quantum computing, iterative feedback loops dramatically improve agent performance. The finding that simpler prompting can beat CoT/ReAct is noteworthy.

### 29. Human-Centered Multi-Agent Systems — Survey
- **arXiv:** [2606.08274](https://arxiv.org/abs/2606.08274) (Jun 6, 2026)
- **Authors:** Baloch, Khan, et al.
- **Summary:** A comprehensive survey across cognition, culture, values, and social behavior in AI agents. Reviews 6 areas: evolution of intelligent agents, human cognition/decision-making, language/culture/social context, values/belief systems, human-agent collaboration, multi-agent coordination. Identifies a key gap: no unified framework integrating cognition, culture, values, and social behavior into autonomous agents.
- **Implication:** As agents act on behalf of humans, they must model not just tasks but human social/cultural context. The field needs to import more from cognitive science and sociolinguistics.

### 30. Rubrics Across the Evolving LLM Landscape — Evaluation Framework
- **arXiv:** [2606.08625](https://arxiv.org/abs/2606.08625) (Jun 7, 2026)
- **Authors:** Chen, Han, Yan, Zhu, Sun, Che
- **Summary:** Introduces rubrics as a unifying framework for evaluating and guiding agent behavior at three levels: evaluative (decomposing holistic judgments into verifiable dimensions), training (dense feedback signals for process-level guidance), and intrinsic (emerging dynamically from model behaviors for self-improvement).
- **Implication:** Rubrics as the bridge between human intentions and machine behavior — making assessment transparent and decomposable. Relevant for building better reward signals for agent RL training.

---

## Cross-Cutting Themes & Synthesis

### Theme A: The Context Paradox
Multiple papers independently confirm: **more context often hurts agent performance**. Microsoft's enterprise study (Paper #8) showed pruning to 5 recent tool calls *improved* accuracy. NovelAPIBench (Paper #12) found adding source code increased errors. HIPIF (Paper #9) shows growing histories weaken global state tracking. The field is converging on context *engineering* — selective retention, summarization, and folding — as more important than context *length*.

### Theme B: The Evaluation Maturation
Agent evaluation is moving through three generations: (1) static text-output benchmarks → (2) interactive tool-calling benchmarks with state-based verification (STAGE-Claw) → (3) agent-native evaluation where judge agents evaluate subject agents via standardized protocols (AgentBeats/AAA). The convergence on A2A + MCP as interop standards is notable.

### Theme C: Step-Level > Trajectory-Level
Both 3SPO and TRACE demonstrate that step-level credit assignment dramatically outperforms trajectory-level rewards for agent RL. SkillCAT shows the same principle in a training-free setting — comparing what worked vs. what didn't at a granular level. The field is moving from "did the agent succeed?" to "which step made the difference?"

### Theme D: The Orchestrator is the Bottleneck
OrchRM shows that training the *orchestrator* (not individual agents) yields the biggest gains in MAS. AgentBeats validates that evaluation should happen at the orchestration level. IoAI frames the orchestration challenge at internet scale. The research focus is shifting upward in the stack.

### Theme E: Instructions Are Code
Two MSR '26 papers reveal that ~46% of agent PRs are rejected, and instruction files can actually *decrease* merge rates if poorly structured. The emerging "Instructions-as-Code" discipline treats agent instructions as first-class engineering artifacts requiring the same rigor as production code.

---

## Implications for Agent System Design

| Design Decision | Evidence-Based Recommendation | Source Papers |
|---|---|---|
| Context strategy | Prune + summarize; don't retain full history | #8, #9, #12 |
| Tool calling interface | Batch deterministic subroutines into code blocks | #10 |
| Memory management | LLM-judged semantic compression > rule-based | #7, #6 |
| Agent training | Step-level RL with process rewards | #17, #18 |
| Skill acquisition | Contrastive learning from success/failure pairs | #19 |
| Multi-agent orchestration | Train the orchestrator with reward modeling | #13 |
| Agent instructions | Treat as code; long, well-structured, with sections | #20, #21 |
| Privacy | Budget-based posterior-risk control per trajectory | #23 |
| Evaluation | State-based verification + agent-native judge protocols | #4, #5 |
| Infrastructure | KV cache reuse + sparse attention for long contexts | #24, #25 |

---

*Queries used: `all:"AI agent"`, `all:"LLM agent"`, `all:"autonomous agent" AND all:"large language model"`, `all:"multi-agent" AND all:"LLM"`, `all:"agent benchmark" AND all:"language model"` — all via `https://export.arxiv.org/api/query` with `sortBy=submittedDate&sortOrder=descending`.*
