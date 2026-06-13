# Recent AI Agent Papers — arXiv Briefing

**Generated:** 2026-06-13
**Source:** `https://export.arxiv.org/api/query` (HTTPS only, `sortOrder=descending`)
**Scope:** Papers submitted through 2026-06-11, across queries for "LLM agent", "multi-agent + large language model", "agentic + reasoning + LLM", and "tool use"

---

## 1. EvoArena: Tracking Memory Evolution for Robust LLM Agents in Dynamic Environments

| | |
|---|---|
| **arXiv** | [2606.13681](https://arxiv.org/abs/2606.13681v1) |
| **Submitted** | 2026-06-11 |
| **Authors** | Jundong Xu, Qingchuan Li, Jiaying Wu, Yihuai Lan, Shuyue Stella Li, Huichi Zhou, Bowen Jiang, Lei Wang, Jun Wang, Anh Tuan Luu, Caiming Xiong, Hae Won Park, Bryan Hooi, Zhiyuan Hu |
| **Category** | cs.CL |

**Summary:** Most LLM agent benchmarks assume static environments, but real deployment is dynamic. EvoArena models environment changes as progressive update sequences across terminal, software, and social domains. The authors propose EvoMem, a patch-based memory paradigm that records memory evolution as structured update histories, letting agents reason about how the environment has changed over time. Current agents average only 39.6% accuracy on EvoArena. EvoMem yields +1.5% on EvoArena, +6.1% on GAIA, +4.8% on LoCoMo, and +3.7% chain-level accuracy (consecutive evolutionary subtasks). Mechanistic analysis shows EvoMem preserves more complete evolving environment states in the agent's memory.

**Implication:** Exposes a blind spot in agent evaluation — static benchmarks overstate real-world readiness. The "patch-based memory" concept (structured diffs rather than flat state snapshots) is a design pattern worth adopting for any long-running agent that must operate in changing environments.

---

## 2. HyperTool: Beyond Step-Wise Tool Calls for Tool-Augmented Agents

| | |
|---|---|
| **arXiv** | [2606.13663](https://arxiv.org/abs/2606.13663v1) |
| **Submitted** | 2026-06-11 |
| **Authors** | Yaxin Du, Yifan Zhou, Yujie Ge, Jiajun Wang, Xianghe Pang, Shuo Tang, Tuney Zheng, Bryan Dai, Jian Yang, Siheng Chen |
| **Category** | cs.CL |

**Summary:** Step-wise atomic tool calls create an "execution-granularity mismatch" — deterministic tool subroutines get unfolded into many model-visible decisions, consuming context and forcing the LLM to manage low-level dataflow. HyperTool introduces a unified MCP-style interface where the model emits a code block that calls multiple tools, manipulates returned values locally, and passes intermediate results without re-entering the reasoning trace. Trained on synthesized HyperTool-format trajectories verified in real MCP environments. On MCP-Universe: accuracy jumps from 15.69% → 35.29% (Qwen3-32B) and 9.93% → 33.33% (Qwen3-8B), surpassing GPT-OSS and Kimi-k2.5.

**Implication:** Directly relevant to MCP-based tool architectures. The key insight is that letting the agent write *code blocks* that orchestrate multiple tool calls in a single turn dramatically reduces context waste and improves compositional tool use. This is a practical upgrade path for any agent framework using step-wise tool invocation.

---

## 3. Agents-K1: Towards Agent-native Knowledge Orchestration

| | |
|---|---|
| **arXiv** | [2606.13669](https://arxiv.org/abs/2606.13669v1) |
| **Submitted** | 2026-06-11 |
| **Authors** | Zongsheng Cao, Bihao Zhan, Jinxin Shi, Jiong Wang, Fangchen Yu, et al. (25 authors) |
| **Category** | cs.AI |

**Summary:** LLM research agents focus on agent orchestration but neglect scientific knowledge orchestration — papers are reduced to abstracts and flat citation edges, omitting entities, claims, evidence, and method lineages. Agents-K1 is an end-to-end pipeline that converts raw documents into agent-native scientific knowledge graphs. It combines: (1) a multimodal parser with a five-module schema capturing entities, evidence, citations, and typed inter-entity relations across full papers; (2) a 4B information-extraction backbone trained with GRPO under rule-based reward; and (3) graphanything CLI, a tri-source agent interface unifying web search, multimodal graph retrieval, and cross-document traversal. They process 2.46M papers across six subjects to produce Scholar-KG (1M-paper subset released). Demonstrates superior performance in scientific information extraction, KG construction, and multi-hop scientific reasoning.

**Implication:** Shows how structured knowledge graphs (not flat RAG) become a first-class tool for agent systems. The "agent-native" KG concept — where the graph schema is designed for agentic traversal from the start — is a significant departure from traditional KG approaches.

---

## 4. SpatialClaw: Rethinking Action Interface for Agentic Spatial Reasoning

| | |
|---|---|
| **arXiv** | [2606.13673](https://arxiv.org/abs/2606.13673v1) |
| **Submitted** | 2026-06-11 |
| **Authors** | Seokju Cho, Ryo Hachiuma, Abhishek Badki, Hang Su, Byung-Kwan Lee, Chan Hee Song, Sifei Liu, Subhashree Radhakrishnan, Seungryong Kim, Yu-Chiang Frank Wang, Min-Hung Chen |
| **Categories** | cs.CV, cs.AI |

**Summary:** Spatial reasoning (3D object relations, motion) remains hard for VLMs. Existing tool-augmented agents either use single-pass code execution (committing to a strategy before seeing intermediate results) or structured tool-call interfaces (limited flexibility). SpatialClaw is a training-free framework that uses code as the action interface: a stateful Python kernel pre-loaded with perception and geometry primitives, where the VLM writes one executable cell per step conditioned on all prior outputs. Across 20 benchmarks for static and dynamic 3D/4D spatial reasoning, it achieves 59.9% average accuracy (+11.2 over the next best spatial agent), with consistent gains across six VLM backbones from two model families.

**Implication:** Reinforces the "code-as-action" paradigm — a stateful REPL where the agent writes cells step-by-step with observation of intermediate results outperforms both single-pass code gen and structured tool calls. Training-free, VLM-agnostic design makes it immediately applicable.

---

## 5. Reward Modeling for Multi-Agent Orchestration (OrchRM)

| | |
|---|---|
| **arXiv** | [2606.13598](https://arxiv.org/abs/2606.13598v1) |
| **Submitted** | 2026-06-11 |
| **Authors** | King Yeung Tsang, Zihao Zhao, Vishal Venkataramani, Haizhou Shi, Zixuan Ke, Semih Yavuz, Shafiq Joty, Hao Wang |
| **Categories** | cs.AI, cs.CL, cs.LG, cs.MA |

**Summary:** Multi-agent systems (MAS) need orchestrators to coordinate specialized agents, but training orchestrators is bottlenecked by limited supervision and cost. OrchRM is a self-supervised framework that evaluates orchestration quality without human annotations. It uses intermediate artifacts from multi-agent executions to construct win-lose pairs for Bradley-Terry reward model training. Unlike methods that rely on costly sub-agent rollouts, OrchRM operates at the orchestration level. Results: up to 10× token efficiency improvement and up to 8% accuracy gain across mathematical reasoning, web-based QA, and multi-hop reasoning.

**Implication:** Solves the "who trains the orchestrator?" problem. Self-supervised reward modeling from intermediate execution artifacts is a scalable approach that could be applied to any multi-agent pipeline — no human labeling needed.

---

## 6. ARMOR-MAD: Adaptive Routing for Heterogeneous Multi-Agent Debate

| | |
|---|---|
| **arXiv** | [2606.13197](https://arxiv.org/abs/2606.13197v1) |
| **Submitted** | 2026-06-11 |
| **Authors** | Fuqiang Niu, Bowen Zhang |
| **Category** | cs.AI |

**Summary:** Multi-agent debate (MAD) can improve LLM reasoning, but fixed debate pipelines waste computation and amplify correlated errors among similar agents. ARMOR-MAD is a training-free heterogeneous MAD framework with three components: (1) Pre-debate Agreement Routing (PAR) — skips debate if round-0 answers already agree; (2) Early Agreement Stopping Evaluator (EASE) — stops debate early upon convergence; (3) Semantic Outlier Detection (SOD) — down-weights anomalous final answers during aggregation. Results: 65.5% on MATH Level 5, 96.5% on GSM8K, 90.0% on MMLU, 81.5% on MMLU-Pro — consistently beating fixed-round homogeneous debate.

**Implication:** The "debate is conditional computation" framing is powerful. Most multi-agent reasoning systems waste tokens on trivially agreed questions. The agreement-based routing + early stopping pattern could halve multi-agent inference costs while improving accuracy.

---

## 7. Less Context, Better Agents: Efficient Context Engineering for Long-Horizon Tool-Using LLM Agents

| | |
|---|---|
| **arXiv** | [2606.10209](https://arxiv.org/abs/2606.10209v1) |
| **Submitted** | 2026-06-08 |
| **Authors** | Abhilasha Lodha, Mahsa Pahlavikhah Varnosfaderani, Abir Chakraborty, Abhinav Mithal |
| **Categories** | cs.AI, cs.LG, cs.SE |

**Summary:** Autonomous agents for enterprise workflows face context overflow from verbose tool responses. Studied on automated expense itemization in Microsoft Dynamics 365 using MCP tools with GPT-5. Four configurations tested: no user model (8.0% completion), full history (71.0%, 1.48M tokens, 14.56 hours), pruning to last 5 tool calls (79.0%, 535K tokens, 5.39 hours), pruning + summarization (91.6% completion, 99.64% amount accuracy, 553K tokens, 5.79 hours). Cross-validated with Claude Sonnet 4.5.

**Implication:** Hard evidence that full context retention *hurts* — selective recency + summarization beats it on both accuracy and cost by a wide margin. The 5-call pruning window is a practical starting point. Directly applicable to any agent with lengthy tool interaction histories.

---

## 8. SecureClaw: Clawing Back Control of LLM Agents

| | |
|---|---|
| **arXiv** | [2606.09549](https://arxiv.org/abs/2606.09549v1) |
| **Submitted** | 2026-06-08 |
| **Authors** | Yuhan Ma, Stefan Schmid |
| **Category** | cs.CR, cs.AI |

**Summary:** Tool-using LLM agents have two security failure modes: unauthorized external actions and plaintext secret exposure within the runtime before output checks can intervene. SecureClaw is a dual-boundary architecture: (1) at the read boundary, a trusted gateway replaces raw values with opaque handles and bounded summaries; (2) at the write boundary, a PREVIEW→COMMIT protocol ensures only a trusted executor commits authorized requests. The agent can plan over summaries and symbolic references but cannot dereference secrets or perform side effects directly. Achieves 0% attack success rate on ASB, 0.64% on AgentDojo, and 3.23% leak rate on AgentLeak — the only defense that simultaneously preserves task utility and blocks all three attack surfaces.

**Implication:** The opaque-handle pattern (agent sees summaries, never raw secrets) is the strongest agent security primitive yet demonstrated. The PREVIEW→COMMIT protocol for writes is analogous to how databases handle transactions. Any production agent handling sensitive data should consider this dual-boundary pattern.

---

## 9. InterleaveThinker: Reinforcing Agentic Interleaved Generation

| | |
|---|---|
| **arXiv** | [2606.13679](https://arxiv.org/abs/2606.13679v1) |
| **Submitted** | 2026-06-11 |
| **Authors** | Dian Zheng, Harry Lee, Manyuan Zhang, Kaituo Feng, Zoey Guo, Ray Zhang, Hongsheng Li |
| **Category** | cs.CV |

**Summary:** A multi-agent pipeline for interleaved text-image generation that can wrap any existing image generator. Uses a planner agent to organize the image-text sequence and a critic agent to evaluate outputs, identify deviations, and refine instructions for regeneration. The critic is trained with GRPO using accuracy and step-wise rewards — since a trajectory can involve 25+ generator calls, single-step RL is used to guide the full trajectory. Performance comparable to Nano Banana and GPT-5 on interleaved generation benchmarks, with surprising improvements on reasoning benchmarks (WISE, RISE).

**Implication:** The planner-critic multi-agent pattern with RL-trained critics is broadly applicable beyond image generation. The insight that step-wise reward can guide full trajectory optimization without optimizing the entire trajectory end-to-end reduces the computational cost of training agent systems.

---

## 10. TabClaw: An Interactive and Self-Evolving Agent for Spreadsheet Manipulation and Table Reasoning

| | |
|---|---|
| **arXiv** | [2606.10316](https://arxiv.org/abs/2606.10316v1) |
| **Submitted** | 2026-06-09 |
| **Authors** | Mingyue Cheng, Shuo Yu, Daoyu Wang, Qingchuan Li, Xiaoyu Tao, Qingyang Mao, Yitong Zhou, Qi Liu |
| **Category** | cs.CL |

**Summary:** An open-source agent for spreadsheet/table tasks where users issue natural-language requests. Key capabilities: intent clarification, editable execution plans, ReAct-style tool-using analysis, specialist agents for parallel multi-table reasoning, and synthesis with explicit consensus/uncertainty markers. Self-evolution features: records completed workflows, extracts persistent user memory, distills reusable skills from repeated tool-use patterns, supports package-style skill import, and upgrades skills from negative feedback.

**Implication:** The self-evolving skill distillation from usage patterns — where the agent observes its own repeated tool-use workflows and packages them as reusable skills — is a compelling pattern for building agents that improve with use without explicit retraining.

---

## Cross-Cutting Themes

### 🔑 Theme 1: Code-as-Action Interface
Both **HyperTool** and **SpatialClaw** converge on the same insight: replacing structured tool-call schemas with executable code blocks (where the agent writes code that orchestrates tools) dramatically improves multi-step reasoning. HyperTool does this via MCP-compatible code blocks; SpatialClaw does it via a stateful Python REPL. Both report double-digit accuracy gains.

### 🔑 Theme 2: Memory & Context Are Solved Problems (With the Right Architecture)
**EvoArena** shows patch-based memory beats flat snapshots for dynamic environments. **Less Context, Better Agents** shows pruning + summarization beats full history for enterprise tool use. Together they suggest: *memory should be structured, compressed, and evolution-aware, not a raw append log.*

### 🔑 Theme 3: Multi-Agent Orchestration Gets Its Own Optimization Layer
**OrchRM** and **ARMOR-MAD** both tackle the meta-problem: how do you train/optimize the *orchestrator* of a multi-agent system? OrchRM uses self-supervised reward modeling from execution artifacts; ARMOR-MAD uses agreement routing + early stopping. Both operate at the orchestration level, not the individual-agent level.

### 🔑 Theme 4: Agent Security Requires Architectural Boundaries, Not Prompt Engineering
**SecureClaw** demonstrates that agent security cannot be bolted on — it requires architectural separation (opaque handles at reads, PREVIEW→COMMIT at writes). This is the first defense shown to achieve 0% ASR while maintaining task utility.

### 🔑 Theme 5: Self-Supervised & Self-Evolving Agents
**TabClaw** distills reusable skills from repeated tool-use. **OrchRM** trains reward models from execution artifacts. **InterleaveThinker** uses single-step RL to guide full trajectories. The trend is toward agents that improve from their own operational data without human annotation.
