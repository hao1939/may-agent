# Scout Discoveries — 2026-03-07 (Session 2)

Research sweep on **AI Agent Frameworks & Tool-Use**: recent developments, new architectures, emerging patterns.

**Sources searched:**
1. ✅ **GitHub** — API search (repos sorted by stars, recently pushed, topic-filtered for agent+tool)
2. ✅ **arXiv / HuggingFace Daily Papers** — API search (cs.AI, cs.CL — agent tool-use, frameworks, reasoning)
3. ✅ **HuggingFace Models** — API search (agent+tool models, recently modified)
4. ✅ **Reddit Arctic Shift** — API search (r/LocalLLaMA, r/MachineLearning — agent framework discussions)

**Deduplication:** Grep-checked all entries against `agents/scout/knowledge/discoveries.md` (3319 lines, canonical archive) AND `agents/scout/workspace/` files. All entries below confirmed **[NEW]** — not previously tracked.

---

## Discovery 1: [NEW] IBM ContextForge (mcp-context-forge) — Enterprise AI Gateway for MCP/A2A/REST Federation

**Source:** GitHub — https://github.com/IBM/mcp-context-forge (3,372⭐, created May 2025, actively pushed Mar 7 2026)

**What it is:** An open-source AI gateway, registry, and proxy from IBM that federates MCP servers, A2A agents, and REST/gRPC APIs behind a single unified endpoint. Provides centralized governance, discovery, guardrails, and observability for all agent tool calls.

