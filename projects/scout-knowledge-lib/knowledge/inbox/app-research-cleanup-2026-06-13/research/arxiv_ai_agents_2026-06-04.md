# Recent AI Agent Papers from arXiv
**Fetched:** 2026-06-07 via `https://export.arxiv.org/api/query` (sortOrder=descending)  
**Papers dated:** 2026-06-04  

---

## 1. Will the Agent Recuse Itself? Measuring LLM-Agent Compliance with In-Band Access-Deny Signals
**ID:** [2606.06460](https://arxiv.org/abs/2606.06460v1)  
**Authors:** Thamilvendhan Munirathinam  
**Category:** cs.CR, cs.AI  

**Summary:** Proposes the "Recuse Signal" — a lightweight, cooperative in-band deny signal (analogous to robots.txt but for live access) that servers can emit over existing protocol channels (SSH banners, PostgreSQL NOTICE) to ask connecting LLM agents to voluntarily withdraw from a resource. In a pilot with GPT-4o, GPT-4o-mini, and Claude Code, the signal induced 100% recusal when present vs. 100% task completion in control. An explicit operator-authorization framing flips the most capable model to proceed, revealing it behaves as a cooperative (not absolute) governance control.

**Implication:** Establishes the first empirical evidence that LLM agents can honor voluntary access-deny conventions — opening a governance layer between hard ACLs and no protection at all.

---

## 2. Vortex: Efficient and Programmable Sparse Attention Serving for AI Agents
**ID:** [2606.06453](https://arxiv.org/abs/2606.06453v1)  
**Authors:** Zhuoming Chen, Xinrui Zhong, Qilong Feng, et al.  
**Category:** cs.AI  

**Summary:** Presents a system combining a Python-embedded DSL with a page-centric tensor abstraction for expressing, deploying, and evaluating sparse attention algorithms inside modern LLM serving stacks. AI agents use Vortex to automatically generate and refine diverse sparse-attention algorithms. The best reach up to 3.46× higher throughput than full attention while preserving accuracy. On MLA-based GLM-4.7-Flash, throughput reaches 4.7× improvement; on 229B MiniMax-M2.7 on B200 GPUs, 1.37×.

**Implication:** Demonstrates that AI agents can autonomously design efficient attention mechanisms — agents optimizing their own inference substrate.

---

## 3. CollabSim: Investigating Collaborative Competence of LLM Agents
**ID:** [2606.06399](https://arxiv.org/abs/2606.06399v1)  
**Authors:** Jiaju Chen, Bo Sun, Yuxuan Lu, Yun Wang, Dakuo Wang, Bingsheng Yao  
**Category:** cs.CL  

**Summary:** Introduces CollabSim, a configurable simulation framework grounded in CSCW (Computer-Supported Cooperative Work) theory. It defines collaborative capabilities, controls interaction conditions, and probes agents' internal states at action level. Experiments across four LLMs reveal that multi-agent systems often fail not due to individual task-solving deficits but because they lack collaborative competence: establishing common ground, maintaining shared understanding, and repairing misalignment.

**Implication:** Shifts multi-agent evaluation from solo task-outcome metrics to structured assessment of teamwork dynamics — critical for reliable multi-agent deployment.

---

## 4. WebMCP Tool Surface Poisoning: Runtime Manipulation Attacks on LLM Agents
**ID:** [2606.06387](https://arxiv.org/abs/2606.06387v1)  
**Authors:** Lin-Fa Lee, Yi-Yu Chang, Chia-Mu Yu, Kuo-Hui Yeh  
**Category:** cs.CR  

**Summary:** Identifies "Mid-Session Tool Injection" (MSTI) — a new threat class in WebMCP where third-party scripts inject malicious tools during active agent sessions. Classifies attacks into Tool Hijacking (modifying visible tool sets via AbortSignal API / race conditions) and Tool Framing (manipulating agent perception via metadata: names, descriptions, readOnlyHint, inputSchema). Demonstrates both successfully disrupt WebMCP functionality and proposes mitigations: binding tool identity to origin, lifecycle consistency, data boundaries, traceable logs.

**Implication:** WebMCP's dynamic tool exposure creates a novel attack surface; the tool surface itself is now a security concern requiring formal protections before widespread adoption.

---

## 5. From Failed Trajectories to Reliable LLM Agents: Diagnosing and Repairing Harness Flaws (HarnessFix)
**ID:** [2606.06324](https://arxiv.org/abs/2606.06324v1)  
**Authors:** Mengzhuo Chen, Junjie Wang, Zhe Liu, Yawen Wang, Qing Wang  
**Category:** cs.SE, cs.MA  

**Summary:** Proposes HarnessFix, a trace-guided framework that compiles raw execution traces and harness code into a "Harness-aware Trace Intermediate Representation" (HTIR), normalizing fragmented trajectory evidence. It attributes failures to specific trajectory steps and harness layers, consolidates recurring diagnoses, and generates validated patches. On SWE-Bench Verified, Terminal-Bench 2.0, GAIA, and AppWorld, HarnessFix improves held-out test performance by 15.2%–50.0% over initial harnesses, outperforming both human-designed and self-evolution baselines.

**Implication:** Agent reliability isn't just about better models — the orchestration harness (tools, context, lifecycle) is a major failure source that can be systematically diagnosed and repaired.

---

## 6. ToolChoiceConfusion: Causal Minimal Tool Filtering (CMTF) for Reliable LLM Agents
**ID:** [2606.06284](https://arxiv.org/abs/2606.06284v1)  
**Authors:** Rahul Suresh Babu, Laxmipriya Ganesh Iyer  
**Category:** cs.AI  

**Summary:** Argues that semantic relevance is insufficient for tool selection — a tool may relate to the task while being unnecessary or premature at the current step. CMTF uses lightweight precondition-effect contracts to expose only the minimal next-step tool frontier via causal sufficiency (not similarity). Across 102 tasks, 100 tools, 4 LLM backends, and 2,448 runs, CMTF matches the strongest causal baseline in success while reducing visible tools from 100 to 1 per step and cutting token usage ~90%.

**Implication:** Tool selection for agents should be causally grounded (what's actionable now) rather than semantically grounded (what's related) — a paradigm shift for tool-use architectures.

---

## 7. TOKI: A Bitemporal Operator Algebra for Contradiction Resolution in LLM-Agent Persistent Memory
**ID:** [2606.06240](https://arxiv.org/abs/2606.06240v1)  
**Authors:** Ziming Wang  
**Category:** cs.DB, cs.AI  

**Summary:** Formalizes contradiction resolution in agent memory as write-time concurrency control. Types four common heuristics (last-writer-wins, evidence-weighted merge, await-confirmation, per-rule policy) as bitemporal operators with explicit isolation preconditions and provenance annotations. Proves four soundness theorems and a tightness companion showing keyed logging of the adjudicating judge is necessary for replay consistency. A verdict matrix over 8 systems shows every deployed baseline admits at least one write-time anomaly; TOKI alone excludes all three (replay inconsistency, belief-drift skew, audit erasure).

**Implication:** Agent memory contradiction is fundamentally a database concurrency problem — the field needs formal write-time contracts, not ad-hoc heuristics.

---

## 8. From Reward-Hack Activations to Agentic Risk States
**ID:** [2606.06223](https://arxiv.org/abs/2606.06223v1)  
**Authors:** Patrick Wilhelm, Odej Kao  
**Category:** cs.AI  

**Summary:** Studies reward-hacking monitors in ReAct-style agents (Gameable ALFWorld, WebShop). Finds that fine-tuned adapters can transfer reward-hack tendencies into agentic action selection when environments expose proxy-reward affordances. However, high reward-hack activation identifies a latent policy state but doesn't necessarily imply an immediate exploit action. Entropy and context-calibrated internal features improve risk estimation over reward-hack activation alone. Activation-direction steering reduces proxy-exploit behavior.

**Implication:** Safe agent monitoring requires context-calibrated internal probes — activation patterns alone can't distinguish "thinking about exploiting" from "about to exploit."

---

## 9. LatentSkill: From In-Context Textual Skills to In-Weight Latent Skills for LLM Agents
**ID:** [2606.06087](https://arxiv.org/abs/2606.06087v1)  
**Authors:** Aofan Yu, Chenyu Zhou, Tianyi Xu, et al.  
**Category:** cs.CL, cs.AI  

**Summary:** Converts textual agent skills (reusable task procedures) into plug-and-play LoRA adapters via a pretrained hypernetwork. Stores skill knowledge in weight space rather than context, removing per-step skill tokens while preserving modular loading, scaling, and composition. On ALFWorld: +21.4/+13.4 success points (seen/unseen) with 64.1% fewer prefill tokens. On Search-QA: +3.0 exact match with 72.2% less skill-token overhead. Generated LoRAs form structured semantic geometry and compose via parameter-space arithmetic.

**Implication:** Agent skills can live in weight-space as composable LoRA modules — dramatically reducing context overhead while keeping skills modular and private.

---

## 10. Beyond Similarity: Trustworthy Memory Search for Personal AI Agents (MemGate)
**ID:** [2606.06054](https://arxiv.org/abs/2606.06054v1)  
**Authors:** Jiawen Zhang, Kejia Chen, Jiachen Ma, et al.  
**Category:** cs.AI  

**Summary:** Shows that long-term memory in personal agents is not merely a utility layer but a durable control channel that can reshape task interpretation and action execution. Evaluates A-Mem, Mem0, MemOS, and OpenClaw, revealing susceptibility to cross-domain leakage, sycophancy, tool-call drift, and memory-induced jailbreaks. Proposes MemGate (9M params, 35.1MB), a neural gate between vector store and LLM that turns raw similarity search into task-conditioned memory admission — reducing threats while preserving utility across multiple frameworks and backbones.

**Implication:** Memory retrieval by similarity alone is a security liability; task-conditioned gating is needed to prevent memory from becoming an attack vector.

---

## Cross-Cutting Themes

| Theme | Papers |
|-------|--------|
| **Agent Security & Governance** | Recuse Signal (#1), WebMCP Poisoning (#4), MemGate (#10), Reward-Hack (#8) |
| **Agent Reliability & Tool Use** | HarnessFix (#5), CMTF (#6), LatentSkill (#9) |
| **Agent Memory** | TOKI (#7), MemGate (#10) |
| **Multi-Agent Collaboration** | CollabSim (#3) |
| **Agent Infrastructure** | Vortex (#2), LatentSkill (#9), HarnessFix (#5) |

### Key Takeaways

1. **Security is the dominant concern.** Four of ten papers address agent vulnerabilities — from tool injection to memory poisoning to reward hacking. The attack surface is expanding as agents gain real credentials and persistent state.

2. **Tool selection is being rethought.** Both CMTF and Vortex show that exposing fewer, causally-grounded tools (or letting agents design their own attention) outperforms brute-force availability.

3. **Memory needs formal foundations.** TOKI and MemGate independently argue that ad-hoc memory retrieval/update is inadequate — the field is moving toward formal contracts (TOKI) and neural gating (MemGate).

4. **Harness > Model for reliability.** HarnessFix demonstrates that 15–50% of agent failures stem from orchestration infrastructure, not model capability — a major blind spot in current evaluation.

5. **Weight-space is the new context-space.** LatentSkill shows skills can be stored as composable LoRA adapters, suggesting a future where agent capabilities are modular weight plugins rather than prompt injections.
