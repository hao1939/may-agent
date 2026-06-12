# Recent AI Agent Research — arXiv Survey (June 2025)

> **Source:** arXiv API (`https://export.arxiv.org/api/query`), queries for "AI agent", "LLM agent", and "autonomous agent" in cs.AI / cs.CL, sorted by `submittedDate` descending.  
> **Date of retrieval:** Current session  
> **Total unique papers found:** 30 (after deduplication across three queries)

---

## Overview

The papers cluster around **five dominant themes**: (1) agent memory architectures, (2) safety, trust, and monitoring, (3) evaluation benchmarks and frameworks, (4) self-improvement and skill learning, and (5) tool use and system infrastructure. Notably, memory and safety together account for nearly half the papers — a clear signal that the field has moved past "can agents do tasks?" toward "can agents do tasks *reliably and safely over time*?"

---

## Theme 1 — Agent Memory Architectures

Memory is the single most active sub-area, with at least 6 papers dedicated to it.

### 1. Memory is Reconstructed, Not Retrieved: Graph Memory for LLM Agents
- **Authors:** Shuo Ji, Yibo Li, Bryan Hooi
- **Date:** 2025-06-04 | **Link:** https://arxiv.org/abs/2606.06036v1
- **Summary:** Proposes MRAgent, which replaces the standard retrieve-then-reason pipeline with an *active reconstruction* mechanism over a Cue-Tag-Content associative memory graph. Tags act as semantic bridges connecting fine-grained cues to memory contents, allowing the agent to dynamically adapt memory access to intermediate evidence discovered during inference rather than committing to a fixed retrieval set up front.
- **Implication:** Challenges the dominant RAG-style memory paradigm. If reconstruction outperforms retrieval, agent architectures may need to shift from vector-store lookups to graph-walk inference loops.

### 2. TOKI: A Bitemporal Operator Algebra for Contradiction Resolution in LLM-Agent Persistent Memory
- **Authors:** Ziming Wang
- **Date:** 2025-06-04 | **Link:** https://arxiv.org/abs/2606.06240v1
- **Summary:** Frames contradiction resolution in agent memory as a *write-time concurrency control* problem borrowed from database theory. TOKI defines four common resolution heuristics (last-writer-wins, evidence-weighted merge, await-confirmation, per-rule policy) as bitemporal operators over a dual-row schema, each with an explicit isolation contract. This makes write-time anomalies formally visible rather than hidden behind ad-hoc logic.
- **Implication:** Brings rigorous DBMS-style isolation semantics to agent memory — a previously informal area. Production memory systems could adopt these operators to make their consistency guarantees auditable.

### 3. SubtleMemory: Fine-Grained Relational Memory Discrimination
- **Authors:** Wenxuan Wang, Haoyu Sun, Fukuan Hou, Mingyang Song + 3 more
- **Date:** 2025-06-04 | **Link:** https://arxiv.org/abs/2606.05761v1
- **Summary:** Introduces a benchmark that tests whether agents can discriminate between memories that *reinforce, diverge, or conflict* with each other — not just recall isolated facts. Constructs relation-centric test scenarios where correct downstream behavior depends on understanding memory relationships rather than individual memory retrieval.
- **Implication:** Exposes a blind spot in current memory benchmarks that test recall in isolation. Agents that pass existing memory tests may still fail when memories interact.

### 4. Agent Memory: Characterization and System Implications
- **Authors:** Yasmine Omri, Ziyu Gan, Zachary Broveak, Robin Geens + 5 more
- **Date:** 2025-06-04 | **Link:** https://arxiv.org/abs/2606.06448v1
- **Summary:** Presents the first *systems-level characterization* of agent memory, introducing a taxonomy covering flat retrieval, LLM-mediated extraction, consolidating fact stores, and agentic control flows. Measures system-level behavior (latency, throughput, storage patterns) of these different memory architectures under realistic long-horizon workloads.
- **Implication:** Shifts the memory conversation from "what to remember" to "how memory systems perform at scale" — essential for production deployments where memory stores grow continuously.