**Why it matters — the "API gateway for agents" pattern is maturing:**
- **Protocol convergence layer.** Translates between MCP, A2A, REST, and gRPC — agents don't need to know which protocol a tool speaks. This is the infrastructure that makes "any agent calls any tool" real in enterprise settings.
- **40+ plugins** for additional transports, protocols, and integrations. This is more than a proxy — it's an extensible middleware platform.
- **TOON compression** for tool schemas — addresses the context window bloat problem from having hundreds of available tools (directly related to the `ContextCache` pattern we've tracked for preserving KV-cache hit rates with large tool sets).
- **OpenTelemetry observability** with Phoenix, Jaeger, Zipkin — solves the "where did the tool call go wrong?" problem for production agent systems.
- **Federation and multi-cluster** via Redis-backed caching — enterprise-grade horizontal scaling.
- **gRPC-to-MCP translation** via automatic reflection-based service discovery — legacy services become MCP tools without code changes.

**Architectural significance:** This is IBM's answer to the "agent infrastructure" question. While Anthropic has Claude Agent SDK, Google has Genai Toolbox, and Amazon has Strands, IBM is positioning as the neutral gateway layer that sits *in front of* all of them. The "registry + proxy + guardrails" pattern is what enterprises actually need: not another agent framework, but infrastructure that makes their existing frameworks interoperable and governable.

**Connects to:** MCP ecosystem (SEP-1686 Tasks, SEP-1577 Sampling With Tools, SEP-1865 Apps); AgentHub concept (registry for agents, 2603.02176); Composio (tool integration layer, 27k⭐). ContextForge is the IBM-scale version of what Composio does for individual developers.

---

## Discovery 2: [NEW] Intuit "Trace-Free+" — Learning to Rewrite Tool Descriptions for Reliable Agent Tool-Use (arXiv 2602.20426 + HF Model)

**Source:** arXiv 2602.20426 + HuggingFace model `intuit/agent-tool-optimizer` (Qwen3-4B-Instruct SFT, Apache 2.0). Cross-referenced: paper → HF model → dataset (`intuit/tool-optimizer-dataset`).

**What it is:** A curriculum learning framework that trains a model to *rewrite tool descriptions* so that LLM agents can better select and use tools — especially in large candidate sets (100+ tools) and cold-start/privacy-constrained settings where execution traces are unavailable.

**Why it matters — tool interface quality is the overlooked bottleneck:**
- **Flips the optimization target.** Everyone fine-tunes the *agent*. Intuit shows you can instead optimize the *tool interfaces* the agent consumes. Tool descriptions are human-written documentation; agents need machine-optimized interfaces.
- **Cold-start problem solved.** Existing tool-interface optimization relies on execution traces (what worked, what failed). Trace-Free+ uses curriculum learning to progressively transfer supervision from trace-rich settings to trace-free deployment — the model learns abstract "interface-usage patterns" that generalize to unseen tools.
- **Scales to 100+ tools.** StableToolBench and RestBench results show robustness as the tool candidate set grows — critical for real-world agent deployments where the available tool set is large and dynamic.
- **Cross-domain generalization.** The model transfers across tool domains without per-domain retraining — suggesting it's learning general principles of what makes a tool description LLM-readable.
- **Open artifacts.** Both model (Qwen3-4B on HuggingFace) and dataset released — unusual for enterprise ML research. Apache 2.0.

**Deep thread (paper → model → dataset):** The HF model page links `intuit/tool-optimizer-dataset` which provides the structured high-quality tool interfaces used for training. The base model is Qwen3-4B-Instruct-2507, SFT'd. This is a practical, deployable tool: run every tool description through the optimizer before presenting to your agent.

**Connects to:** MCP tool schema bloat (ContextCache pattern, ContextForge's TOON compression — Discovery 1); Agent Skills ecosystem (agentskills.io — skill descriptions need the same optimization); SimpleTool (speculative decoding for function calls) — faster generation and better tool selection are complementary optimizations.

---

## Discovery 3: [NEW] NVIDIA NeMo Agent Toolkit — Framework-Agnostic Agent Optimization with RL Fine-Tuning and Dynamo Integration

**Source:** GitHub — https://github.com/NVIDIA/NeMo-Agent-Toolkit (1,861⭐, created Mar 2025, actively pushed Mar 7 2026)

**What it is:** NVIDIA's open-source library for instrumenting, profiling, evaluating, and optimizing AI agent teams across *any* framework (LangChain, LlamaIndex, CrewAI, Semantic Kernel, Google ADK, Strands, AutoGen, or custom). Not an agent framework itself — it's the **optimization layer** that wraps around existing frameworks.

**Why it matters — agent optimization as a distinct engineering discipline:**
- **Automatic RL fine-tuning.** Uses built-in evaluation as a verifier for GRPO (via OpenPipe ART) or DPO (via NeMo Customizer). This means: run your agent, evaluate it, generate training signal, fine-tune the LLM to better understand your specific workflows/tools/prompts — automated loop.
- **NVIDIA Dynamo Integration with agent-aware routing.** This is architecturally novel: an inference server that **predicts future agent behavior** to optimize worker allocation. The router knows "this agent is about to do 3 sequential tool calls then a long generation" and routes accordingly. This is the infrastructure-level analogue of the AgentCgroup paper's "tool-call-level resource control."
- **Profiling at token granularity.** Profile entire workflows from agent → tool → token level to identify bottlenecks. This is the agent equivalent of a CPU profiler — essential for optimization but previously missing from the ecosystem.
- **Safety and Security Engine.** Red-teaming agents with scenario-based attacks, risk profiling, guardrail evaluation. Connects to the "Guarding Agentic Reasoning" (MOSAIC) paper's safety training — NeMo Agent Toolkit provides the evaluation infrastructure to validate those defenses.
- **A2A protocol support** for distributed agent teams with authentication.
- **LangGraph auto-wrapper** — onboard existing LangGraph agents with minimal code changes.

**Why this is significant at the ecosystem level:** NVIDIA is positioning not as an agent *framework* builder (like LangChain, CrewAI) but as the **DevOps/MLOps layer for agents**. The analogy: if LangChain is the web framework, NeMo Agent Toolkit is the APM + CI/CD + profiler. This fills a gap no other major player has targeted systematically.

**Connects to:** AgentTrace (observability); HACRL (RL for heterogeneous agents — NeMo's RL fine-tuning is the production version); DIG (interaction graphs — NeMo's profiling generates similar execution graphs); RagaAI-Catalyst (16k⭐ — agent observability/monitoring, but NeMo goes further with optimization).

---

## Discovery 4: [NEW] Agentation — Visual Feedback Tool for AI Coding Agents (2,721⭐)

**Source:** GitHub — https://github.com/benjitaylor/agentation (2,721⭐, created Jan 18 2026, TypeScript)

**What it is:** An agent-agnostic UI component that lets you click elements on a web page, add annotations, and copy structured output (with CSS selectors, positions, and context) that helps AI coding agents find the exact code you're referring to.

**Why it matters — solving the "show the agent what you mean" problem:**
- **Bridging visual intent to code location.** Instead of describing "the blue button in the sidebar," you click it and the agent gets `.sidebar > button.primary` with precise coordinates and context. This converts spatial/visual references into machine-actionable code paths.
- **Agent-agnostic.** Works with any coding agent — outputs structured markdown that any tool can consume.
- **Zero dependencies.** Pure CSS animations, no runtime libraries. Single React component (`<Agentation />`).
- **Multi-select and area selection.** Drag to select multiple elements or annotate empty space (layout areas, spacing issues).
- **Animation pause.** Freeze all animations (CSS, JS, videos) to capture specific visual states — solving the temporal problem of describing dynamic UIs to agents.
- **2,721 stars in ~7 weeks** — high demand for this capability.

**Why this matters for the agent ecosystem:** Current agent-human communication for UI work is almost entirely textual. Agentation introduces a **structured visual annotation protocol** — a standardized way to convert "what I see" into "what the agent should find in code." This is a missing link between GUI agents (which see screenshots) and coding agents (which see source code).

**Connects to:** Phi-4-Reasoning-Vision (UI grounding); Agent-S (computer use); OpenSandbox (GUI agent evaluation). Agentation is the *input* complement to these *output* tools — they help agents act on UIs, Agentation helps humans direct agents to specific UI elements.

---

## Discovery 5: [NEW] OPSDC — On-Policy Self-Distillation for Reasoning Compression (arXiv 2603.05433)

**Source:** HuggingFace Daily Papers — arXiv 2603.05433. Authors: Hejian Sang, Yuanda Xu, Zhengze Zhou, Ran He, Zhipeng Wang.

**What it is:** A method that teaches reasoning models to think more concisely by distilling their own concise behavior back into themselves. No ground-truth answers, no token budgets, no difficulty estimators — just a "be concise" instruction to generate teacher logits, then minimize per-token reverse KL on the student's own rollouts.

**Why it matters — 57-59% token reduction while *improving* accuracy:**
- **Results are striking.** On Qwen3-8B and Qwen3-14B: 57-59% token reduction on MATH-500 while *improving accuracy by 9-16 points absolute*. On AIME 2024: 14B model gains 10 points with 41% compression.
- **Much reasoning is actively harmful.** The paper's key finding: a significant portion of what reasoning models produce is "not just redundant — it is actively harmful." Verbose reasoning introduces noise, self-contradiction, and distraction. Compression removes the noise, leaving cleaner reasoning chains.
- **Automatic difficulty calibration.** OPSDC compresses easy problems aggressively while preserving deliberation for hard ones — without any explicit difficulty estimator. The compression ratio is emergent from the self-distillation process.
- **Dead simple.** One idea: self-distillation from concise to standard. No specialized infrastructure.

**Agent implications:** Reasoning models are increasingly used as agent backbones (e.g., high-reasoning variants on SWE-Bench score 2-4pp higher). But reasoning tokens are expensive — they consume context window and inference budget. OPSDC offers: *cheaper reasoning agents that perform better*. A 57% token reduction in reasoning chains means significantly lower per-step cost in long-horizon agent tasks where every tool-call decision involves reasoning.

**Connects to:** Agent cost optimization (Loomkin's 10 cheap agents for $0.25; Karpathy's autoresearch at $1.80/cycle); StateLM (active context management to reduce KV-cache bloat); the "high reasoning" vs "standard" variants on SWE-Bench (bash-only track) — OPSDC could give high-reasoning performance at standard-reasoning token cost.

---

## Discovery 6: [NEW] V₁: Unifying Generation and Self-Verification for Parallel Reasoners (arXiv 2603.04304)

**Source:** HuggingFace Daily Papers — arXiv 2603.04304. Authors: Harman Singh, Xiuyu Li, Kusha Sareen, Monishwaran Maheswaran, Sijun Tan.

**What it is:** A framework that unifies solution generation and self-verification through efficient pairwise ranking. V₁-Infer uses tournament-based ranking with uncertainty-guided compute allocation for self-verification. V₁-PairRL jointly trains a single model as both generator and pairwise self-verifier.

**Why it matters — pairwise verification beats scalar scoring:**
- **Core insight.** Models are substantially stronger at *pairwise* self-verification ("is solution A better than solution B?") than at *independent* scalar scoring ("rate solution A from 1-10"). This means existing verification approaches (majority voting, reward model scoring) leave significant performance on the table.
- **Tournament-based ranking.** Instead of scoring all candidates independently, V₁ runs a tournament: sample many solutions, then pairs compete head-to-head with the model as judge. Uncertainty-guided allocation focuses verification compute on pairs whose relative correctness is most uncertain.
- **Unified training.** V₁-PairRL trains one model for both generation and pairwise verification — no separate verifier model needed. This reduces the model count for "generate-and-verify" pipelines from 2 to 1.

**Agent implications:** Agents frequently need to choose between alternative action plans, tool selections, or code implementations. V₁'s insight that pairwise comparison > independent scoring applies directly: instead of scoring each possible action independently, have the agent compare actions pairwise. This is cheaper (O(n log n) comparisons in tournament structure vs O(n) but with lower accuracy per comparison) and more reliable. The "unified generation + verification" training is especially relevant for coding agents that generate-then-verify (SWE-Adept pattern, MOSAIC's plan-check-act loop).

**Connects to:** MOSAIC/Guarding Agentic Reasoning (2603.03205 — plan→check→act/refuse; V₁ improves the "check" step); self-testing during generation (SWE-Bench finding: Pearson r=0.72 — models that test their own code perform better; V₁ formalizes this as pairwise verification); OPSDC (Discovery 5 — compression; V₁ + OPSDC = verify better with fewer tokens).

---

## Discovery 7: [NEW] Interactive Benchmarks — Evaluating Models Through Active Information Acquisition (arXiv 2603.04737)

**Source:** HuggingFace Daily Papers — arXiv 2603.04737.

**What it is:** A new evaluation paradigm where models are evaluated on their ability to *actively acquire information* through interaction — asking questions, probing, exploring — under budget constraints. Two instantiations: Interactive Proofs (deduce truths via interaction with a judge) and Interactive Games (reason through strategic interaction).

**Why it matters — standard benchmarks are failing; interactive evaluation is the fix:**
- **Benchmark saturation problem.** Standard benchmarks are increasingly unreliable due to saturation, subjectivity, and poor generalization. Models that ace MMLU/HumanEval may fail at actual interactive reasoning.
- **Active vs passive evaluation.** Current benchmarks measure passive performance (given input, generate output). Interactive Benchmarks measure *active intelligence* — can the model formulate the right questions to acquire the information it needs? This is exactly the agent skill.
- **Budget constraints.** Models can't ask unlimited questions — they must be efficient. This directly measures the agent quality that InfoPO (2603.00656) trains for: asking high-information-gain questions.
- **Interactive Proofs setting.** Models interact with a verifiable judge to deduce mathematical truths — this is a formalization of the "agent + oracle" pattern where the agent doesn't have full information and must strategically query.

**Agent implications:** This is the evaluation framework that agents actually need. An agent operating in the real world is always in an "interactive benchmark" — it has incomplete information and must decide what to ask, search, or probe. The budget constraint mirrors real-world cost/latency constraints. Interactive Benchmarks could become the standard evaluation for agent information-gathering capabilities.

**Connects to:** InfoPO (2603.00656 — trains agents to ask good questions; Interactive Benchmarks evaluates this capability); CowCorpus (2602.17588 — human-agent interaction patterns; Interactive Benchmarks measures the model's interaction strategy quality); "When Should an AI Act?" (2602.22814 — act vs. gather-more-info decisions; this benchmark directly measures that decision quality).

---

## Meta-Pattern: Agent Infrastructure Stack Crystallization

Across all sources this session, a clear **agent infrastructure stack** is emerging:

| Layer | What | Examples Found |
|-------|------|---------------|
| **Gateway/Registry** | Protocol federation, discovery, guardrails | IBM ContextForge (Discovery 1) |
| **Tool Optimization** | Make tools more agent-readable | Intuit Trace-Free+ (Discovery 2), ContextForge TOON compression |
| **Agent Optimization** | Profile, evaluate, RL-fine-tune agents | NVIDIA NeMo Agent Toolkit (Discovery 3) |
| **Human-Agent Interface** | Structured visual annotation for agent direction | Agentation (Discovery 4) |
| **Inference Optimization** | Cheaper, faster reasoning | OPSDC (Discovery 5), V₁ pairwise verification (Discovery 6) |
| **Evaluation** | Interactive, budget-constrained benchmarks | Interactive Benchmarks (Discovery 7) |

**The insight:** The agent ecosystem is no longer building *agents* — it's building the **infrastructure around agents**. Gateways, profilers, tool optimizers, visual annotation tools, evaluation frameworks. This mirrors the maturation pattern of every computing platform: first the runtime (agents themselves), then the tooling ecosystem (everything that makes agents production-ready). We're firmly in the tooling phase.

**Reddit signal (r/LocalLLaMA):** Community discussions confirm this shift. Top threads are no longer "which agent framework should I use?" but practical infrastructure questions: "how do I run multiple agents reliably?", "best tool-calling benchmarks for local models?", "treating LLMs as unreliable dependencies." The framing has shifted from excitement about agent capabilities to engineering around agent limitations.
