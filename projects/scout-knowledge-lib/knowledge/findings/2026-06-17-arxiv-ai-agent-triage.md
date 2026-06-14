# arXiv Triage — June 6–11, 2026 (Supplement)

*Triaged: 2026-06-17 | Source: `https://export.arxiv.org/api/query` | Queries: `all:"AI agent"`, `all:"LLM agent" AND all:"memory"`, `cat:cs.MA AND all:"multi-agent"`, `all:"agentic" AND all:"tool use"`, `all:"autonomous agent" AND all:"planning"`, `all:"agent" AND all:"safety" AND all:"LLM"`, `all:"agentic workflow" OR all:"agent framework"` | Note: Supplements [2026-06-15 triage](./2026-06-15-arxiv-ai-agent-triage.md); no duplicates.*

---

## ★★★★★ High Relevance

### [2606.13663] HyperTool: Beyond Step-Wise Tool Calls for Tool-Augmented Agents
- **Authors**: Du, Zhou, Ge, Wang et al.
- **Summary**: Tool-augmented LLM agents typically unfold each tool invocation as a separate model-visible step, creating an "execution-granularity mismatch" — deterministic tool subroutines consume context and force the model to manage low-level dataflow. HyperTool wraps multi-step tool workflows into a single MCP-style call: the model emits a code block that invokes tools, manipulates returns, and passes intermediate results locally. On MCP-Universe, Qwen3-32B jumps from 15.69% → 35.29% and Qwen3-8B from 9.93% → 33.33%, surpassing GPT-OSS and Kimi-k2.5.
- **Key finding**: Raising the unit of tool execution from atomic calls to executable code blocks dramatically reduces context pollution and improves multi-step tool success.
- **Implication for us**: Our agents make sequential tool calls with each observation entering the context. Batching deterministic tool subroutines (e.g., file reads + grep sequences) into single compound calls could cut context waste significantly. This is the tool-use equivalent of the "information folding" pattern — hide mechanical steps from the reasoning trace.

### [2606.12703] SMSR: Certified Defence Against Runtime Memory Poisoning in Persistent LLM Agent Systems
- **Authors**: Sharma
- **Summary**: Persistent-memory RAG agents face Multi-Session Memory Poisoning (MSMP): adversaries inject crafted memories through normal interaction that steer future responses. No existing defense certifies against this. SMSR provides two components: (1) HMAC-SHA256 provenance tags at write time blocking unsigned injection (cuts attack success from 93–100% → 0%), and (2) randomized memory ablation with verdict-based majority voting at query time (holds authenticated adversary success to 8.0%). In end-to-end query-only attacks where the agent itself writes poison, SMSR reduces success from 65.3% → 5.3%.
- **Key finding**: String-based voting on retrieved memories is vulnerable to the "Consistent Minority Effect" — a single consistent adversarial answer wins even as a numerical minority. Verdict-based voting (binary agree/disagree per sample) eliminates this.
- **Implication for us**: Our `context_updates` system writes persistent facts across sessions. This is exactly the MSMP attack surface — a bad lesson or context update could persistently steer future agent behavior. Provenance-signing context updates and voting-based validation on retrieval would harden this channel.

### [2606.11686] Layer-Isolated Evaluation: Gating the Deterministic Scaffold of a Production LLM Agent
- **Authors**: Zhang, Wang, Lei
- **Summary**: End-to-end task success metrics mask where regressions occur. This paper decomposes a production ordering agent into 8 layers (ontology, intent, routing, decomposition, escalation, safety, memory, envelope/defense), each tested by its own no-LLM deterministic assertion slice (238 cases, 2.39s total). When a single layer is deliberately degraded, the aggregate metric barely moves (−1.7 to −5.9 pp), but the matching layer's slice craters (−25 to −91 pp). Validated across two structurally different deployments.
- **Key finding**: Aggregate task-success masks regressions by 5–20×. Per-layer deterministic testing localizes faults that end-to-end metrics hide entirely.
- **Implication for us**: Our evaluation infrastructure uses end-to-end task success. This paper provides a concrete methodology to decompose agent behavior into testable layers. The coverage-honesty criterion (refusing to score unexercised layers) prevents false confidence. We could define layer slices for our agents: context retrieval, task decomposition, tool selection, output validation, etc.