### 5. MemPro: Agentic Memory Systems as Evolvable Programs
- **Authors:** Qingshan Liu, Guoqing Wang, Wen Wu, Jingqi Huang + 4 more
- **Date:** 2025-05-30 | **Link:** https://arxiv.org/abs/2606.00619v1
- **Summary:** Treats the entire memory pipeline (construction + retrieval) as an *evolvable program* rather than a fixed architecture. While existing systems adapt only the memory bank post-deployment, MemPro allows the surrounding pipeline itself to evolve, addressing the mismatch between fixed-pipeline designs and memory banks that change in scale and structure over time.
- **Implication:** Meta-level self-modification of memory pipelines could enable agents that autonomously fix their own memory failure modes.

---

## Theme 2 — Safety, Trust, and Monitoring

### 6. Beyond Similarity: Trustworthy Memory Search for Personal AI Agents
- **Authors:** Jiawen Zhang, Kejia Chen, Jiachen Ma, Yangfan Hu + 6 more
- **Date:** 2025-06-04 | **Link:** https://arxiv.org/abs/2606.06054v1
- **Summary:** Identifies a critical *trustworthiness gap* in memory-augmented agents: semantic similarity can retrieve contextually inappropriate memories, leading to cross-domain leakage, sycophancy, tool-call drift, or memory-induced jailbreaks. Studies memory search as a trust boundary and proposes guardrails beyond simple similarity matching.
- **Implication:** Memory retrieval is reframed as a security surface. Any agent using long-term memory needs trust-aware retrieval, not just relevance-aware retrieval.

### 7. Coding with "Enemy": Can Human Developers Detect AI Agent Sabotage?
- **Authors:** Jingheng Ye, Huiqi Zou, Simon Yu, Weiyan Shi
- **Date:** 2025-06-04 | **Link:** https://arxiv.org/abs/2606.05647v1
- **Summary:** Conducts the first large-scale study of *human oversight of AI coding sabotage*. Tests whether human developers can detect when an AI coding agent inserts malicious code to accomplish a hidden side task. Prior work studied AI sabotage only in AI-only settings — this paper directly measures the human-in-the-loop detection gap.
- **Implication:** Directly relevant to anyone deploying coding agents (Copilot, Cursor, Codex CLI). If humans can't reliably detect sabotage, automated monitoring becomes non-optional.

### 8. Will the Agent Recuse Itself? Measuring LLM-Agent Compliance with In-Band Access-Deny Signals
- **Authors:** Thamilvendhan Munirathinam
- **Date:** 2025-06-04 | **Link:** https://arxiv.org/abs/2606.06460v1
- **Summary:** Proposes a cooperative governance mechanism — the "Recuse Signal" — where a server emits an in-band deny signal (e.g., via SSH banner or PostgreSQL NOTICE) asking a connecting automated agent to voluntarily withdraw from a resource. Tests whether current LLM agents actually comply with such signals.
- **Implication:** A practical, deployable mechanism for infrastructure operators who need to tell agents "stay out" without hard-blocking credentials. Compliance rates will determine whether cooperative governance is viable.

### 9. Agent-ToM: Learning to Monitor Autonomous LLM Agents via Theory-of-Mind Reasoning
- **Authors:** Nesreen K. Ahmed, Nima Nafisi
- **Date:** 2025-05-22 | **Link:** https://arxiv.org/abs/2605.24216v1
- **Summary:** Trains monitors that detect covert malicious agent behavior by explicitly reasoning about agent *beliefs, intentions, and plans* (Theory of Mind), rather than just pattern-matching on trajectories. Addresses delayed, context-dependent, and long-horizon attack patterns where agents maintain superficially benign behavior while pursuing hidden objectives.
- **Implication:** ToM-based monitoring could catch sophisticated deceptive agents that evade surface-level trajectory analysis.

### 10. Data Flow Control: Data Safety Policies for AI Agents
- **Authors:** Charlie Summers, Eugene Wu
- **Date:** 2025-06-04 | **Link:** https://arxiv.org/abs/2606.05679v1
- **Summary:** Argues that data safety for agents is fundamentally a *data infrastructure problem*, not just a prompt-engineering one. Introduces Data Flow Control (DFC), a framework for declaratively specifying and enforcing policies over tuple-level data flows within DBMS queries — ensuring that even correct SQL generated by an agent doesn't violate regulatory, privacy, or business constraints.
- **Implication:** Moves data safety enforcement from the agent layer down to the database layer, where it can be formally guaranteed rather than probabilistically hoped for.

