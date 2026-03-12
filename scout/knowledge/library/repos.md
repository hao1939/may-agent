# Scout Repos

Interesting GitHub repos — tracked, watched, or archived.

---

## huggingface/skills ⭐ HB12 — Agent Skills for Coding Tools
- **URL:** https://github.com/huggingface/skills
- **Stars:** 5,017 (+2,174 this week — #1 trending Python) | Active
- **What it does:** Distributable "skills" (structured markdown + scripts) that teach Claude Code, Codex, Cursor, OpenCode domain knowledge. Skills install into `.claude/skills/` or equivalent. CUDA kernels skill shipped Feb 13 → explains the spike.
- **Why interesting:** This is HuggingFace's agent-skills distribution mechanism. The pattern: package deep domain expertise (CUDA kernel writing, LLM training, model teaching) as a ~550-token skill that coding agents can read on demand. Works with any coding agent that supports skill files.
- **Status:** watching closely — the agent-skills ecosystem is converging fast

## muratcankoylan/Agent-Skills-for-Context-Engineering ⭐ HB12 — Skills for Multi-Agent Context Engineering
- **URL:** https://github.com/muratcankoylan/Agent-Skills-for-Context-Engineering
- **Stars:** 9,743 (+981 this week) | Active
- **What it does:** Comprehensive collection of agent skills for context engineering, multi-agent architectures, and production agent systems. 9.7k stars, community-built.
- **Why interesting:** Larger than HF skills repo. Strong signal that "agent skills as distributable packages" is a mainstream concept. Content focuses specifically on context management — directly relevant to the KV-cache/context engineering work we tracked from Manus.
- **Status:** watching

## databricks-solutions/ai-dev-kit ⭐ HB12 — Databricks Coding Agent Toolkit
- **URL:** https://github.com/databricks-solutions/ai-dev-kit
- **Stars:** 652 (+327 this week — #7 trending Python) | Active
- **What it does:** Skills + MCP server (50+ tools) + full-stack visual builder app for coding agents on Databricks. Works with Claude Code, Cursor, Windsurf, Codex. Covers Spark Pipelines, Databricks Jobs, AI/BI Dashboards, Unity Catalog, MLflow, Model Serving, Databricks Apps.
- **Why interesting:** First-party Databricks toolkit for coding agents. Skills-only mode, MCP-only mode, or full dev kit. Uses `databricks-tools-core` Python library for direct integration with LangChain/OpenAI/etc. The builder app has a full-stack chat UI backed by Claude Code.
- **Status:** watching — practical enterprise data/ML agent integration reference

## RichardAtCT/claude-code-telegram ⭐ HB12 — Claude Code via Telegram Bot
- **URL:** https://github.com/RichardAtCT/claude-code-telegram
- **Stars:** 1,614 (+1,287 this week — #11 trending Python) | Active
- **What it does:** Telegram bot providing remote access to Claude Code with full session persistence. Two modes: Agentic (natural language, conversational) and Classic (13 terminal-like commands + inline keyboards). Webhook API server (GitHub HMAC-SHA256), cron scheduler, 16 configurable tools (allowlist/disallowlist), audit logging, SQLite, cost tracking.
- **Why interesting:** Fully-featured mobile remote coding setup. Particularly impressive: webhook integration (GitHub push/PR → Claude analysis), proactive CI/CD notifications, tunable verbosity showing Claude's reasoning in real-time. Anti-prompt-injection architecture. Shows what production-grade Claude Code tooling looks like.
- **Status:** watching — good reference architecture for agent UI/mobile integration

## anthropics/claude-code-security-review ⭐ HB12 — Official Claude Code Security GitHub Action
- **URL:** https://github.com/anthropics/claude-code-security-review
- **Stars:** 3,256 (+236 this week) | MIT License
- **What it does:** GitHub Action using Claude Code for semantic PR security review. Analyzes diffs for 15+ vulnerability classes (injection, auth bypass, secrets, crypto, deserialization, XSS, TOCTOU). Posts findings directly on PR lines. Also shipped as built-in `/security-review` slash command in Claude Code.
- **Why interesting:** Official Anthropic release. Default model: claude-opus-4-1-20250805. Customizable false-positive filtering. This is Anthropic's bet on agentic security review as a killer app for Claude Code in enterprise CI/CD workflows.
- **Status:** watching

## multi-agent-systems-failure-taxonomy/MAST ⭐ HB12 — Multi-Agent System Failure Taxonomy
- **URL:** https://github.com/multi-agent-systems-failure-taxonomy/MAST
- **Stars:** (academic project, IBM+Berkeley) | Active
- **What it does:** Taxonomy and tooling for diagnosing how multi-agent systems fail. 14 failure modes across 3 categories. 1600+ annotated traces available. Dataset on HuggingFace.
- **Why interesting:** The most rigorous framework we've seen for understanding *why* agents fail (not just whether they pass). IBM+Berkeley applied it to ITBench traces across Gemini-3-Flash, Kimi-K2, GPT-OSS-120B — findings directly actionable: externalize verification for frontier models, use state machines for termination.
- **Status:** watching — key reference for production agent debugging


- **URL:** https://github.com/openai/openai-agents-python
- **Stars:** (growing fast) | **Last active:** 2026-02-24 (active)
- **What it does:** Official OpenAI lightweight multi-agent framework. Provider-agnostic (100+ LLMs), built-in sessions (Redis), tracing, guardrails, handoffs, voice support.
- **Why interesting:** Simplest entry point of the Big-3 SDKs. `Agent(name, instructions)` + `Runner.run_sync()`. Redis session support for persistence. ChatKit for embedding agent UIs. Direct competitor to AWS Strands and Microsoft Agent Framework.
- **Status:** watching — new entry in the Big-3 platform wars

---

## strands-agents/tools — Strands Agents Tool Library
- **URL:** https://github.com/strands-agents/tools
- **Stars:** (community-driven) | **Last active:** 2026-02-24 (active)
- **What it does:** Comprehensive tool library for Strands SDK: file ops, shell, memory (Mem0/Bedrock KB/Elasticsearch/MongoDB), web (Tavily/Exa), HTTP client, Slack, Python execution, math, AWS, image/video/audio, journaling, cron scheduling, reasoning tools, swarm intelligence, MCP client, parallel batch calls, browser (Chromium).
- **Why interesting:** "Swarm Intelligence" tool coordinates multiple agents with shared memory — this is a built-in multi-agent primitive. Dynamic MCP Client with explicit ⚠️ security warning. Browser tool built in. This is the most comprehensive open tool library for any agent framework we've seen.
- **Status:** watching — production tools reference

---

## langchain-ai/langgraph ⭐ NEW
- **URL:** https://github.com/langchain-ai/langgraph
- **Stars:** large (trusted by Klarna, Replit, Elastic in production)
- **What it does:** Low-level stateful agent orchestration as graphs. Core focus: durable execution (resume from failures), HITL, persistent memory, LangSmith observability.
- **Why interesting:** The engine under LangSmith Agent Builder. Explicitly NOT high-level — it doesn't abstract prompts or architecture. The "durable execution" framing (auto-resume from failures) is its clearest differentiator. Pairs with LangGraph Studio (visual prototyping) and LangSmith Deployment (production scaling). Used by real enterprises at scale.
- **Status:** watching

---


- **URL:** https://github.com/microsoft/agent-framework
- **Stars:** early (pre-release) | **Last active:** 2026-02-24 (actively building)
- **What it does:** Comprehensive multi-language (Python + .NET) framework for building, orchestrating, and deploying AI agents. Graph-based workflows with streaming, checkpointing, HITL, and time-travel (replay/rewind). Migration guides from both AutoGen and Semantic Kernel.
- **Why interesting:** This is where Microsoft is consolidating everything. AutoGen redirects here. Semantic Kernel migration guide is provided. AF Labs has RL/benchmarking experiments. DevUI for live workflow debugging. OpenTelemetry built in. Time-travel (agent state rewind) is novel.
- **Status:** watching closely — this is the Microsoft agent endgame

---

## Strands Agents SDK — strands-agents/sdk-python ⭐ UPDATED
- **URL:** https://github.com/strands-agents/sdk-python
- **Stars:** early but production deployments confirmed | **Last active:** 2026-02-24
- **What it does:** AWS open-source agent SDK. `@tool` decorator + docstring-as-description. Native MCP, hot-reloading from directory, model-agnostic (Bedrock/Anthropic/Gemini/Llama/Ollama/Cohere/custom).
- **Why interesting:** Cleanest tool definition API seen. Hot-reload `./tools/` directory. A2A + MCP native. First-class AWS deployment. Mentioned in Anthropic's canonical "Building Effective Agents" blog. Real enterprise deployments with striking ROI numbers.
- **Status:** watching — note the `@tool` pattern and docstring convention


## microsoft/autogen
- **URL:** https://github.com/microsoft/autogen
- **Stars:** ~45k+ | **Last active:** 2026-02-24 (very active, daily commits)
- **What it does:** Multi-agent framework with GraphFlow, AgentChat, AutoGen Studio GUI, MCP integration
- **Why interesting:** v0.7.5 with concurrent GraphFlow, streaming tools, RedisMemory, MCP. But README now redirects newcomers to `microsoft/agent-framework`. Still active but becoming the "legacy" path.
- **Status:** watching (transitioning to agent-framework)

---

## crewAIInc/crewAI
- **URL:** https://github.com/crewAIInc/crewAI
- **Stars:** ~30k+ | **Last active:** 2026-02-19 (pre-release active)
- **What it does:** Role-based multi-agent framework with Crews, Flows, and now A2A protocol support
- **Why interesting:** v1.10.0a1 — Unified Memory, A2A, full async, StagehandTool, HITL in Flows. First major framework to make A2A first-class. Now competing directly with Strands and Microsoft AF on the A2A front.
- **Status:** watching

---

## khoj-ai/khoj
- **URL:** https://github.com/khoj-ai/khoj
- **Stars:** ~30k+ | **Last active:** 2026-02-24 (trending this week)
- **What it does:** Self-hostable personal AI — custom agent builder, document chat, web search, scheduled automations, deep research mode
- **Why interesting:** Consumer-facing agent harness. Supports Obsidian, WhatsApp, Emacs. Good reference for UX patterns for personal agent deployments.
- **Status:** watching

---

## OpenBB-finance/OpenBB
- **URL:** https://github.com/OpenBB-finance/OpenBB
- **Stars:** ~61.7k | **Last active:** 2026-02-24 (1,084 stars this week — top Python trending)
- **What it does:** "Open Data Platform" — financial data infrastructure with MCP server for AI agents, Python API, REST, Excel
- **Why interesting:** MCP-for-domain-data pattern. "Connect once, consume everywhere" architecture. Domain-specific agent tooling becoming mainstream.
- **Status:** one-time
- **URL:** https://github.com/microsoft/autogen
- **Stars:** ~45k+ | **Last active:** 2026-02-24 (very active, daily commits)
- **What it does:** Multi-agent framework with GraphFlow, AgentChat, AutoGen Studio GUI, MCP integration
- **Why interesting:** One of the top 2 agent frameworks. v0.7.5 adds concurrent GraphFlow agents (fan-out/fan-in), streaming tools, RedisMemory, full MCP support. Microsoft now also has a separate "Microsoft Agent Framework" being spun up — worth watching what that is.
- **Status:** watching

---

## crewAIInc/crewAI
- **URL:** https://github.com/crewAIInc/crewAI
- **Stars:** ~30k+ | **Last active:** 2026-02-19 (pre-release active)
- **What it does:** Role-based multi-agent framework with Crews, Flows, and now A2A protocol support
- **Why interesting:** v1.10.0a1 is a significant release — Unified Memory, A2A agent-to-agent communication, full async, StagehandTool browser automation, HITL in Flows. The A2A protocol adoption is the most interesting thing here — first major framework to make agent-to-agent a first-class transport.
- **Status:** watching

---

## khoj-ai/khoj
- **URL:** https://github.com/khoj-ai/khoj
- **Stars:** ~30k+ | **Last active:** 2026-02-24 (trending this week)
- **What it does:** Self-hostable personal AI — custom agent builder, document chat, web search, scheduled automations, deep research mode
- **Why interesting:** Consumer-facing agent harness that packages the core concepts (multi-LLM, custom agents, knowledge bases, scheduling) into a user-friendly app. Good reference for what "agents for people" looks like in practice. Supports Obsidian, WhatsApp, Emacs integrations.
- **Status:** watching

---

## OpenBB-finance/OpenBB
- **URL:** https://github.com/OpenBB-finance/OpenBB
- **Stars:** ~61.7k | **Last active:** 2026-02-24 (1,084 stars this week — top Python trending)
- **What it does:** "Open Data Platform" — financial data infrastructure for quants, analysts, and AI agents. "Connect once, consume everywhere": Python API, MCP server for AI agents, REST API, Excel integration, all from one data connector layer.
- **Why interesting:** The explicit "for AI agents" positioning of financial data tooling. They expose data via MCP servers so agents can query equity prices, fundamentals, etc. directly. The architecture pattern (one data layer, multiple consumption surfaces including agents) is a good model for domain-specific agent tooling. 61k stars and actively growing.
- **Status:** one-time (note the MCP-for-domain-data pattern)
- **URL:** https://github.com/microsoft/autogen
- **Stars:** ~45k+ | **Last active:** 2026-02-24 (very active, daily commits)
- **What it does:** Multi-agent framework with GraphFlow, AgentChat, AutoGen Studio GUI, MCP integration
- **Why interesting:** One of the top 2 agent frameworks. v0.7.5 adds concurrent GraphFlow agents (fan-out/fan-in), streaming tools, RedisMemory, full MCP support. Microsoft now also has a separate "Microsoft Agent Framework" being spun up — worth watching what that is.
- **Status:** watching

---

## crewAIInc/crewAI
- **URL:** https://github.com/crewAIInc/crewAI
- **Stars:** ~30k+ | **Last active:** 2026-02-19 (pre-release active)
- **What it does:** Role-based multi-agent framework with Crews, Flows, and now A2A protocol support
- **Why interesting:** v1.10.0a1 is a significant release — Unified Memory, A2A agent-to-agent communication, full async, StagehandTool browser automation, HITL in Flows. The A2A protocol adoption is the most interesting thing here — first major framework to make agent-to-agent a first-class transport.
- **Status:** watching

---

## khoj-ai/khoj
- **URL:** https://github.com/khoj-ai/khoj
- **Stars:** ~30k+ | **Last active:** 2026-02-24 (trending this week)
- **What it does:** Self-hostable personal AI — custom agent builder, document chat, web search, scheduled automations, deep research mode
- **Why interesting:** Consumer-facing agent harness that packages the core concepts (multi-LLM, custom agents, knowledge bases, scheduling) into a user-friendly app. Good reference for what "agents for people" looks like in practice. Supports Obsidian, WhatsApp, Emacs integrations.
- **Status:** watching

## Agent-Skills-for-Context-Engineering
- **URL:** https://github.com/muratcankoylan/Agent-Skills-for-Context-Engineering
- **Stars:** 9,624 | **Last active:** 2026-02-25 (771 stars today, trending)
- **What it does:** Comprehensive collection of Agent Skills for context engineering, multi-agent architectures, and production agent systems
- **Why interesting:** Community-built companion to the official Agent Skills standard. Covers the full stack: context fundamentals → degradation patterns → multi-agent architectures → memory systems → evaluation → BDI cognitive modeling. Cited in academic research (MCE paper, Peking U, 2026).
- **Status:** watching

## anthropics/skills
- **URL:** https://github.com/anthropics/skills
- **Stars:** trending | **Last active:** 2026-02-25
- **What it does:** Anthropic's official public Agent Skills repository — spec, template, and example skills (creative, technical, enterprise, document)
- **Why interesting:** Authoritative reference for the Agent Skills format. Contains the formal spec in `./spec`. Links to `agentskills.io` as the canonical standard home. Adopted by 15+ tools. Installable via Claude Code plugin: `/plugin marketplace add anthropics/skills`
- **Status:** watching

## memU (NevaMind-AI)
- **URL:** https://github.com/NevaMind-AI/memU
- **Stars:** 10,429 | **Last active:** 2026-02-25 (500 stars today, trending)
- **What it does:** Memory framework for 24/7 proactive agents — filesystem-organized memory + intent prediction + background memory bot
- **Why interesting:** Directly solves always-on agent token cost problem. Dual-agent architecture (Main Agent + MemU Bot). Filesystem memory model (categories/items/cross-refs). Intent prediction enables proactive action. Targets our exact use case (openclaw, moltbot, clawdbot explicitly mentioned).
- **Status:** watching

## PageIndex
- **URL:** https://github.com/VectifyAI/PageIndex
- **Stars:** trending (no count visible) | **Last active:** Feb 2026
- **What it does:** Vectorless RAG using hierarchical tree index + LLM reasoning for retrieval over long professional documents.
- **Why interesting:** 98.7% on FinanceBench, no vector DB, no chunking, MCP integration available.
- **Status:** watching

## 2026-02-26 GitHub Trending — New Entries

### bytedance/deer-flow ★23,965 (+3,347/week)
- **URL:** https://github.com/bytedance/deer-flow
- **Why it matters:** ByteDance's SuperAgent harness, now at v2.0 (ground-up rewrite — no code shared with v1 deep research framework). Full stack: Skills+Tools, Sub-Agents, Sandbox+Filesystem, Context Engineering, Long-Term Memory. TypeScript. Production-grade, has official website (deerflow.tech). The 1.x branch was deep research only; 2.0 is a general SuperAgent harness. Low daily stars today (55) but high cumulative.
- **Connects to:** Direct competitor/complement to obra/superpowers. Both are "SuperAgent harness" frameworks. DeerFlow is TypeScript+LangChain; superpowers is Shell. DeerFlow adds sandbox+filesystem as first-class primitives.

### katanemo/plano ★5,541 (+199/day)
- **URL:** https://github.com/katanemo/plano
- **Why it matters:** AI-native proxy + data plane for production agentic apps. Moves "hidden middleware" out-of-process: agent routing/orchestration, Agentic Signals™ (zero-code OTEL traces), guardrail Filter Chains (jailbreak/moderation), LLM routing by name/alias/preference. Built in Rust. Solves the "demo → production" gap for agent delivery.
- **Connects to:** Architectural complement to MCP (Theme 2). Where MCP is the tool connectivity layer, Plano is the delivery/observability/routing layer above it. Relevant to MAESTRO (threat model) — Plano's Filter Chains are the runtime enforcement mechanism.

### yichuan-w/LEANN ★10,090 (+60/day)
- **URL:** https://github.com/yichuan-w/LEANN
- **Why it matters:** MLsys2026 paper. 97% storage reduction for RAG via graph-based selective recomputation — computes embeddings on-demand instead of storing them all. Runs on laptop/personal device. MCP native integration. Cross-platform (Ubuntu/Arch/WSL/macOS ARM/Intel). Paper: arXiv:2506.08276.
- **Connects to:** Theme 13 (retrieval layer). PageIndex (vectorless reasoning RAG) + LEANN (97% storage savings) together represent a major shift away from traditional dense vector stores. LEANN's on-demand computation is the storage equivalent of EGSS's on-demand token allocation.

### abhigyanpatwari/GitNexus ★3,642 (+936/day)
- **URL:** https://github.com/abhigyanpatwari/GitNexus
- **Why it matters:** Builds a knowledge graph of any codebase (Tree-sitter parsing, KuzuDB storage) and exposes it via MCP so AI agents get full architectural context. Solves dependency/call-chain blindness in coding agents. Even smaller models get full architectural clarity. CLI+MCP for daily dev; Web UI for exploration.
- **Connects to:** MCP tool connectivity layer (Theme 2). Direct answer to coding agent underspecification (Theme 3) — agents that can't see call chains fail on refactoring. Competes with DeepWiki (understanding) but targets agents specifically (analysis+navigation).

## 2026-02-26 Weekly Trending — New Entries

### cloudflare/agents ★4,249 (+1,004/week)
- **URL:** https://github.com/cloudflare/agents
- **Why it matters:** Persistent stateful agent execution on Cloudflare edge via Durable Objects. Each agent instance has own state, storage, lifecycle — built-in MCP support, scheduling, real-time communication, AI model calls, workflows. **Hibernates when idle, wakes on demand — millions of agents at near-zero idle cost.** This solves the "always-on agent" infrastructure problem at scale.
- **Connects to:** Plano (katanemo) is the data plane for routing/guardrails; cloudflare/agents is the execution substrate. Together they sketch a production agent infrastructure stack. The per-user/per-session agent pattern is exactly what memU (NevaMind) targets for persistent memory. MCP built-in = natural fit with MCP tool ecosystem (Theme 2).

### alibaba/zvec ★7,911 (+3,141/week)
- **URL:** https://github.com/alibaba/zvec
- **Why it matters:** In-process vector database (no server, no config) built on Alibaba's battle-tested Proxima engine. Dense+sparse vectors, hybrid search (semantic + structured filters), Python+JS bindings. Runs in notebooks, servers, CLI, edge. pip install zvec and go.
- **Connects to:** Theme 13 retrieval layer. The "no server" angle is the same philosophy as LEANN (no stored embeddings) and PageIndex (no vector index). Together these three represent a new "lightweight RAG" stack: zvec (in-process dense/sparse), LEANN (97% storage savings via recomputation), PageIndex (vectorless reasoning). Could replace Chroma/Qdrant/Weaviate for most agent use cases.

### ruvnet/claude-flow ★14,672 (+210/day)
- **URL:** https://github.com/ruvnet/claude-flow
- **Why it matters:** Multi-agent orchestration platform specifically for Claude. Distributed swarm intelligence, autonomous workflows, RAG integration, native Claude Code + Codex integration. TypeScript. Enterprise-grade architecture framing. From same author as ruvector (Rust vector GNN). 14k+ stars suggests substantial adoption.
- **Connects to:** Sits between DeerFlow (ByteDance SuperAgent harness) and cloudflare/agents (execution substrate). Claude-flow is the orchestration layer; cloudflare/agents is the stateful execution layer; Plano is the delivery/guardrails layer. Together these sketch a full agent production stack.

### alibaba/OpenSandbox ★4,314 (+1,026/day — Helm Chart release Mar 2)
- **URL:** https://github.com/alibaba/OpenSandbox
- **Stars/Activity:** 1,262 stars, 101 forks. New entry (HB44, Feb 26 UTC)
- **What it does:** General-purpose sandbox platform for AI applications from Alibaba. Multi-language SDKs (Python, Java/Kotlin, JS/TS), Docker and Kubernetes runtimes, lifecycle management APIs. Built-in Command/Filesystem/Code Interpreter sandboxes. Network policy: unified Ingress Gateway + per-sandbox egress controls.
- **Why interesting:** Explicitly built for: Coding Agents (e.g., Claude Code examples), GUI Agents, Agent Evaluation, AI Code Execution, and RL Training. This is the "agent execution substrate" play — same problem space as AgentCgroup (resource control) and cloudflare/agents (stateful execution), but from the infra/DevOps angle. Production-grade: supports large-scale distributed scheduling via K8s.
- **Connects to:** AgentCgroup (2602.09345) — same intent, different layer (AgentCgroup is OS/eBPF; OpenSandbox is application/SDK). Together they're the emerging "agent runtime infrastructure" stack. Theme 7 (Agent Infrastructure/OS-Level). cloudflare/agents (execution substrate), Plano (delivery/guardrails layer).

### MoonshotAI/kimi-cli ★(trending)
- **URL:** https://github.com/MoonshotAI/kimi-cli
- **Stars/Activity:** Trending Feb 26 (no count captured). Active development.
- **What it does:** Kimi Code CLI — AI coding agent in the terminal by MoonshotAI (Kimi). Reads/edits code, executes shell commands, searches/fetches web pages, autonomous planning. Integrated shell mode (Ctrl-X). VS Code extension. Supports MCP tools natively.
- **Why interesting:** First notable Chinese lab CLI agent to enter GitHub trending alongside Claude Code derivatives. More importantly: supports **Agent Client Protocol (ACP)** out of the box — a new protocol for editor-to-agent communication (JetBrains, Zed support it). ACP is distinct from A2A (agent-to-agent) and MCP (tool connectivity). Kimi-cli's adoption signals ACP is gaining multi-vendor traction.
- **Connects to:** Theme 4 (Protocol Wars — A2A, MCP, now ACP). Claude Code ecosystem. ACP protocol (agentclientprotocol/agent-client-protocol) is a parallel standardization effort to MCP/A2A but for the IDE/editor layer.

### bytedance/trae-agent ★(trending Feb 27)
- **URL:** https://github.com/bytedance/trae-agent
- **Stars/Activity:** Entered Python trending Feb 27 evening. Active development.
- **What it does:** ByteDance's open-source CLI coding agent for general-purpose software engineering tasks. Multi-LLM support (OpenAI, Anthropic, Doubao, Azure, OpenRouter, Ollama, Gemini). Tools: file editing, bash execution, sequential thinking. "Lakeview" feature: concise summarisation of agent steps. Trajectory recording for debugging/analysis. YAML config. Has a technical report on arXiv (2507.23370).
- **Why interesting:** Research-friendly design is the differentiator — explicitly positioned for ablation studies and agent architecture research, not just end-user deployment. Trajectory recording is built-in (vs AgentTrace which is an add-on). ByteDance entering the CLI coding agent race alongside Claude Code, Kimi Code CLI, OpenAI Codex CLI. The "Lakeview" step summarisation is a novel UX pattern for long coding agent sessions.
- **Connects to:** Theme 5 (Big-4 Platform Wars — now expanding to Big-N). claude-code-telegram, kimi-cli (MoonshotAI), DeerFlow 2.0 (also ByteDance). AgentTrace (2602.10133) — trajectory recording for agent debugging. ACP protocol (editor↔agent layer). ByteDance now has two agent repos in trending simultaneously (trae-agent + DeerFlow 2.0).

### vercel-labs/just-bash ★1,462 (+258/day)
- **URL:** https://github.com/vercel-labs/just-bash
- **Stars/Activity:** 1,462 stars, 77 forks. Entered TypeScript trending Feb 28. Vercel Labs official.
- **What it does:** Simulated bash environment with in-memory virtual filesystem for AI agents. Secure-by-default: no network access, no binaries/WASM, infinite loop/recursion protection (execution protected against DOS from input). Optional network via curl with URL prefix + HTTP-method allow-lists. "Vercel Sandbox Compatible API." TypeScript SDK — `npm install just-bash`. Each exec() is isolated (env vars, functions, cwd don't persist between calls unless explicitly managed).
- **Why interesting:** This is Vercel's answer to the "give agents a safe bash environment" problem. The design philosophy is: in-memory filesystem = no host damage; allow-lists = zero-trust network; AST transform plugins = extensible execution control. The Vercel Sandbox Compatible API means it's a drop-in for agents currently using Vercel Sandbox but want a lightweight local version. Critical for any agent that needs shell access without full VM overhead. Complements OpenSandbox (full K8s/Docker) at the lightweight/embedded end.
- **Connects to:** Theme 7 (Agent Infrastructure). alibaba/OpenSandbox (heavy K8s/Docker end of same spectrum). AgentCgroup (OS-level resource control). Plano (routing/guardrails). The sandboxing spectrum: just-bash (in-process, lightweight) → OpenSandbox (containerized, production-grade). Agent practitioners who found Docker sandboxing "reckless" (HB47 Reddit post) — just-bash is a pragmatic middle ground.

### ruvnet/ruflo ★15,940 (+531/day)
- **URL:** https://github.com/ruvnet/ruflo
- **Stars/Activity:** 15,940 stars, 1,828 forks. TypeScript trending Feb 28. ruvnet (same creator as wifi-densepose).
- **What it does:** Agent orchestration platform for Claude. Multi-agent swarms, RAG integration, native Claude Code / Codex integration, distributed swarm intelligence. TypeScript. Enterprise-grade architecture claims. "Leading agent orchestration platform for Claude."
- **Why interesting:** 15,940 stars is significant. ruvnet is a prolific creator building Claude-ecosystem tooling. Native Claude Code integration + Agent Skills compatibility suggests tight alignment with Anthropic's platform direction. "Swarm intelligence" framing is similar to claude-flow (which we archived). The 531 stars/day suggests active community adoption. Note: ruvnet repos tend toward ambitious marketing descriptions — evaluate by adoption metrics, not README claims.
- **Connects to:** Theme 5 (Platform Wars). claude-flow (similar scope — multi-agent orchestration for Claude). DeerFlow 2.0 (ByteDance — same tier, different ecosystem). Agent-Skills-for-Context-Engineering (same creator ecosystem). The Claude multi-agent orchestration layer is getting crowded: cloudflare/agents + ruflo + claude-flow + DeerFlow all targeting similar use cases.

### vxcontrol/pentagi (PentAGI) ★8,613 (+5,598/week)
- **URL:** https://github.com/vxcontrol/pentagi
- **Stars/Activity:** 8,613 stars, 961 forks. 5,598 stars this week — weekly trending #2. Go.
- **What it does:** Fully autonomous AI agent system for penetration testing. 20+ built-in security tools (nmap, metasploit, sqlmap, etc.). Docker sandboxed — all operations isolated. Knowledge graph via Graphiti/Neo4j for semantic relationship tracking. Long-term memory for storing successful attack approaches. Multi-agent: separate agents for reconnaissance, exploitation, reporting. Built-in web browser/scraper for OSINT. External search (Tavily, Perplexity, DuckDuckGo, Google CSE). LLM-agnostic.
- **Why interesting:** The intersection of autonomous agents and offensive security is a dual-use concern we've been tracking theoretically (Zombie Agents, Skill-Inject, MCP attack vectors). PentAGI makes it concrete: a production-grade, open-source autonomous hacking agent with enterprise tooling. The knowledge graph + long-term memory for "storing successful approaches" is exactly the capability that makes autonomous agents dangerous at scale — it learns and reuses successful exploits. For defenders: the attack surface we've been modeling is real and tooled.
- **Connects to:** Theme 3a (Tool/MCP Supply Chain Attacks) + Theme 11 (Agent Security). Zombie Agents (2602.15654) — persistent memory poisoning → PentAGI uses persistent memory for attack patterns. AgentSentry (trajectory-level attack detection) — PentAGI's multi-agent coordination is what AgentSentry would need to detect. DeepAudit (lintsinghua/DeepAudit, previously noted) — code security multi-agent. This is the "red team" side of agent security.

### x1xhlol/system-prompts-and-models-of-ai-tools ★(weekly trending)
- **URL:** https://github.com/x1xhlol/system-prompts-and-models-of-ai-tools
- **Stars/Activity:** Weekly trending Feb 28. Compiled collection of leaked/extracted system prompts.
- **What it does:** Collection of full system prompts and model info for: Augment Code, Claude Code, Cluely, CodeBuddy, Comet, Cursor, Devin AI, Junie, Kiro, Leap.new, Lovable, Manus, NotionAI, Orchids.app, Perplexity, Poke, Qoder, Replit, Same.dev, Trae, Traycer AI, VSCode Agent, Warp.dev, Windsurf, Xcode, Z.ai Code, Dia, v0.
- **Why interesting:** Contains Manus system prompt — direct window into how a production multi-agent system instructs its agents. Also Claude Code, Cursor, Devin prompts for comparison. The existence and popularity of this repo (weekly trending) confirms: system prompts are de facto public knowledge in the agent ecosystem. Security through obscurity on system prompts is ineffective.
- **Connects to:** Manus context engineering post (their system prompt philosophy). Behavioral Consistency (2602.11619) — agent behavior is partly determined by system prompt consistency. Theme 3a (attack surface includes system prompt extraction). Anthropic RSP drop — if system prompts are public, institutional policy becomes the main differentiation layer.

### NousResearch/hermes-agent ★984 (+183/day)
- **URL:** https://github.com/NousResearch/hermes-agent
- **Stars/Activity:** 984 stars, 156 forks. 183 stars today — daily trending Python. Built with /claude contributor. Python.
- **What it does:** Agent implementation from NousResearch (Hermes model series). NousResearch is known for fine-tuned open-weight models (Hermes line) optimised for tool use and structured output. This is their reference agent harness for the Hermes models.
- **Why interesting:** NousResearch is one of the most respected open-weight fine-tuning labs. A reference agent from them signals that open-weight models now have purpose-built harnesses, not just OpenAI-SDK wrappers. Connects to the BYOA (Val Town) theme — run your own model with your own harness.
- **Connects to:** BYOA philosophy (HB65). anthropics/skills (open-weight vs proprietary model agent comparison). Theme 5 (Platform Wars — open-weight harnesses entering the space).

### ComposioHQ/awesome-claude-skills ★38,921
- **URL:** https://github.com/ComposioHQ/awesome-claude-skills
- **Stars/Activity:** Daily Python trending Feb 28. Composio (tool integration platform).
- **What it does:** Curated list of Claude Skills, resources, and tools for customising Claude AI workflows. Composio is a tool-integration layer (connects agents to 250+ SaaS APIs).
- **Why interesting:** Another "skills" repo trending alongside anthropics/skills (79,169★) and Agent-Skills-for-Context-Engineering (12,652★). The skills/context-engineering theme has 3+ major repos trending simultaneously — now a 4th from Composio, the tool-integration angle. Composio's framing: skills = tools + integration patterns.
- **Connects to:** anthropics/skills (79,169★). Agent-Skills-for-Context-Engineering (muratcankoylan). Theme 4 (MCP/tool layer). Skills momentum day 3+.

### looplj/axonhub ★2,085 (+trending)
- **URL:** https://github.com/looplj/axonhub
- **Stars/Activity:** 2,085 stars, 226 forks. Daily Go trending Feb 28.
- **What it does:** Open-source AI Gateway — single endpoint to call 100+ LLMs using any SDK (OpenAI, Anthropic, etc.). Built-in: failover across providers, load balancing, cost control, end-to-end tracing. Written in Go.
- **Why interesting:** AI Gateway is emerging as a new infrastructure tier between agent harnesses and model providers. axonhub + similar tools (LiteLLM, PortKey) abstract away provider-specific APIs. For multi-agent systems calling different models per task (e.g. GPT-5.3 for coding, Claude Opus 4.6 for reasoning), a gateway layer handles routing, fallback, and cost tracking. The "built-in tracing" connects to LangChain's observability post — traces as source of truth for agent debugging.
- **Connects to:** Theme 7 (Agent Infrastructure). OpenAI $110B/AWS Bedrock stateful runtime (HB71) — gateway sits in front of that. Theme 4 (MCP/tool layer) — gateway is the model-tier equivalent of MCP at the tool tier. sub2api (Wei-Shaw/sub2api, Go trending same day — similar unified LLM proxy concept, Chinese ecosystem).

### xpzouying/xiaohongshu-mcp ★(trending)
- **URL:** https://github.com/xpzouying/xiaohongshu-mcp
- **Stars/Activity:** Daily Go trending Feb 28.
- **What it does:** MCP server for Xiaohongshu (RedNote/小红书). Enables AI agents to interact with Chinese social platform content via MCP.
- **Why interesting:** Xiaohongshu MCP = Chinese social data accessible to agents via standard protocol. Amy's domain (Chinese social platforms) intersecting with Scout's domain (MCP protocol layer). Signals MCP adoption reaching Chinese consumer platforms — not just Western developer tools.
- **Connects to:** Theme 4 (MCP ecosystem growth). datagouv/datagouv-mcp (French gov MCP, HB70 trending) — national platforms building MCP access. ACP protocol stack.

### superset-sh/superset ★2,292 (+156/day)
- **URL:** https://github.com/superset-sh/superset
- **Stars/Activity:** 2,292 stars, 176 forks. 156 stars today — daily TypeScript trending.
- **What it does:** "IDE for the AI Agents Era" — run an army of Claude Code, Codex etc. simultaneously on your machine. Multi-agent parallel execution IDE. TypeScript. Built with /claude contributor.
- **Why interesting:** Parallel multi-agent coding IDE is the harness-engineering answer to "how do you run 10 coding agents at once?" Directly complements Terminal-Bench leaderboard dynamics — top agents (DroidGPT, Terminus-KIRA) are running multi-agent in parallel. 2,292★ with 156/day is strong early momentum.
- **Connects to:** bytedance/trae-agent (trajectory recording coding agent). deepagents-cli (harness engineering). Terminal-Bench leaderboard. BYOA (run your own army of agents). Theme 8 (Agent Engineering).

### Wei-Shaw/claude-relay-service ★8,664 (+171/day)
- **URL:** https://github.com/Wei-Shaw/claude-relay-service
- **Stars/Activity:** 8,664 stars, 1,383 forks. 171 stars today — all-language daily trending. JavaScript.
- **What it does:** Self-hosted Claude Code mirror + unified relay for Claude/OpenAI/Gemini/Droid subscriptions. "Ride-sharing" model — users pool Claude subscriptions and split costs. Single relay endpoint routes to multiple provider backends.
- **Why interesting:** Chinese-ecosystem Claude Code deployment pattern. 8,664★ with 1,383 forks = substantial adoption. The "ride-sharing subscription" model is a pragmatic workaround for subscription costs — essentially an axonhub-style gateway but focused on auth/subscription sharing rather than routing. Same author (Wei-Shaw) also built sub2api (Go, today's trending). Illustrates how Claude Code adoption in China is being driven by unofficial relay infrastructure rather than official channels.
- **Connects to:** axonhub (HB76 — AI Gateway tier). BYOA (HB65 — user-controlled agent deployment). Cloudflare Moltworker (self-hosted OpenClaw). sub2api (same author, Go version). Theme 5 (Platform Wars — Chinese ecosystem building around Western model access).

### lorenzosaraiva/mcpforge ★NEW (v0.1.0)
- **URL:** https://github.com/lorenzosaraiva/mcpforge
- **Stars/Activity:** Fresh v0.1.0 — posted to r/LocalLLaMA ~Mar 1. TypeScript, MIT.
- **What it does:** CLI tool that auto-generates production-ready TypeScript MCP servers from OpenAPI specs. Key differentiator: `--optimize` flag uses Claude to curate noisy endpoint lists into a smaller set of well-named, well-described tools suitable for LLM use. "The difference between dumping a raw API spec on an assistant vs. briefing them on the 20 tools they actually need."
- **Commands:** `mcpforge init <spec-url>` (generate fresh), `mcpforge generate` (re-gen from config), `mcpforge inspect` (preview tools + quality warnings), `mcpforge test` (placeholder). Handles API key / bearer / OAuth2 / basic auth. Outputs Claude Desktop + Cursor-ready config snippets.
- **Why interesting:** Directly solves the "100+ endpoint API → LLM can't pick the right tool" problem documented in MCP Tool Smells (2602.14878). The `--optimize` flag is Claude used to improve tool quality for Claude — recursive. Supply chain concern: MCPForge generates from *known* OpenAPI specs (your own, or public APIs you've reviewed), addressing the practitioner worry about community skill file injection (see reddit.md entry above). `mcpforge inspect` is early-stage static analysis for tool quality warnings.
- **Connects to:** MCP Tool Smells (2602.14878). CE-MCP (2602.15945). MCP Design Choices paper. Theme 4 (MCP/tool layer). Addresses the "tool catalog quality" axis of the MCP tooling problem: not "how do I execute tools" but "which tools should exist and how should they be described."

## 2026-03-01 — anthropics/skills ⭐79,615
- **URL:** https://github.com/anthropics/skills
- **Stars:** 79,615 | Python | Updated: 2026-03-01
- **What:** Official Anthropic repository of Agent Skills for Claude. Skills are SKILL.md-based folders following the agentskills.io open standard. Includes: algorithmic-art, brand-guidelines, canvas-design, doc-coauthoring, docx, frontend-design, internal-comms, **mcp-builder** (guide for building high-quality MCP servers).
- **Why it matters:** First-party Anthropic skill library — the provenance anchor that the ClawHub security post (r/LocalLLaMA 1rhkw1l) says is missing from third-party marketplaces. The mcp-builder skill is a meta-skill: it teaches agents how to build MCP servers, completing the loop from skill ecosystem → MCP ecosystem.
- **Connects to:** agentskills.io standard. MCPForge. CE-MCP (2602.15945). MCP Tool Smells (2602.14878). Supply chain security arc. ClawHub 20% problem rate (reddit.md). Theme 3 (Tool Use) + Theme 11 (Security).

## 2026-03-01 — huggingface/skills ⭐7,571
- **URL:** https://github.com/huggingface/skills
- **Stars:** 7,571 | Python | Updated: 2026-03-01
- **What:** HuggingFace's skills library following the agentskills.io standard. "Interoperable with all major coding agent tools: OpenAI Codex, Anthropic's Claude Code, Google DeepMind's Gemini CLI, and Cursor." Focus on AI/ML tasks (dataset creation, model training, evaluation).
- **Why it matters:** Cross-vendor interoperability confirmed — HuggingFace skills load in Codex, Claude Code, Gemini CLI, Cursor. This is the ecosystem breadth that makes agentskills.io a genuine standard vs. a single-vendor format.
- **Connects to:** agentskills.io. anthropics/skills. muratcankoylan context-engineering skills.

## 2026-03-01 — muratcankoylan/Agent-Skills-for-Context-Engineering ⭐12,775
- **URL:** https://github.com/muratcankoylan/Agent-Skills-for-Context-Engineering
- **Stars:** 12,775 | Python | Updated: 2026-03-01
- **What:** Community collection of agent skills focused on context engineering: curating all information entering the model's context window (system prompts, tool definitions, retrieved docs, message history, tool outputs). Skills for building, optimizing, and debugging production agent systems.
- **Why it matters:** The context engineering framing is distinct from prompt engineering — it addresses the holistic curation problem, not just instruction quality. 12k stars on a community repo in this niche signals strong practitioner demand. Cross-references CMV (2602.22402 — context window management) and InftyThink+ (2602.06960).
- **Connects to:** CMV (2602.22402). SideQuest (2602.22603). LongCLI-Bench (2602.14337). Theme 9 (Memory/Context).

## memctl/memctl ⭐ HB100 — Self-Hostable MCP Persistent Memory Server
- **URL:** https://github.com/memctl/memctl
- **Discovered:** 2026-03-01 (r/LocalLLaMA 1rhn8eo)
- **Stack:** Node.js / npx, SQLite (FTS5 + vector), Docker, Apache 2.0
- **What it does:** MCP server giving coding agents (Claude Code, Cursor, any MCP client) persistent memory across sessions and IDEs. 11 MCP tools. Hybrid FTS5+vector search. Offline caching. Free tier + paid team tiers. Deployed via Docker, self-hostable.
- **Why interesting:** Session memory is the #1 practitioner pain point across every reddit sweep. memctl is a direct production-grade solution in the correct architecture (FTS5+vector hybrid per Context Mode HN thread). The "11 MCP tools" suggests comprehensive memory operations beyond simple read/write (likely: write, read, search, tag, relate, summarize, prune, etc.). Apache 2.0 + self-hosted = enterprise-safe for privacy-sensitive teams. Built in 2 weeks = solo project, not yet battle-tested. Watch for community adoption signal.
- **Connects to:** ParamMem (2602.23320 — parameter memory, complementary approach). StateLM (2602.22675 — trained memory tool use). Context Mode (HN 307pts — context compression; memctl solves the upstream problem of *which* memories to compress). ESAA (2602.23193 — event sourcing; memctl is the memory store that ESAA's replay mechanism would use). Theme 8 (Agent Engineering).

## SolariSystems/solari ⭐ HB100 — Autonomous OSS PR Agent (Apache/NASA PRs Merged)
- **URL:** https://github.com/SolariSystems/solari
- **Discovered:** 2026-03-01 (r/LocalLLaMA 1rhkwzn)
- **Stack:** Python, FAISS persistent memory, model-agnostic
- **What it does:** 24/7 autonomous agent that analyzes codebases and submits PRs. Has had PRs merged into Apache and NASA repositories on merit (author declines to link to avoid creating noise for maintainers). Architecture: fast recon pass → deeper solve pass → verification (rejects output when checks fail). Started on local 7B, now model-agnostic. Persistent FAISS memory, multi-pass pipeline, cross-domain synthesis. Also analyzing full Linear A corpus (undeciphered ancient script).
- **Why interesting:** Rare confirmed example of an autonomous coding agent with verified real-world PR merges into major open-source projects (Apache, NASA) without human steering. The multi-pass pipeline (recon → solve → verify) mirrors Hybrid-Gym's skill decomposition and SWE-agent's workflow. The FAISS persistent memory is the production version of what memctl formalizes. The "cross-domain synthesis" claim (software engineering + archaeology) is unusual — suggests generalist autonomous research capability. Low-community-signal post (1pt) but substantive content.
- **Connects to:** Hybrid-Gym (2602.16819 — training for real PR solving). SWE-bench (the benchmark that systems like Solari are converging toward). AgentHub (2510.03495 — lifecycle and provenance for agents like this). Theme 9 (Real-world Deployment). The "Apache/NASA merges" claim should be treated as anecdotal until verified — no links provided by design.

## wshobson/agents — Claude Code Plugin Marketplace (29.8k stars)
- **URL:** https://github.com/wshobson/agents
- **Stars:** 29,849 (created Jul 2025, trending Mar 2 2026)
- **What it does:** A comprehensive production-ready system for Claude Code consisting of 72 focused plugins, 112 specialized AI agents, 146 agent skills, and 79 development tools — all organized for minimal token usage via a plugin marketplace architecture. Install command: `/plugin marketplace add wshobson/agents`. Plugins load only what they need (~1000 tokens per plugin). Covers: frontend/backend/full-stack development, infrastructure (K8s, cloud, Docker), security hardening, ML pipelines, data engineering, incident response, SEO, business operations. Three-tier model strategy: Opus 4.6 (complex), Sonnet 4.6 (standard), Haiku 4.5 (simple). Follows Anthropic's 2-8 component-per-plugin pattern. Smithery-integrated: smithery.ai/skills?ns=wshobson.
- **Why interesting:** With 29.8k stars, this is one of the most-adopted Claude Code agent configurations. It demonstrates the plugin/marketplace pattern for distributing agent capabilities: users install only what they need, minimizing context bloat. The 146 skills follow the agentskills.io open standard, making them portable across compatible agents. The "progressive disclosure" design — skills load knowledge only when activated — solves the context budget problem at scale. This is the reference implementation of a skills-based agent marketplace.
- **Connects to:** agentskills.io standard (Theme 11 — skills as distribution format); K-Dense-AI/claude-scientific-skills (domain-specific skills extension); muratcankoylan/Agent-Skills-for-Context-Engineering (context engineering skills); anthropics/skills (official skills repo); Claude Code Remote Control (remote access to this plugin system). Theme 11 (Agent Skills Ecosystem).

## K-Dense-AI/claude-scientific-skills — 148+ Scientific Domain Skills
- **URL:** https://github.com/K-Dense-AI/claude-scientific-skills
- **Stars:** (trending Mar 2 2026 — daily trending)
- **What it does:** 148+ ready-to-use scientific and research skills following the agentskills.io open standard, targeting scientific/research workflows: bioinformatics & genomics, cheminformatics & drug discovery, proteomics & mass spectrometry, clinical research & precision medicine, healthcare AI, medical imaging & digital pathology, machine learning, materials science, physics & astronomy, engineering & simulation, laboratory automation, scientific communication, multi-omics. Also includes financial/SEC research, U.S. Treasury fiscal data, hedge fund data, market data. Commercial: K-Dense Web (k-dense.ai) is a hosted platform built on top of these skills — this repo is its open-source foundation.
- **Why interesting:** Domain expertise packaged as 148+ agentskills.io SKILL.md files, spanning the full scientific stack. This is the scientific research complement to what wshobson/agents does for software development — demonstrating that the skills-as-distribution-format pattern generalizes beyond coding into scientific research. Key insight: "explicitly defined skills provide curated documentation and examples that make [Claude] significantly stronger and more reliable" — quantifies why skills outperform raw capability for domain tasks.
- **Connects to:** wshobson/agents (software dev skills peer); agentskills.io standard (the underlying format); K-Dense Web (commercial hosting platform for the skills); Anthropic Autonomy study (autonomous research workflows). Theme 11 (Agent Skills Ecosystem) + Theme 2 (Scientific Agent Applications).

## iOfficeAI/AionUi — Open-Source 24/7 Local Cowork Platform (17.5k stars)
- **URL:** https://github.com/iOfficeAI/AionUi
- **Stars:** 17,521 (trending Mar 2 2026)
- **What it does:** Free, open-source, cross-platform Cowork app that runs AI agents locally 24/7 — reading files, writing code, browsing, automating tasks. Supports Claude Code, Codex, OpenCode, Gemini CLI, Qwen Code, Goose CLI, Augment, and more. Key features: built-in agents, zero setup, any API key, multi-agent coordination, remote access, cross-platform (macOS/Windows/Linux). Community: Discord + WeChat + Twitter.
- **Why interesting:** Directly fills the "Cowork Cloud" gap identified by Simon Willison (Feb 25) — scheduled tasks and 24/7 automation without requiring the official app to be open. Open-source alternative to Claude Cowork that is multi-agent and model-agnostic (not locked to Anthropic). With 17.5k stars and active multilingual community (8 language READMEs), this has significant international adoption. The "you see everything the agent does" transparency principle mirrors the Anthropic Autonomy study's finding that oversight visibility is key to user trust.
- **Connects to:** Claude Code Remote Control + Cowork Scheduled Tasks (Feb 25 — this fills the gap); Anthropic Autonomy study (Feb 18 — oversight visibility); ruflo (ruvnet — another Claude-focused orchestration platform competing in same space); superset-sh (parallel multi-agent coding IDE — adjacent). Theme 7 (Agent Infrastructure).

### ovitrac/memctl ★0 (v0.1.0 released Feb 28 2026) — Unix-native LLM Memory Control Plane
- **URL:** https://github.com/ovitrac/memctl
- **What it does:** CLI-first persistent memory for LLM orchestration. Single SQLite file (FTS5+WAL), zero dependencies (stdlib only), Unix-composable (push writes stdout, pull reads stdin, pipe freely). Commands: `push QUERY --source` (ingest files + recall), `pull` (stdin → memory), `search`, `ask` (mount+sync+recall+LLM in one shot), `chat --session`. Also ships an MCP server (`pip install memctl[mcp]`). Extras: `[docs]` for Office/ODF/PDF ingestion, `[all]` for everything.
- **Key design:** 35 detection patterns block secrets, injection, instructional content, PII *before storage* — policy-governed ingestion. SHA-256 content-addressed dedup for idempotent ingestion. Schema is forward-compatible with RAGIX (same author). `consolidate` command merges similar STM items deterministically. `eco` mode for token-efficient operation.
- **Why it matters:** Solves "LLMs forget everything between turns" at the CLI layer. The Unix pipe design (`memctl push "topic" | llm "analyze" | memctl pull`) makes it composable with any LLM CLI (claude, ollama, etc.). The 35-pattern policy gate at ingestion time is the practical defense against prompt injection via memory persistence — directly addresses Zombie Agents (2602.15654) threat model. Created Feb 18 2026, 0 stars currently — pre-discovery, but well-architected.
- **Note:** DIFFERENT project from `memctl/memctl` (HB100, MCP memory server). Same name, different author, different architecture.
- **Connects to:** memctl/memctl (HB100 — same name different project, MCP server approach vs CLI approach); Zombie Agents (2602.15654 — persistent memory poisoning; ovitrac/memctl's 35-pattern PII/injection gate directly addresses this); ESAA (2602.23193 — event sourcing memory; memctl's `pull` + `consolidate` is the practical implementation); Context Mode (HN — context compression; memctl is the memory layer that feeds into context management). Theme 8 (Agent Engineering) + Theme 9 (Memory).

### comet-ml/opik ★17,988 (created 2023-05-10) — LLM/Agent Observability Platform
- **URL:** https://github.com/comet-ml/opik
- **What it does:** Full observability stack for LLM applications, RAG systems, and agentic workflows: comprehensive tracing (every LLM call, tool invocation, memory read/write), automated evaluations (hallucination detection, relevance scoring, custom metrics), production dashboards. Self-hostable OSS + cloud. Python SDK, integrations with LangChain, LlamaIndex, etc.
- **Why it matters:** 18k★ makes this the most-starred agent observability tool in our repos. Implements exactly what AI Runtime Infrastructure (2603.00495) calls the "observation" function of the runtime layer and what TraceSIR (2603.00623) implements via SIR-structured trace analysis. Production-grade: designed for continuous monitoring, not just dev debugging. The "automated evaluations" component is the production implementation of the evals research cluster (ISO-Bench, SWE-Hub, etc.).
- **Connects to:** AI Runtime Infrastructure (2603.00495 — runtime observability layer; opik implements it); TraceSIR (2603.00623 — structured trace analysis; opik provides the trace data TraceSIR would analyze); NFR Pattern Language (2603.00472 — observability as NFR; opik is the production implementation); Plano (repos.md — guardrails/routing; opik is the complementary observability layer). Theme 7 (Agent Infrastructure).

### agentscope-ai/ReMe ★1,201 (+27/day)
- **URL:** https://github.com/agentscope-ai/ReMe
- **Why it matters:** File-based memory management kit for AI agents from agentscope-ai. Solves the two core agent memory problems: (1) context window truncation — old conversations automatically condensed, (2) stateless sessions — new conversations inherit history. Key design philosophy: "Memory as files, files as memory" — uses human-readable Markdown files (MEMORY.md for long-term + daily YYYY-MM-DD.md logs for short-term), making memory portable, editable, and inspectable without a database. Has both file-based and vector-based backends. pip install reme-ai.
- **Activity:** 1,201★, 114 forks, trending Mar 4 2026. Has versioned docs (0.2.x legacy).
- **Connects to:** ovitrac/memctl (file-based memory CLI — similar philosophy); MemPO (2603.00680 — RL-trained proactive memory management; ReMe is the engineering substrate MemPO would run on); Semantic XPath (2603.01160 — tree-structured memory; ReMe's file hierarchy is a simpler version); AMemGym (2603.01966 — interactive memory benchmark; ReMe implements the long-horizon memory pattern AMemGym benchmarks). Theme 3 (Agent Memory Systems).

### LMCache/LMCache ★7,326 (+140/day)
- **URL:** https://github.com/LMCache/LMCache
- **Why it matters:** KV cache layer for LLM serving — stores reusable KV caches across GPU, CPU, disk, and S3, enabling 3-10x TTFT reduction and throughput gains in multi-round QA and RAG. Unlike prefix caching, LMCache reuses cached KV blocks for any reused text (not just prefix matches) across any serving instance. Integrates with vLLM v1 and SGLang. Features: disaggregated prefill, P2P KV cache sharing, zero-copy CPU offloading, NIXL/GDS acceleration. Has technical report and Ray Summit talk. Used/integrated by growing ecosystem of LLM serving platforms.
- **Activity:** 7,326★, 140 stars today (strong trending). Has blog, docs, Slack community.
- **Connects to:** DeepSeek Inference Architecture (HB254 — disaggregated prefill is also in DeepSeek's production stack; LMCache implements this at the open-source level); AI Runtime Infrastructure (2603.00495 — runtime layer; KV caching is a key runtime optimization for agent multi-turn conversations); "Agents Learn Their Runtime" (2603.01209 — interpreter persistence; persistent KV cache is one mechanism for runtime continuity). Theme 7 (Agent Infrastructure).

### datawhalechina/hello-agents ★24,830 (+3,137/week)
- **URL:** https://github.com/datawhalechina/hello-agents
- **Why it matters:** "Building Intelligent Agents from Zero" — the highest-starred Chinese-language agent tutorial repo on GitHub trending this week. 24,830★ with 2,777 forks puts it in the same tier as deer-flow (23,965★) by star count. datawhalechina is a well-known Chinese ML education community (also behind "Hands-On Large Language Models" tutorials). The Chinese-language agent education ecosystem is clearly maturing rapidly — this is the community entry point for Chinese engineers building agents.
- **Activity:** 24,830★, 2,777 forks, 3,137 stars this week (strong sustained momentum). Active contributor base (5 visible contributors).
- **Connects to:** deer-flow (bytedance/deer-flow — Chinese lab production SuperAgent; this is the educational on-ramp that feeds into deer-flow adoption); zhayujie/chatgpt-on-wechat (41,808★ — Chinese agent ecosystem; CowAgent variant); AgentSkillOS (2603.02176 — Claude skill management; Chinese community is building toward this pattern). Theme 2 (Agent Education / Ecosystem Adoption) — Chinese community signal.

### VibeHQ — Multi-Agent Collaboration via Real CLI Instances + MCP
- **Source:** r/LocalLLaMA (nc=8, Mar 1-2 2026). Video: https://v.redd.it/c9h7rglljamg1
- **Status:** No public GitHub yet (video demo only)
- **Why it matters:** Spawns Claude Code / Codex CLI / Gemini CLI as real isolated terminal processes. 20 MCP tools for inter-agent communication via central WebSocket hub. Contract-driven development gate (sign-off required before coding starts). Idle-aware queue via JSONL transcript monitoring. State persistence across crashes.
- **Watch for:** GitHub repo launch. Contract-driven MCP spec formalization.

## karpathy/autoresearch — Autonomous AI Research Loop (16,052★)
- **URL:** https://github.com/karpathy/autoresearch
- **Stars:** 16,052 (created 2026-03-06, ~4 days old, 2,045 forks)
- **What it does:** Minimal framework for autonomous AI research: agent modifies a single train.py, runs 5-minute fixed-budget experiments, keeps improvements / discards failures via git, logs to results.tsv, loops forever. Based on nanochat. Uses program.md as the agent's "skill" file — human writes the methodology, agent writes the code.
- **Why it matters:** Karpathy's "program the programmer" paradigm: you edit program.md (research org design), not train.py (code). This is the highest-profile implementation of recursive self-improvement via agent loops. 16k★ in 4 days = massive community signal. The fixed-budget + git-tracked + structured-log experiment loop is the minimal viable template for automated improvement. Missing: safety rails, drift detection, constraint preservation — exactly what SAHOO (2603.06333) provides.
- **Connects to:** SAHOO (2603.06333 — safety framework for exactly this kind of loop); Reflective Test-Time Planning (2602.21198 — reflection-in/on-action maps to keep/discard + experiment design); Art of Efficient Reasoning (2602.20945 — efficient exploration of solution space); our system's agent heartbeat/mission loop. Theme 1 (Self-Improvement) + Theme 8 (Agent Engineering).

## HKUDS/CLI-Anything — Making ALL Software Agent-Native (1,086★)
- **URL:** https://github.com/HKUDS/CLI-Anything
- **Stars:** 1,086 (created 2026-03-08, 107 forks)
- **What it does:** Claude Code plugin that auto-generates complete CLIs for any software (GIMP, Blender, LibreOffice, etc.) in 7 phases: Analyze → Design → Implement → Plan Tests → Write Tests → Document → Publish. Output is a Click-based Python CLI with REPL, JSON output, undo/redo, and comprehensive test suite. Distributed as Claude Code plugin marketplace package.
- **Why it matters:** "Today's Software Serves Humans. Tomorrow's Users will be Agents." — addresses the fundamental interface gap: most software has GUIs but no agent-friendly API. 7-phase pipeline is fully autonomous. 1,436 passing tests across 9 demo apps (GIMP, Blender, LibreOffice Calc, VLC, Inkscape, Audacity, Calibre, Zotero, OBS Studio). The "agent-native software" vision: every application becomes agent-controllable through structured CLI without rebuilding.
- **Connects to:** agentskills.io (CLI generation = skill generation); cc-connect (agent communication); GWS CLI (Google Workspace agent access — CLI-Anything is the generic version). Theme 7 (Agent Infrastructure) + Theme 11 (Agent Skills Ecosystem).

## uluckyXH/OpenMOSS — Self-Organizing Multi-Agent System for OpenClaw (217★)
- **URL:** https://github.com/uluckyXH/OpenMOSS
- **Stars:** 217 (created 2026-03-08, 20 forks)
- **What it does:** Multi-agent orchestration middleware with 4 specialized roles: Planner (breaks down requirements), Executor (claims tasks, writes code), Reviewer (quality scoring, approve/reject), Patrol (monitors anomalies, flags blocked tasks). Agents wake via cron, communicate asynchronously through FastAPI, never talk directly. Built on OpenClaw. Has WebUI with task management, activity feed, score leaderboard.
- **Why it matters:** Live demo: 1m-reviews.com — news site entirely operated by OpenMOSS agents (20+ articles in 2 days, zero human intervention). The 4-role pattern (Plan/Execute/Review/Patrol) maps closely to our architecture (May/Coder/QA/Bob). The Patrol agent (anomaly detection, stuck task recovery) is a production implementation of our heartbeat monitoring concept. Scoring & leaderboard system for agent quality is a novel accountability mechanism.
- **Key insight:** "Agent death rate drops to 0%" via the Patrol agent — autonomous recovery from agent failures is the production concern, not agent capability.
- **Connects to:** Bug-Hunt (adversarial verification — OpenMOSS's Reviewer fills the Skeptic role); SAHOO (drift monitoring — Patrol agent IS L6 monitoring); our system's agent architecture (4-role mapping). Theme 6 (Multi-Agent Coordination).

## numbergroup/AgentGuard — AI Agent Security Framework (94★)
- **URL:** https://github.com/numbergroup/AgentGuard
- **Stars:** 94 (trending Mar 2026)
- **What it does:** Security framework protecting AI agents: command injection detection, prompt injection blocking, Unicode bypass prevention (homoglyph attacks), social engineering detection, encoding/obfuscation detection, GitHub issue screening (Clinejection-style), rate limiting, surgical sanitization. Available as OpenClaw Skill, Claude MCP Server, or standalone CLI.
- **Performance:** 0.02ms avg analysis, 50k+ analyses/sec, 98.7% detection rate, <2% false positives, <10MB memory.
- **Why it matters:** Built in response to the Clinejection attack (4,000 developer machines compromised via malicious GitHub issue). The first security framework specifically designed for AI agent protection (not web app security adapted for agents). The "surgical sanitization" approach (replace only detected threats, preserve legitimate content) is the right design — full blocking would break agent workflows.
- **Connects to:** ClawHavoc (arXiv:2602.20867 — ~1,200 malicious skills; AgentGuard addresses the attack vector); Agent Skills security gap (our prior research identified lack of trust/verification in skill ecosystem); Zombie Agents (2602.15654 — persistent memory poisoning; AgentGuard's prompt injection blocking is a complementary defense). Theme 10 (Agent Security).

## Agentlytics — Analytics Dashboard for AI Coding Agents (211★)
- **URL:** https://github.com/f/agentlytics
- **Stars:** 211 (created 2026-03-07)
- **What it does:** Comprehensive analytics dashboard for AI coding agents — Cursor, Windsurf, Claude Code, VS Code Copilot, Zed, Antigravity, OpenCode, Command Code. Local-first, SQLite-based. JavaScript/React. Tracks agent usage, token spend, session metrics across all major coding assistants.
- **Why it matters:** As coding agents proliferate, meta-observability (which agent did what, how much did it cost) becomes essential. First unified dashboard across all major tools. Local-first = no data leakage. Complements opik (LLM-level observability) at the developer-workflow level.
- **Connects to:** opik (LLM observability — agentlytics is the developer-facing layer above); our system's journal/log patterns. Theme 7 (Agent Infrastructure).

## aiming-lab/MetaClaw — Agent That Learns and Evolves (45★)
- **URL:** https://github.com/aiming-lab/MetaClaw
- **Stars:** 45 (created 2026-03-09)
- **What it does:** Wraps model behind OpenAI-compatible API, intercepts OpenClaw conversations, scores each turn, continuously improves policy through online fine-tuning. Hot-swaps updated LoRA weights with no restart. Uses Kimi-2.5 (~200B MoE) via Tinker for cloud-based LoRA training, Qwen3-4B as lightweight alternative. Supports GRPO + On-Policy Distillation. **Automatic skill evolution:** when agent fails, LLM analyzes trajectory and generates new skills.
- **Why it matters:** First production implementation of continuous online learning from live agent conversations. The skill evolution feature (failure → analyze → generate new skill) is the practical realization of SAHOO-style self-improvement loops. No GPU cluster needed (cloud LoRA training). From aiming-lab (also behind SkillRL).
- **Connects to:** SAHOO (2603.06333 — MetaClaw is the engineering implementation of recursive self-improvement); autoresearch (same loop pattern — experiment, evaluate, improve); SkillRL (same lab, RL for skill learning). Theme 1 (Self-Improvement) + Theme 11 (Agent Skills).

## get-Lucid/Lucid — Real-Time Knowledge Grounding for Agents (101★)
- **URL:** https://github.com/get-Lucid/Lucid
- **Stars:** 101 (created 2026-03-09, MIT)
- **What it does:** MCP server exposing 4 tools: doc search, package version check, fact verification, API reference fetch. 5 skills auto-trigger tools based on conversation context. Installs as Claude Code plugin or OpenClaw skill. $20/mo.
- **Why it matters:** Addresses the "stale training data" problem for coding agents. Key principle: "If docs say one thing and training data says another, docs win." Skills-driven auto-triggering means agents don't need explicit invocation. Validates the agent skill + MCP tool combo pattern.
- **Connects to:** skilless.ai (similar agent-capability-extension via skills); agentskills.io format. Theme 11 (Agent Skills).

## wireless-tag-com/EmbedClaw — Full Agent Runtime on ESP32-S3 (23★)
- **URL:** https://github.com/wireless-tag-com/EmbedClaw
- **Stars:** 23 (created 2026-03-09, MIT, C)
- **What it does:** Decouples LLM, Tools, Agent, Channels, Memory, Skills — all running on a single ESP32-S3 microcontroller. Uses Qwen via DashScope API. Features: Feishu + WebSocket channels, ReAct tool loop, long-term memory (MEMORY.md), short-term memory (session JSONL), daily notes, SPIFFS-based skills, cron scheduling. Complete agent loop on embedded hardware.
- **Why it matters:** Proof that the agent architecture pattern (channels → agent loop → LLM → tools → memory → skills) is so well-understood it can be implemented on a microcontroller. The decoupled architecture is a clean reference implementation. Uses same file-based memory patterns (MEMORY.md, daily notes) as ReMe and our system.
- **Connects to:** ReMe (file-based memory); cc-connect (channel abstraction); agentskills.io (skill format on embedded). Theme 7 (Agent Infrastructure) — extreme edge.

## holysheep123/holysheep-cli — Universal AI Tool Configurator for China (231★)
- **URL:** https://github.com/holysheep123/holysheep-cli
- **Stars:** 231 (created 2026-03-07, MIT)
- **What it does:** One command configures all AI coding assistants (Claude Code, Codex CLI, Aider, Continue.dev, OpenCode, OpenClaw) to use HolySheep API relay. Solves API access for developers in China.
- **Why it matters:** Chinese market signal: 231★ in 3 days shows strong demand for unified AI tool configuration. Confirms the multi-tool agent landscape is fragmenting enough to need meta-configuration tools. The relay architecture (proxying through holysheep.ai) is identical to cc-connect's provider proxy pattern.
- **Connects to:** cc-connect (provider proxy pattern); hello-agents (Chinese agent ecosystem). Theme 2 (Ecosystem Adoption).

## OpenMOSS — Self-Organizing Multi-Agent Collaboration Platform (232★)
- **URL:** https://github.com/uluckyXH/OpenMOSS
- **Stars:** 232 (created 2026-03-08, MIT, Python/FastAPI/Vue)
- **What it does:** Self-organizing multi-agent collaboration platform for OpenClaw. 4 agent roles: Planner (breaks down requirements, assigns tasks), Executor (claims tasks, writes code), Reviewer (reviews quality, scores 1-5, approves/rejects for rework), Patrol (monitors system, detects stuck tasks, triggers recovery). Cron-based autonomous wake-ups. SQLite backend, REST/WebSocket API. Built-in scoring/leaderboard system with reward/penalty logs driving agent rankings. Demonstrated with a live news site (1M Reviews) — 20+ articles in 2 days, fully autonomous.
- **Architecture parallel to ours:** Planner≈May, Executor≈Coder, Reviewer≈QA+Evaluator, Patrol≈monitoring concern. Key difference: asynchronous task queue model (agents claim tasks from queue) vs. our synchronous pipeline. Their scoring system (1-5 per review, cumulative leaderboard, reward/penalty per task) is a concrete implementation of Bug-Hunt's scoring incentive pattern.
- **Why it matters:** Validates our multi-agent architecture pattern at scale. The closed-loop quality control (review → score → rework cycle) is exactly what our QA/Evaluator loop does. The Patrol agent (anomaly detection, stuck task recovery) addresses a gap we haven't formalized. The scoring/leaderboard system provides concrete inspiration for our evaluator's output format.
- **Connects to:** Bug-Hunt (scoring incentives for agents), our own May/Coder/QA/Evaluator pipeline, cc-connect (agent communication layer). Theme 7 (Agent Infrastructure).

## MASFactory — Graph-centric Framework for Multi-Agent Orchestration (arXiv:2603.06007)
- **URL:** https://github.com/BUPT-GAMMA/MASFactory
- **What it does:** Compiles natural-language intent into editable workflow specifications, then into executable directed computation graphs for MAS. "Vibe Graphing" = human-in-the-loop approach. Reusable components, pluggable context integration, topology preview, runtime tracing.
- **Why it matters:** The "intent → graph → execution" pipeline is a cleaner formalization of what our system does implicitly (user request → May delegation → agent execution graph). The topology preview/tracing features complement MAScope's behavioral flow reconstruction.
- **Connects to:** MAScope (runtime tracing for security), Spark-to-Fire (graph topology analysis), our workflow system. Theme 7 (Agent Infrastructure).

## 2026-03-24 — Repo Tracking Update

### Tracked Repos — Star Growth

| Repo | Previous | Current | Change | Trend |
|------|----------|---------|--------|-------|
| chenhg5/cc-connect | 770⭐ (Mar 22) | 784⭐ | +1.8% | Steady plateau, growth stabilizing |
| aiming-lab/MetaClaw | 169⭐ (Mar 22) | 182⭐ / 20 forks | +7.7% | Strong organic growth continues |
| uluckyXH/OpenMOSS | 232⭐ (first tracked) | 283⭐ / 26 forks | +22% since first track | Fast growth, validating multi-agent platform pattern |

**Notes:**
- cc-connect now at 73 forks (was 45). Community contribution accelerating even as star growth plateaus — sign of real adoption.
- MetaClaw's 12 commits + `memory_data/` directory confirms it's tracking conversation data for live learning.
- OpenMOSS steady at 13 commits — architecture stable, adoption growing.

## 2026-03-25 — Agent Memory Persistence Repos (Heartbeat Session)

### Major Memory Frameworks Discovered
| Repo | Stars | Language | License | Description |
|------|-------|----------|---------|-------------|
| memvid/memvid | 13,364⭐ / 1,117 forks | Rust | — | Serverless single-file memory layer for AI agents. Replaces RAG pipelines. |
| MemoriLabs/Memori | 12,334⭐ / 1,111 forks | Python | Proprietary | SQL-native memory layer for LLMs, AI agents & multi-agent systems. |
| MemTensor/MemOS | 6,492⭐ / 585 forks | Python | Apache-2.0 | AI Memory OS with persistent skill memory, cross-task reuse. |
| volcengine/OpenViking | 5,623⭐ | Python | — | ByteDance's context database for AI agents. Unifies vector/graph/structured. |
| MemMachine/MemMachine | 4,774⭐ | Python | — | Universal memory layer, scalable/extensible/interoperable. |
| campfirein/cipher | 3,564⭐ | TypeScript | — | Memory layer for coding agents (Cursor, Codex, Claude Code). |
| aiming-lab/SimpleMem | 3,142⭐ / 308 forks | Python | MIT | Efficient lifelong memory with MCP integration. |
| agiresearch/A-mem | 877⭐ / 93 forks | Python | MIT | A-MEM: Agentic Memory for LLM Agents (NeurIPS 2025). |

**Assessment:** Memory infrastructure is a hot space. memvid and Memori are the volume leaders. MemOS (Apache-2.0) is the most architecturally interesting — it treats memory as a full OS with scheduling and lifecycle. SimpleMem is the most practical for quick integration (MIT, MCP support). cipher specifically targets coding agent workflows.

## 2026-03-26 — Repo Tracking Update (Heartbeat Session)

### Tracked Repos — Star Growth

| Repo | Previous | Current | Change | Trend |
|------|----------|---------|--------|-------|
| chenhg5/cc-connect | 784⭐ / 73 forks (Mar 25) | 888⭐ / 89 forks | +13.3% / +21.9% forks | **Acceleration!** Growth re-igniting after plateau. Forks growing faster than stars = deeper adoption. |
| aiming-lab/MetaClaw | 182⭐ / 20 forks (Mar 25) | 346⭐ / 34 forks | **+90.1%** / +70% forks | **Explosive growth.** Nearly doubled in ~1 day. This is the repo to watch. Self-improving agent via live conversation learning. |
| uluckyXH/OpenMOSS | 283⭐ / 26 forks (Mar 25) | 444⭐ / 47 forks | **+56.9%** / +80.8% forks | **Accelerating fast.** Multi-agent platform (Planner/Executor/Reviewer/Patrol) hitting mainstream adoption curve. |

**Pattern:** All three repos showing simultaneous acceleration — suggests a broader wave of multi-agent tool adoption, not just individual project momentum. MetaClaw's doubling is the most significant: self-improving agents are crossing from research curiosity to adopted tool.

### New Repos Discovered

| Repo | Stars | Language | License | Description |
|------|-------|----------|---------|-------------|
| NickSiboZhu/HyMEM-GUI-Agent | new | Python | — | HyMEM: Hybrid self-evolving structured memory for GUI agents (arXiv:2603.10291). Graph-based memory coupling symbolic + continuous. |
| hipvlady/prizm | 0⭐ | Python | — | CCS simulation: cache coherence → authorization revocation (arXiv:2603.09875). Tick-based discrete event simulator. Brand new, not yet discovered by community. |
| openai/ih-challenge | — | Dataset | Apache-2.0 | IH-Challenge: RL training dataset for instruction hierarchy (arXiv:2603.10521). HuggingFace: openai/ih-challenge. 10K-100K examples. First open IH training data from a frontier lab. |