### [2606.08919] Oversight Has a Capacity: Calibrating Agent Guards to a Subjective, Fatiguing Human
- **Authors**: Turan
- **Summary**: Human-in-the-loop approval gates are the standard safety pattern for LLM agents taking irreversible actions. This paper shows: (i) reviewers only moderately agree on risk (Fleiss' κ = 0.52), so no single "correct" label exists; (ii) realized safety is an inverted-U in escalation rate — more human oversight can make a system *less* safe because humans fatigue; (iii) a load-aware escalation policy naturally resists flooding attacks that slip malicious actions past fatigued reviewers.
- **Key finding**: Human oversight is a finite resource. The safety-optimal guard escalates *below* full escalation. Naive "approve everything" gates become attack surfaces under load.
- **Implication for us**: Directly relevant to our human review patterns. If our agents escalate too many items (e.g., context_updates, repair decisions), the reviewer fatigues and approves uncritically. The inverted-U finding argues for selective, high-value escalation — the same "triage before acting" principle emerging from multiple papers.

### [2606.12908] SENTINEL: Failure-Driven Reinforcement Learning for Training Tool-Using Language Model Agents
- **Authors**: Wang, Lu, Zhang, Liu et al.
- **Summary**: Fixed training task distributions become mismatched with an agent's evolving capabilities during RL training. SENTINEL uses a Controller–Proposer–Solver loop: the Controller analyzes failed trajectories and summarizes error patterns, the Proposer generates executable tasks targeting those weaknesses, and the Solver trains on the targeted tasks. On Tau2-Bench Retail with Qwen3-4B, improves Pass^1 from 66.4 → 74.9 and outperforms RL on general synthetic tasks.
- **Key finding**: Model failures provide a more effective and scalable source of targeted training signal than uniformly distributed training tasks. The curriculum should adapt to where the agent actually struggles.
- **Implication for us**: Maps directly to our repair metabolism problem. Rather than treating all task failures uniformly, we could analyze failure patterns (like SENTINEL's Controller) and generate targeted repair tasks. The Controller–Proposer–Solver decomposition also offers a concrete architecture for automated capability improvement.

---

## ★★★★ Notable

### [2606.11680] HORMA: Hierarchical Organize-and-Retrieve Memory Agent
- **Authors**: Hsu, Kuang, Liu, Yao et al.
- **Summary**: Organizes agent experience into a file-system-like hierarchy where summarized entities link to raw trajectories. A lightweight RL-trained navigator retrieves minimal sufficient context by traversing the hierarchy. Achieves better performance using at most 22.17% of baseline token usage in long conversation tasks. Distinguishes between failures from missing info vs. misleading/overloaded context.
- **Key finding**: File-system metaphor for memory organization — directories of summarized entities with linked raw data — outperforms flat retrieval. The distinction between "missing information" failures and "context overload" failures drives different retrieval strategies.
- **Implication for us**: Our knowledge base already uses a file-system structure but without the hierarchical navigation or summary-to-raw linking. HORMA's approach of distinguishing failure types (missing vs. overloaded context) could improve how we decide when to load more context vs. when to trim it.

### [2606.12780] ProPlay: Procedural World Models for Self-Evolving LLM Agents
- **Authors**: Ma, Wang, Li, Li et al.
- **Summary**: Abstracts successful trajectories into procedures organized in a causal graph. Before each episode, agents rehearse ("preplay") future procedural paths using the graph; after execution, the graph is refined. Each transition carries a reliability record embedding estimating its task contribution from past outcomes.
- **Key finding**: Closing the loop between memory and planning through a procedure graph with reliability-weighted transitions enables self-improvement without external supervision. The key abstraction is *procedure* (multi-step pattern), not individual actions.
- **Implication for us**: Our agents accumulate lessons but don't organize them into causal procedure graphs. ProPlay's reliability-weighted transitions could help distinguish "this pattern worked reliably" from "this pattern worked once." The preplay mechanism — simulating paths before execution — maps to triage.

### [2606.12674] Evoflux: Inference-Time Evolution of Executable Tool Workflows for Compact Agents
- **Authors**: Bhandari, Yue, Ko, Patel et al.
- **Summary**: Small language models (< 10B) fail at MCP-style tool use not because they can't format calls, but because they can't recover from failed plans over changing tool catalogs. Evoflux uses inference-time evolutionary search to repair executable tool workflow graphs, raising execution feasibility from ~3% to 17–24% on MCP-Bench. SFT and SFT+DPO on the same data match or underperform zero-shot; ReAct has higher peaks but more variance.
- **Key finding**: For tool workflows, execution-grounded search (evolving and testing real workflows) beats distillation from teacher traces, especially under scarce training data. The gap between "looks correct" and "actually executes" is the dominant failure mode.
- **Implication for us**: Validates our experience that tool calls which "look right" often fail. Evoflux's approach of evolving workflows against real execution feedback — rather than training on demonstrations — could improve our agents' tool-use reliability, especially for novel tool combinations.

### [2606.12634] SGCD: Sibling-Guided Credit Distillation for Long-Horizon Tool-Use Agents
- **Authors**: Ding, Xin, De la Cruz Weinstein
- **Summary**: Self-distillation for RL tool agents can silently destroy tool use by amplifying useful skills and harmful shortcuts equally. SGCD generates paired successful/failed "sibling" rollouts, uses an LLM to contrast them for stepwise credit, and reshapes token advantages. Improves AppWorld TGC 42.9 → 45.6 (test_normal) and τ³-airline pass@1 0.583 → 0.602.
- **Key finding**: Naïve self-distillation is dangerous for tool-use — it amplifies shortcuts alongside skills because it doesn't know which actions the verifier rewards. Contrastive sibling analysis provides the missing credit signal.
- **Implication for us**: When our agents learn from their own outputs (e.g., context_updates, lessons), they face the same risk: successful outcomes that relied on shortcuts get reinforced alongside genuine insights. Contrastive analysis of successful vs. failed sessions could distinguish real lessons from coincidental ones.

### [2606.10507] HIPIF: Hierarchical Planning and Information Folding for Long-Horizon LLM Agent Learning
- **Authors**: Diao, Lu, Li, Zhou et al.
- **Summary**: Long-context interference — growing histories weakening ability to track global task state — is the core bottleneck for long-horizon agents. HIPIF trains agents end-to-end to decompose into subgoals and *fold* (compress) completed subgoal histories. Combines hierarchical reflection with subgoal-oriented process rewards, without auxiliary models or expert trajectories.
- **Key finding**: "Information folding" — compressing completed subtask context while preserving the global goal state — is more effective than maintaining the full history. The agent learns when and how to fold.
- **Implication for us**: Our agents carry full session context. HIPIF's folding principle — actively compressing completed work segments — could reduce context pollution. This connects to HyperTool's insight (fold deterministic tool workflows) but generalizes to any completed subtask.

### [2606.08340] ALEM: Benchmarking Open-Ended Multi-Agent Coordination
- **Authors**: Tessera, Szecsenyi, Barker, Rutherford et al.
- **Summary**: Benchmark for long-horizon open-ended multi-agent coordination. Current LLM agents average only ~6% normalized return. Key finding: GPT-5.4-High achieves strong individual task reward but much lower coordination reward — individual competence doesn't imply coordination competence. Communication is the largest contributor to coordination; memory and reasoning help for multi-step plans.
- **Key finding**: Coordination is a distinct bottleneck separate from single-agent capability. Communication matters most, not individual reasoning power.
- **Implication for us**: Reinforces "The Illusion of Multi-Agent Advantage" from the prior triage. Our multi-agent system's coordination quality depends more on inter-agent communication design than on individual agent capability.

### [2606.10749] Secure LLM Agents: Threat Surfaces, Attacks, Defenses, and Evaluation
- **Authors**: Ling, Yu, Chen, Fang
- **Summary**: Survey of 247 papers through a lifecycle-based framework: information flow, delegated authority, persistent state. Finds prompt injection and tool-mediated control-flow hijacking dominate; persistent state corruption and multi-agent propagation are emerging central concerns. Current defenses are "weakly compositional" — individual protections don't compose reliably.
- **Key finding**: Defenses are individually useful but fail to compose. Persistent state corruption is becoming the central emerging concern (superseding prompt injection as the primary worry for deployed agents).
- **Implication for us**: Our system has all three threat surfaces: information flow (context files), delegated authority (agent tool use), persistent state (lessons, context_updates). The "weakly compositional" defense finding means we can't assume our individual safeguards (review gates, context validation) compose into overall safety.

---

## ★★★ Lower Priority

### [2606.12384] APPO: Agentic Procedural Policy Optimization
- Fine-grained branching and credit assignment for agentic RL. Finds influential decision points are broadly distributed, not concentrated at tool calls. Uses combined token uncertainty + policy-induced likelihood for branch selection. +4 points across 13 benchmarks.

### [2606.10525] Assessing Automated Prompt Injection Attacks in Agentic Environments
- Black-box optimization (TAP) substantially outperforms white-box (GCG) for prompt injection in realistic agent settings. Task-universal attacks transfer to unseen tasks but not across model families. Safety-tuned attacker models sometimes refuse to generate adversarial prompts.

### [2606.12821] GeoNatureAgent Benchmark
- First benchmark for environmental agents with structured tool calling against real APIs. Claude Sonnet 4 leads (60.8%); open-weight DeepSeek V3.2 achieves 93% of Claude's capability at 11× lower cost. Comparison tasks universally unsolved (0%).

### [2606.13392] MiniMax Sparse Attention (MSA)
- Blockwise sparse attention reducing per-token attention compute by 28.4× at 1M context. Production-grade 109B model released. Directly enables long-context agentic workflows. 14.2× prefill speedup on H800.

### [2606.13604] Multi-Agent RL for Three-Sided Dispatch (DoorDash)
- Deployed RL system at DoorDash adapting dispatch objective weights using delayed marketplace feedback. Store-level policy learned from logged data. Practical example of MARL in production three-sided marketplace.

### [2606.12586] Trigger Leakage in Vision-Language Agentic Systems
- Backdoor triggers propagate through decision pipelines and tool interfaces. Formalizes "trigger leakage" — triggers firing on unintended inputs. Current ASR metrics miss precision failures.

### [2606.12780] ProPlay: Procedural World Models
- Already covered above in ★★★★.

---

## Cross-Cutting Themes & Hypotheses

### Theme 1: Fold, Don't Carry — Context Compression is the Meta-Pattern
Three independent papers converge: HyperTool folds deterministic tool workflows, HIPIF folds completed subgoal histories, HORMA distinguishes missing-info from context-overload failures. The shared insight: *carrying everything is worse than carrying the right thing*. MiniMax Sparse Attention enables this at the attention level (28.4× compute reduction at 1M context).

**Hypothesis**: Context folding at the application level (compressing completed subtasks) can yield larger practical improvements than attention-level optimizations, because it removes semantically irrelevant context rather than merely computing attention more efficiently.

### Theme 2: Oversight is a Resource, Not a Boolean
Oversight Has a Capacity (inverted-U in escalation rate), SMSR (verdict-based voting over string-based), Layer-Isolated Evaluation (per-layer regression detection) — all treat oversight as a finite, deployable resource. The naive binary (human approves/rejects) is both insufficient and counterproductive at scale.

**Hypothesis**: The optimal oversight architecture is multi-layered: cheap deterministic checks (Layer-Isolated) handle routine regression; selective escalation (Oversight Capacity) routes genuine judgment calls; provenance-signing (SMSR) prevents state corruption. Attempting to use one mechanism for all three fails.

### Theme 3: Failure is Signal, Not Waste
SENTINEL (failure-driven training curriculum), Evoflux (execution-grounded search from failed plans), SGCD (contrastive sibling analysis of failures), and our own repair metabolism data all treat failures as the most informative training/improvement signal. The question isn't whether failures occur but whether the system harvests them.

**Hypothesis**: Systems that structurally convert failures into targeted improvement (SENTINEL's Controller–Proposer–Solver) outperform systems that merely retry or accumulate generic lessons. The failure analysis step (understanding *why* it failed) is more valuable than the retry.

### Theme 4: Persistent State is the New Attack Surface  
SMSR (memory poisoning defense), the Secure LLM Agents survey (persistent state corruption as central emerging concern), and TRACE from the prior triage (memory ≠ compliance) all converge: as agents gain persistent state, that state becomes the primary attack/corruption vector — more dangerous than prompt injection because it persists across sessions.

**Hypothesis**: Agent systems with unvalidated persistent state will face compounding reliability degradation over time, as small errors in stored context/lessons accumulate and steer future behavior. Provenance and periodic revalidation of stored state are prerequisites for long-running agent reliability.
