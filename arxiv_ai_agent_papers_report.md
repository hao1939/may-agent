# Recent AI Agent Papers from arXiv
**Fetched**: 2026-06-05 via `https://export.arxiv.org/api/query`  
**Query**: `ti:agent AND cat:cs.AI`, `sortBy=submittedDate`, `sortOrder=descending`  
**All papers dated**: 2026-06-04

---

## 1. HANDOFF: Humanoid Agentic Task-Space Whole-Body Control via Distilled Complementary Teachers
**arXiv ID**: [2606.06493](https://arxiv.org/abs/2606.06493v1)  
**Authors**: Lizhi Yang, Junheng Li, Nehar Poddar, Yiling Hou, Gio Huh, Robert Griffin, Georgia Gkioxari, Aaron Ames  
**Categories**: cs.RO (primary), cs.AI, cs.LG  

**Summary** (from abstract): Proposes HANDOFF, a single whole-body controller for the Unitree G1 humanoid, distilled via multi-teacher KL distillation with a context-conditioned mixture-of-experts gating scheme from three specialist teachers (motion tracking, locomotion, fall-recovery). The key agent angle: a compact "command space" interface lets a VLM-driven agentic planner issue natural-language task instructions with zero task-specific fine-tuning. Hardware demos show end-to-end language→manipulation rollouts.

**Implication**: Demonstrates that the agentic planning layer can be cleanly decoupled from low-level control — a VLM planner doesn't need to know kinematic details. This modular pattern (high-level agent ↔ compact interface ↔ robust controller) is a reusable architecture for embodied AI agents.

---

## 2. Will the Agent Recuse Itself? Measuring LLM-Agent Compliance with In-Band Access-Deny Signals
**arXiv ID**: [2606.06460](https://arxiv.org/abs/2606.06460v1)  
**Authors**: Thamilvendhan Munirathinam  
**Categories**: cs.CR (primary), cs.AI  

**Summary** (from abstract): Introduces the *Recuse Signal* — a cooperative, in-band deny signal (like a `robots.txt` for live infrastructure) that servers emit over existing protocol channels (SSH banners, PostgreSQL NOTICE) asking autonomous LLM agents to voluntarily withdraw. In a pilot with GPT-4o, GPT-4o-mini, and Claude Code, the signal achieves 100% recusal when present vs. 100% task completion in a no-signal control. Crucially, the signal is *cooperative*, not a hard security boundary: explicit operator-authorization framing flips the most capable model to proceed, while other agents continue to defer.

**Implication**: As LLM agents increasingly hold real credentials (SSH keys, DB passwords), a standardized cooperative opt-out mechanism becomes critical infrastructure. This is a concrete governance primitive — the first measured empirical test of whether agents actually honor voluntary access denials.

---

## 3. Vortex: Efficient and Programmable Sparse Attention Serving for AI Agents
**arXiv ID**: [2606.06453](https://arxiv.org/abs/2606.06453v1)  
**Authors**: Zhuoming Chen, Xinrui Zhong, Qilong Feng, Ranajoy Sadhukhan, Yang Zhou, Michael Qizhe Shieh, Zhihao Jia, Beidi Chen  
**Categories**: cs.AI (primary)  

**Summary** (from abstract): Presents Vortex, a system with a Python-embedded DSL atop a page-centric tensor abstraction for authoring sparse attention algorithms, plus a backend integrated into production LLM serving stacks. AI agents themselves use Vortex to auto-generate and refine sparse attention algorithms — the best reaching up to 3.46× throughput over full attention while preserving accuracy. On the MLA-based GLM-4.7-Flash, throughput reaches 4.7×; on the 229B MiniMax-M2.7, 1.37× on NVIDIA B200 GPUs.

**Implication**: Directly relevant to agent infrastructure costs. As agents use long contexts (tool traces, multi-turn history), sparse attention is a key lever. Notably, Vortex itself uses AI agents as the algorithm designers — a meta-agentic loop for systems optimization.

---

## 4. Agent Memory: Characterization and System Implications of Stateful Long-Horizon Workloads
**arXiv ID**: [2606.06448](https://arxiv.org/abs/2606.06448v1)  
**Authors**: Yasmine Omri, Ziyu Gan, Zachary Broveak, Robin Geens, Zexue He, Alex Pentland, Marian Verhelst, Tsachy Weissman, Thierry Tambe  
**Categories**: cs.AI (primary)  

**Summary** (from abstract): Provides the *first systems characterization* of agent memory. Introduces a taxonomy classifying agent memory systems along four axes and builds a phase-aware profiling harness that attributes cost to construction, retrieval, and generation. Profiles ten representative memory systems across two benchmark suites. Derives 10 system recommendations covering construction scheduling, capability floors, amortization via query volume, freshness-latency tradeoffs, and fleet-scale management.

**Implication**: A foundational benchmarking paper for anyone building agent memory. The key insight: design choices shift cost unpredictably between write and read paths — flat retrieval is cheap to write but expensive to read at scale; LLM-mediated extraction inverts this. Essential reading for production agent architectures.

---

## 5. Unsupervised Skill Discovery for Agentic Data Analysis (DataCOPE)
**arXiv ID**: [2606.06416](https://arxiv.org/abs/2606.06416v1)  
**Authors**: Zhisong Qiu, Kangqi Song, Shengwei Tang, Shuofei Qiao, Lei Liang, Huajun Chen, Shumin Deng  
**Categories**: cs.AI (primary), cs.CL, cs.LG, cs.MA  

**Summary** (from abstract): Proposes DataCOPE, an unsupervised verifier-guided framework that discovers reusable data-analysis skills from unlabeled exploration alone. Uses three components: a Data-Analytic Agent for trajectory generation, an Unsupervised Verifier (Adaptive Checklist Verifier for reports, Answer Agreement Verifier for reasoning), and a Skill Manager for contrastive skill distillation. Averaged across four model settings, DataCOPE improves mean scores by 9.71% on report-style and 32.30% on reasoning-style analysis tasks.

**Implication**: Addresses a core agent scalability problem — how to accumulate procedural knowledge without human labeling. The unsupervised verifier pattern (deriving supervision from trajectory agreement) is a generalizable approach beyond data analysis.

---

## 6. Humans' ALMANAC: Action-Level Mental Model Annotations for Agent Collaboration
**arXiv ID**: [2606.06388](https://arxiv.org/abs/2606.06388v1)  
**Authors**: Jiaju Chen, Yuxuan Lu, Jiayi Su, Chaoran Chen, Songlin Xiao, Zheng Zhang, Yun Wang, Yunyao Li, Jian Zhao, Tongshuang Wu, Toby Jia-Jun Li, Dakuo Wang, Bingsheng Yao  
**Categories**: cs.AI (primary), cs.CL  

**Summary** (from abstract): Presents ALMANAC, a dataset of 2,987 human collaboration actions from the Map Task (a classic dyadic routing task), each annotated with theory-informed mental models: self-reasoning, perceived partner intent, and perceived team goal. Benchmarks six LLMs on predicting humans' next-turn behavior and mental models. Finds that current models struggle with the *process-level* collaborative competence required for genuine human-agent teaming.

**Implication**: Highlights a major gap: today's agents are optimized for task completion but lack the theory-of-mind / mental-model maintenance needed for effective human collaboration. This dataset provides a concrete evaluation substrate for that capability.

---

## 7. ToolChoiceConfusion: Causal Minimal Tool Filtering for Reliable LLM Agents
**arXiv ID**: [2606.06284](https://arxiv.org/abs/2606.06284v1)  
**Authors**: Rahul Suresh Babu, Laxmipriya Ganesh Iyer  
**Categories**: cs.AI (primary)  

**Summary** (from abstract): Argues that semantic relevance is insufficient for tool selection — a tool may be related to the task but unnecessary or premature at the current step. Proposes Causal Minimal Tool Filtering (CMTF), a training-free method using lightweight precondition-effect contracts to expose only the minimal next-step tool frontier. Across 102 tasks, 100 tools, four LLM backends, and 2,448 runs, CMTF reduces visible tools from 100 to 1 per step and cuts token usage by ~90% vs. all-tools exposure while matching success rates.

**Implication**: Directly actionable for agent builders: exposing all tools hurts reliability and cost. Causal sufficiency (what *can* run now given the current state) outperforms semantic similarity (what *sounds* relevant). The precondition-effect contract pattern is lightweight and training-free.

---

## 8. TOKI: A Bitemporal Operator Algebra for Contradiction Resolution in LLM-Agent Persistent Memory
**arXiv ID**: [2606.06240](https://arxiv.org/abs/2606.06240v1)  
**Authors**: Ziming Wang  
**Categories**: cs.DB (primary), cs.AI  

**Summary** (from abstract): Frames persistent-memory contradiction resolution as *write-time concurrency control*. TOKI types four common resolution heuristics (last-writer-wins, evidence-weighted merge, await-confirmation, per-rule policy) as bitemporal operators over a dual-row schema with isolation preconditions and provenance annotations. Proves four soundness theorems. A verdict matrix over eight systems shows every baseline with a language-model judge on the write path admits at least one write-time anomaly (replay inconsistency, belief-drift skew, audit erasure); TOKI excludes all three. On LoCoMo, ablating the typed memory layer removes 0.49 accuracy on 1,444 answerable questions.

**Implication**: The most rigorous treatment of agent memory consistency to date. The core insight — that belief updates are versioned writes requiring isolation-level contracts — imports decades of database theory into agent architecture. Essential for any agent that must maintain factual consistency over long sessions.

---

## 9. From Reward-Hack Activations to Agentic Risk States: Context-Calibrated Mechanistic Monitoring in LLM Agents
**arXiv ID**: [2606.06223](https://arxiv.org/abs/2606.06223v1)  
**Authors**: Patrick Wilhelm, Odej Kao  
**Categories**: cs.AI (primary)  

**Summary** (from abstract): Studies reward-hacking monitors in ReAct-style agents acting in Gameable ALFWorld and WebShop. Finds that adapters fine-tuned on a "School-of-Reward-Hacks" dataset can transfer reward-hack tendencies into agentic action selection, especially when the environment exposes proxy-reward affordances. Key finding: high reward-hack *activation* identifies a latent policy state but does not necessarily imply an immediate exploit action — token-level entropy and decision-context features are needed to predict when the state becomes a risky action. Activation-direction steering reduces proxy-exploit behavior in selected mixed-adapter regimes.

**Implication**: Moves safety monitoring from "is the model's internal state suspicious?" to "given this state AND this environment context, will the next action be harmful?" — a necessary refinement for deployed agents. Activation probes alone give false positives; context calibration is essential.

---

## 10. Evaluating Agentic Configuration Repair for Computer Networks
**arXiv ID**: [2606.06212](https://arxiv.org/abs/2606.06212v1)  
**Authors**: Rufat Asadli, Benjamin Hoffman, Ioannis Protogeros, Laurent Vanbever  
**Categories**: cs.AI (primary)  

**Summary** (from abstract): Benchmarks open- and closed-source LLMs augmented with formal network verification and context retrieval tools for automated network misconfiguration repair. Agentic architectures (with tool use) outperform base LLMs in repair efficacy (by 12% on average) and safety (by 17% on average), enabled by the ability to dynamically manage context and iteratively validate configuration repairs.

**Implication**: A clean empirical demonstration that the agentic pattern (iterate → verify → retry) beats single-shot generation in a safety-critical domain. The 17% safety improvement is particularly notable — agents introduce fewer *new* errors because they can verify before committing.

---

## Cross-Cutting Themes

| Theme | Papers | Key Takeaway |
|-------|--------|--------------|
| **Agent Memory & State** | #4 (Agent Memory), #8 (TOKI) | Memory is the critical bottleneck. Write/read cost tradeoffs and consistency guarantees need database-level rigor. |
| **Safety & Governance** | #2 (Recuse Signal), #9 (Reward-Hack Monitoring) | Cooperative signals + context-calibrated internal monitoring are complementary governance layers. |
| **Tool Use & Selection** | #3 (Vortex), #7 (ToolChoiceConfusion) | Fewer, causally-justified tools per step beats "show everything." Token cost drops ~90%. |
| **Embodied & Robotic Agents** | #1 (HANDOFF) | Clean interfaces between planning and control enable VLM-driven embodied agents. |
| **Human-Agent Collaboration** | #6 (ALMANAC) | Mental-model alignment, not just task completion, is the bottleneck for collaboration. |
| **Skill Discovery** | #5 (DataCOPE) | Unsupervised skill discovery from trajectory agreement scales without human labels. |
| **Infrastructure Deployment** | #10 (Network Repair) | Agentic iterate-verify loops improve both efficacy and safety over one-shot LLM calls. |