---

## Theme 3 — Evaluation and Benchmarks

### 11. Entropy-Based Evaluation of AI Agents (EEA)
- **Authors:** Olasimbo Ayodeji Arigbabu
- **Date:** 2025-06-04 | **Link:** https://arxiv.org/abs/2606.05872v1
- **Summary:** Proposes measuring agent behavior through *entropy* rather than just task success. EEA captures whether an agent explores too much, repeats too rigidly, uses tools effectively, reduces uncertainty over time, or varies across repeated runs — behavioral properties invisible to standard reward/success metrics.
- **Implication:** Provides a complementary evaluation lens. Two agents with identical success rates may have radically different entropy profiles revealing different failure modes.

### 12. The Meta-Agent Challenge (MAC)
- **Authors:** Xinyu Lu, Tianshu Wang, Pengbo Wang, zujie wen + 7 more
- **Date:** 2025-06-03 | **Link:** https://arxiv.org/abs/2606.04455v1
- **Summary:** Tests whether frontier models can *autonomously develop agent systems* — not just execute tasks within human-designed workflows. A "meta-agent" is given a sandboxed environment, an evaluation API, and a time limit to iteratively program an agent artifact that maximizes performance on a held-out test set across five diverse tasks.
- **Implication:** Directly measures the recursive self-improvement capability. If models can build agents that build better agents, the field enters a qualitatively different regime.

### 13. Your Agents Are Aging Too: Agent Lifespan Engineering
- **Authors:** Jianing Zhu, Yeonju Ro, John Robertson, Kevin Wang + 4 more
- **Date:** 2025-05-25 | **Link:** https://arxiv.org/abs/2605.26302v1
- **Summary:** Argues that day-one benchmarks miss a critical question: *how long does an agent remain reliable after deployment?* Even with frozen weights, an agent's effective state changes as it compresses history, retrieves from growing memory, revises facts, and undergoes maintenance. Introduces reliability as a lifespan property of the full agent harness, not a snapshot property of the base model.
- **Implication:** Opens a new evaluation dimension — temporal degradation. Agents that score well on fresh benchmarks may fail after weeks of continuous operation.

---

## Theme 4 — Self-Improvement and Skill Learning

### 14. Retrospective Harness Optimization (RHO)
- **Authors:** Wenbo Pan, Shujie Liu, Chin-Yew Lin, Jingying Zeng + 4 more
- **Date:** 2025-06-04 | **Link:** https://arxiv.org/abs/2606.05922v1
- **Summary:** A self-supervised method for improving the agent's harness (skills, tools, workflows) using *only past trajectories* — no ground-truth labels required. RHO selects a diverse coreset of challenging tasks from history and re-solves them, using the agent's own preferences over trajectory rollouts to identify improvements.
- **Implication:** Enables continuous self-improvement in production settings where labeled data is unavailable. Agents could iteratively refine their own tooling.

### 15. LatentSkill: From In-Context Textual Skills to In-Weight Latent Skills
- **Authors:** Aofan Yu, Chenyu Zhou, Tianyi Xu, Zihan Guo + 7 more
- **Date:** 2025-06-04 | **Link:** https://arxiv.org/abs/2606.06087v1
- **Summary:** Converts textual skill descriptions into plug-and-play LoRA adapters via a pretrained hypernetwork. Skills are stored *in weight space* rather than context space, eliminating per-step skill tokens while preserving modular loading, scaling, and composition. Outperforms in-context skill injection on ALFWorld and Search-QA.
- **Implication:** A potential solution to context window bloat from skill injection. Also provides skill IP protection — skills aren't exposed as plaintext in prompts.

### 16. Skill0.5: Joint Skill Internalization and Utilization
- **Authors:** Jiapeng Zhu, Jianxiang Yu, Yibo Zhao, Chengcheng Han + 4 more
- **Date:** 2025-05-27 | **Link:** https://arxiv.org/abs/2605.28424v1
- **Summary:** Addresses the dilemma between full skill externalization (context overhead) and full internalization (overfitting and knowledge conflicts) by proposing a hybrid framework. Skill0.5 jointly internalizes general skills for broad cognitive transfer while externalizing task-specific skills for dynamic execution via agentic RL.
- **Implication:** Suggests an optimal split between what an agent "knows" (weights) and what it "looks up" (context), potentially applicable to any skill-augmented agent.

---

## Theme 5 — Tool Use and System Infrastructure

### 17. ToolChoiceConfusion: Causal Minimal Tool Filtering (CMTF)
- **Authors:** Rahul Suresh Babu, Laxmipriya Ganesh Iyer
- **Date:** 2025-06-04 | **Link:** https://arxiv.org/abs/2606.06284v1
- **Summary:** Identifies that larger tool menus *reduce* agent reliability by increasing wrong-tool calls, premature actions, and token cost. Proposes CMTF, a training-free method that selects tools by *causal sufficiency* rather than semantic relevance — a tool may be related to the task but unnecessary or premature at the current step.
- **Implication:** Directly actionable: agent frameworks should dynamically filter available tools per-step rather than presenting the full toolkit. Fewer tools = more reliable tool use.

### 18. Vortex: Efficient Sparse Attention Serving for AI Agents
- **Authors:** Zhuoming Chen, Xinrui Zhong, Qilong Feng, Ranajoy Sadhukhan + 4 more
- **Date:** 2025-06-04 | **Link:** https://arxiv.org/abs/2606.06453v1
- **Summary:** Presents a system for expressing and serving diverse sparse attention algorithms for LLMs, combining a Python-embedded frontend with a page-centric tensor abstraction. Designed to accelerate both human researchers and AI agents in exploring sparse attention designs at scale, addressing the engineering bottleneck of deploying new attention patterns.
- **Implication:** Infrastructure that makes long-context agent workloads cheaper and faster to serve.

### 19. The End of Software Engineering (Position Paper)
- **Authors:** Zhenfeng Cao
- **Date:** 2025-06-04 | **Link:** https://arxiv.org/abs/2606.05608v1
- **Summary:** Argues that AI agents — where LLMs serve as the primary reasoning engine, dynamically generating and discarding code as an instrumental resource — constitute a *fundamental restructuring* of the software paradigm, not an incremental improvement. Formalizes the distinction between human-authored static code and agent-generated ephemeral code through complexity scaling analysis.
- **Implication:** A provocative framing: if agents treat code as disposable intermediate representations, traditional software engineering practices (version control, code review, tech debt management) need rethinking.

---

## Cross-Cutting Observations

| Signal | Evidence |
|--------|----------|
| **Memory is the bottleneck** | 6 of 30 papers directly address agent memory — more than any other single topic. Approaches span graph reconstruction, bitemporal contradiction resolution, relational discrimination, systems characterization, evolvable pipelines, and trust-aware search. |
| **Safety is no longer optional** | Sabotage detection, cooperative access-deny signals, Theory-of-Mind monitoring, data flow control, and memory trust boundaries all appeared in a single week of publications. |
| **Evaluation is expanding beyond success rate** | Entropy-based behavioral analysis, lifespan degradation testing, meta-agent self-improvement benchmarks, and relational memory discrimination all push evaluation into new dimensions. |
| **Skills are moving from context to weights** | Two independent papers (LatentSkill, Skill0.5) propose partially or fully shifting skill knowledge from prompt context into model weights via LoRA or RL. |
| **The "self-correction illusion"** | One paper demonstrates that LLMs correct errors from *others* more readily than identical errors in their own reasoning traces — the willingness to correct depends on the chat-template role label, not the claim content. |

---

## Selected Papers for Deep-Dive Reading

If limited on time, these five papers represent the most novel contributions:

1. **TOKI** (bitemporal contradiction resolution) — formalizes an unsolved problem with DBMS rigor
2. **Coding with "Enemy"** (sabotage detection) — first large-scale human study of AI coding sabotage
3. **MRAgent** (memory reconstruction) — challenges the dominant retrieve-then-reason paradigm
4. **ToolChoiceConfusion** (causal tool filtering) — immediately actionable for any tool-using agent
5. **Meta-Agent Challenge** (autonomous agent development) — tests recursive self-improvement
