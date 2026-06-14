# GitHub Trending AI Agent Repos & Tools — June 2026

**Source:** GitHub Search API (live queries, June 13 & June 15 2026)  
**Last updated:** 2026-06-15  
**Prior version:** June 13 scan (this file, updated with June 15 delta)

---

## Executive Summary

The AI agent ecosystem on GitHub has undergone a **structural shift** since early 2026. Three macro-trends dominate: (1) the explosion of a **Skills Economy** — installable capability packages for coding agents, (2) the emergence of **agent memory infrastructure** as a standalone product category with 10+ competing projects, and (3) the maturation of **harness engineering** as the dominant architectural pattern, displacing both monolithic agents and raw prompt engineering.

**Key numbers from live API data:**
- 1,410+ repos matching "ai agent" with >500 stars, active in the last 2 weeks
- 413,000+ repos matching "ai agent" created since Jan 2025
- Top repo: **obra/superpowers** (227k★) — a skills framework, not an agent itself
- Fastest-growing category: **Agent memory** (10+ repos above 5k★, all created 2025+)

---

## Tier 1: Mega-Projects (100k+ ★)

| Stars | Repo | Category | Language | Created |
|-------|------|----------|----------|---------|
| 227k | **obra/superpowers** | Skills framework | Shell | Oct 2025 |
| 215k | **affaan-m/ECC** | Agent harness (skills, memory, security) | JavaScript | Jan 2026 |
| 193k | **NousResearch/hermes-agent** | Adaptive autonomous agent | Python | Jul 2025 |
| 191k | **n8n-io/n8n** | Workflow automation + AI | TypeScript | — |
| 150k | **anthropics/skills** | Official Anthropic skills repo | Python | Sep 2025 |
| 149k | **langflow-ai/langflow** | Visual agent builder | Python | Feb 2023 |
| 145k | **langgenius/dify** | Agentic workflow platform | TypeScript | Apr 2023 |
| 140k | **x1xhlol/system-prompts-and-models-of-ai-tools** | System prompts from 30+ tools | N/A | Mar 2025 |
| 139k | **langchain-ai/langchain** | Agent engineering platform | Python | Oct 2022 |
| 131k | **anthropics/claude-code** | Terminal coding agent | TypeScript | — |
| 115k | **Shubhamsaboo/awesome-llm-apps** | 100+ agent & RAG apps | Python | Apr 2024 |
| 113k | **msitarzewski/agency-agents** | Multi-agent AI agency | Shell | Oct 2025 |
| 108k | **garrytan/gstack** | 23 opinionated agent tools | — | — |
| 105k | **google-gemini/gemini-cli** | Terminal AI agent | TypeScript | Apr 2025 |
| 100k | **farion1231/cc-switch** | Cross-platform agent desktop app | Rust | Aug 2025 |

**Key insight:** The top 3 repos are all **meta-layers** — skills, harnesses, adaptive wrappers — not core agent implementations. The agent itself is commoditizing; the value layer is above it.

---

## Tier 2: Major Frameworks & Tools (25k–100k ★)

### Multi-Agent Frameworks
| Stars | Repo | What It Does | Language |
|-------|------|-------------|----------|
| 98k | **browser-use/browser-use** | Browser automation for agents | Python |
| 87k | **karpathy/autoresearch** | Automated ML research agents | Python |
| 86k | **TauricResearch/TradingAgents** | Multi-agent financial trading | Python |
| 83k | **infiniflow/ragflow** | RAG engine | Python |
| 82k | **thedotmack/claude-mem** | Persistent context across sessions | JavaScript |
| 79k | **lobehub/lobehub** | 7×24 agent team operator | TypeScript |
| 77k | **OpenHands/OpenHands** | AI-driven development | Python |
| 71k | **bytedance/deer-flow** | Long-horizon SuperAgent harness | Python |
| 69k | **FoundationAgents/MetaGPT** | AI software company framework | Python |
| 66k | **shareAI-lab/learn-claude-code** | Build agent harness from scratch | Python |
| 62k | **earendil-works/pi** | Unified LLM API + agent loop + TUI | TypeScript |
| 62k | **code-yeongyu/oh-my-openagent** | Agent harness for complex codebases | TypeScript |
| 59k | **ruvnet/ruflo** | Multi-agent swarms with memory | TypeScript |
| 59k | **microsoft/autogen** | Agentic AI programming framework | Python |
| 58k | **mem0ai/mem0** | Universal memory layer | Python |
| 58k | **addyosmani/agent-skills** | Production-grade engineering skills | Shell |
| 58k | **shanraisshan/claude-code-best-practice** | Vibe coding → agentic engineering | HTML |
| 54k | **FlowiseAI/Flowise** | Visual agent builder | TypeScript |
| 53k | **crewAIInc/crewAI** | Role-playing AI agent orchestration | Python |
| 47k | **CherryHQ/cherry-studio** | AI productivity studio, 300+ assistants | TypeScript |
| 47k | **aaif-goose/goose** | Extensible AI agent (Rust) | Rust |
| 45k | **zhayujie/CowAgent** | Super AI assistant with memory | Python |
| 44k | **HKUDS/nanobot** | Lightweight open-source agent | Python |
| 43k | **Leonxlnx/taste-skill** | "Good taste" skill — stops generic slop | Shell |
| 41k | **mvanhorn/last30days-skill** | Research any topic across platforms | Python |
| 41k | **sickn33/antigravity-awesome-skills** | 1,500+ agentic skills library | Python |
| 39k | **danny-avila/LibreChat** | Enhanced ChatGPT clone with agents | TypeScript |
| 37k | **multica-ai/multica** | Managed agents platform | Go |
| 36k | **bytedance/UI-TARS-desktop** | Multimodal AI agent stack | TypeScript |
| 36k | **vercel-labs/agent-browser** | Browser automation CLI for agents | Rust |
| 36k | **wshobson/agents** | Multi-harness plugin marketplace | Python |
| 36k | **Yeachan-Heo/oh-my-claudecode** | Teams-first multi-agent orchestration | — |
| 35k | **kepano/obsidian-skills** | Agent skills for Obsidian | N/A |
| 35k | **khoj-ai/khoj** | AI second brain / deep research | — |
| 35k | **github/awesome-copilot** | Community Copilot skills & configs | Python |
| 34k | **langchain-ai/langgraph** | Graph-based resilient agents | Python |
| 33k | **coreyhaines31/marketingskills** | Marketing skills for agents | JavaScript |
| 32k | **zeroclaw-labs/zeroclaw** | Autonomous personal assistant | Rust |
| 29k | **simstudioai/sim** | Central intelligence layer | TypeScript |
| 29k | **ComposioHQ/composio** | 1000+ toolkits for agents | — |
| 28k | **K-Dense-AI/scientific-agent-skills** | Scientific skills for agents | Python |
| 28k | **iOfficeAI/AionUi** | 24/7 co-work app for agent CLIs | TypeScript |
| 28k | **assafelovic/gpt-researcher** | Autonomous deep research agent | — |
| 27k | **heygen-com/hyperframes** | Write HTML, render video for agents | TypeScript |
| 27k | **Panniantong/Agent-Reach** | Internet-wide reading for agents | Python |
| 27k | **openai/openai-agents-python** | Multi-agent workflow framework | Python |
| 27k | **googleworkspace/cli** | Google Workspace CLI | Rust |
| 27k | **Fosowl/agenticSeek** | Fully local Manus AI, no APIs | Python |
| 26k | **chopratejas/headroom** | Compress tool outputs 60-95% | Python |
| 26k | **volcengine/OpenViking** | Context database for agents | Python |
| 25k | **mastra-ai/mastra** | TypeScript AI framework (Gatsby team) | TypeScript |

---

## 🧠 New Category: Agent Memory Infrastructure

The most significant new product category since last scan. **10+ repos** above 5k stars, all created 2025+.

| Stars | Repo | Approach | Language | Created |
|-------|------|----------|----------|---------|
| 82k | **thedotmack/claude-mem** | Session persistence, capture everything | JavaScript | Aug 2025 |
| 58k | **mem0ai/mem0** | Universal memory layer | Python | Jun 2023 |
| 26k | **volcengine/OpenViking** | Context database (ByteDance) | Python | Jan 2026 |
| 25k | **gastownhall/beads** | Memory upgrade for coding agents | Go | Oct 2025 |
| 23k | **letta-ai/letta** | Stateful agents with self-improving memory | Python | Oct 2023 |
| 23k | **rohitg00/agentmemory** | Persistent memory, benchmark-based | TypeScript | Feb 2026 |
| 17k | **topoteretes/cognee** | Open-source AI memory platform | Python | Aug 2023 |
| 16k | **vectorize-io/hindsight** | Agent memory that learns | Python | Oct 2025 |
| 16k | **memvid/memvid** | Serverless single-file memory layer | Rust | May 2025 |
| 15k | **MemoriLabs/Memori** | Agent-native memory infrastructure | Python | Jul 2025 |
| 14k | **NevaMind-AI/memU** | Memory harness with intent capture | Python | Jul 2025 |
| 4k | **Gentleman-Programming/engram** | SQLite + FTS5 persistent memory | Go | Feb 2026 |

### Memory Architecture Spectrum

```
Centralized ←――――――――――――――――――――――→ Local-First
OpenViking    mem0    letta    beads    engram    memvid
(DB-backed)  (cloud)  (stateful) (agent)  (SQLite)  (file-based)
```

**Key gap (connects to KE-1920):** None of these implement forgetting/decay. All are append-only. The forgetting deficit identified in arXiv research remains unaddressed in the tooling ecosystem.

---

## 🛠️ New Category: Skills Economy

The fastest-growing segment. Skills are installable capability packages (typically markdown + config files) that enhance base coding agents.

| Stars | Repo | What It Does |
|-------|------|-------------|
| 227k | **obra/superpowers** | Foundational skills framework & methodology |
| 215k | **affaan-m/ECC** | Skills + instincts + memory + security harness |
| 150k | **anthropics/skills** | Official Anthropic public skills |
| 58k | **addyosmani/agent-skills** | Production-grade engineering skills |
| 43k | **Leonxlnx/taste-skill** | Aesthetic judgment skill |
| 41k | **mvanhorn/last30days-skill** | Research-across-platforms skill |
| 41k | **sickn33/antigravity-awesome-skills** | 1,500+ skill library |
| 35k | **kepano/obsidian-skills** | Obsidian-specific agent skills |
| 35k | **github/awesome-copilot** | Community Copilot skills |
| 33k | **coreyhaines31/marketingskills** | Marketing domain skills |
| 28k | **K-Dense-AI/scientific-agent-skills** | Scientific research skills |
| 6k | **google-labs-code/stitch-skills** | Skills for Stitch MCP server |

**XHS convergence (KE-1915):** The Skills Absorption Thesis predicted "Skill Engineering (技能工程)" as the next paradigm. GitHub data confirms: skills repos are the fastest-growing segment by star velocity. The ecosystem is standardizing on skills-as-code (markdown + config, hot-swappable).

---

## 🔌 MCP & Agent Connectivity

| Stars | Repo | What It Does |
|-------|------|-------------|
| 26k | **headroom** | Compress tool outputs before reaching LLM (60-95% reduction) |
| 23k | **activepieces** | 400 MCP servers for agents |
| 16k | **googleapis/mcp-toolbox** | MCP server for databases |
| 15k | **GLips/Figma-Context-MCP** | Figma layout info for agents |
| 14k | **casdoor** | Agent-first IAM + MCP gateway |
| 10k | **mcp-use** | Full-stack MCP framework |
| 10k | **hexstrike-ai** | 150+ cybersecurity tools via MCP |
| 6k | **DesktopCommanderMCP** | Terminal control + file editing |
| 6k | **XcodeBuildMCP** | iOS/macOS dev via MCP |
| 6k | **stitch-skills** | Skills library for Stitch MCP |
| 6k | **bb-browser** | Browser-as-API for agents |
| 5k | **mobile-mcp** | Mobile automation via MCP |
| 5k | **agent-infra/sandbox** | All-in-one sandbox (browser+shell+file+MCP+VSCode) |

**Emerging signal: Context compression.** Headroom (26k★) addresses a concrete production problem — tool outputs are too large for context windows. 60-95% compression with same answer quality. This is infrastructure-layer constraint (KE-1924) applied to the token budget.

---

## 🧪 Agent Testing & Evaluation

| Stars | Repo | What It Does |
|-------|------|-------------|
| 22k | **promptfoo/promptfoo** | Red teaming / pentesting for AI |
| 16k | **RagaAI-Catalyst** | Agent observability & evaluation |
| 5k | **Giskard-AI/giskard-oss** | Open-source LLM agent testing |
| 3k | **langwatch/langwatch** | LLM evaluations + agent testing platform |
| 1k | **qualifire-dev/rogue** | Agent evaluator & red team platform |
| 620 | **comet-ml/opik-openclaw** | Export agent traces to Opik |
| 430 | **eval-sys/mcpmark** | MCP benchmark for stress-testing |

**Notable gap:** No tool focuses on **agent self-repair rate** measurement (the 27% finding from HN). Testing tools focus on correctness and safety, not on distinguishing net-new work from self-repair loops.

---

## 📐 Agent Architecture & Principles

| Stars | Repo | What It Does |
|-------|------|-------------|
| 23k | **humanlayer/12-factor-agents** | Production principles for LLM software |
| 11k | **microsoft/agent-framework** | Agent framework for Python & .NET |
| 5k | **sentient-agi/ROMA** | Recursive Open Meta-Agent framework |
| 5k | **SolaceLabs/solace-agent-mesh** | Event-driven multi-agent framework |
| 4k | **lintsinghua/claude-code-book** | 420k-word book dissecting agent harness architecture |
| 3k | **openai/openai-agents-js** | JS multi-agent workflow framework |
| 3k | **SkyworkAI/DeepResearchAgent** | Hierarchical multi-agent research |
| 2k | **sdi2200262/agentic-project-management** | Spec-driven multi-agent project mgmt |

**12-Factor Agents (23k★)** is particularly notable — it codifies production principles for agents the way 12-factor.net codified cloud app principles. This aligns with Harness Engineering crystallizing as a discipline.

---

## Landscape Analysis: What's Changed Since Prior Scan

### Star Velocity Winners (fastest-growing since Jan 2026)
1. **Skills repos** — obra/superpowers grew from ~0 to 227k in 8 months
2. **Agent harnesses** — ECC, deer-flow, oh-my-openagent all >60k in <12 months
3. **Memory infrastructure** — 10+ repos above 5k, most created in 2025-2026
4. **Context compression** — headroom at 26k from Jan 2026 start

### Architecture Patterns (Updated)

| Pattern | Status | Key Repos |
|---------|--------|-----------|
| **Skills-as-Code** | 🔥 Dominant | superpowers, anthropics/skills, agent-skills |
| **Harness Engineering** | 🔥 Crystallizing | ECC, deer-flow, 12-factor-agents |
| **Agent Memory** | 🔥 Exploding | mem0, beads, letta, hindsight, OpenViking |
| **MCP Tool Connectivity** | ✅ Mature | 400+ MCP servers via activepieces alone |
| **Context Compression** | 🆕 Emerging | headroom (26k★) |
| **Agent-Native Databases** | 🆕 Emerging | OpenViking (ByteDance), TiDB repositioning |
| **Cross-Agent Switching** | 🆕 Emerging | cc-switch (100k★) |
| **DAG-based Decomposition** | ✅ Stable | LangGraph, open-multi-agent |
| **Local-First Agents** | ✅ Growing | agenticSeek, zeroclaw |

### Language Distribution (Updated)
| Language | Role | Trend |
|----------|------|-------|
| **Python** | Core frameworks, research agents | Stable leader |
| **TypeScript** | UIs, harnesses, MCP servers | Co-leader |
| **Rust** | High-perf agents, browser automation, memory | 🔥 Rising fast |
| **Go** | Memory (engram, beads), databases, gateways | Growing |
| **Shell/Markdown** | Skills packages | Skills economy is literally markdown |

---

## Cross-Reference with System KEs

| GitHub Trend | Related KE | Connection |
|--------------|-----------|------------|
| Skills economy explosion | KE-1915 (Skills Absorption) | Predicted "Skill Engineering" as next paradigm — GitHub confirms |
| Memory repos lack forgetting | KE-1920 (Forgetting Deficit) | All 10+ repos are append-only; the gap persists |
| Harness Engineering as discipline | KE-1924 (Constraint Placement) | Infrastructure > instructions, externally validated |
| Context compression tools | KE-1925 (Quality-Waste Paradox) | Waste reduction at the infrastructure layer |
| No self-repair rate tools | KE-1925 (Quality-Waste Paradox) | 27% self-repair finding has no measurement tooling |
| 12-Factor Agents principles | KE-1927 (Structural Turn) | Behavioral → structural governance, codified |
| Agent-native databases | KE-1929 (Compilation Gap) | Context databases = compiled knowledge for agents |

---

## 🆕 June 15 Delta: New Categories & Emerging Repos

### New Category: Context Engineering Tools

A new product category solidifying around "context engineering" — the discipline of managing what goes into an agent's context window. Distinct from prompt engineering (which is about instructions); context engineering is about the full context lifecycle.

| Stars | Repo | What It Does | Language | Created |
|-------|------|-------------|----------|---------|
| 17k | **mksglu/context-mode** | Context window optimization, 98% tool output reduction, 15 platforms | TypeScript | Feb 2026 |
| 16.5k | **muratcankoylan/Agent-Skills-for-Context-Engineering** | Skills collection for multi-agent context management | Python | Dec 2025 |
| 7.7k | **gsd-build/gsd-2** | Meta-prompting + context engineering for long autonomous sessions | TypeScript | Mar 2026 |
| 5.4k | **volcengine/MineContext** | Proactive context-aware AI partner (ByteDance) | Python | Jun 2025 |
| 3.2k | **Meirtz/Awesome-Context-Engineering** | Survey: hundreds of papers & frameworks | — | Jul 2025 |
| 2.6k | **Windy3f3f3f3f/how-claude-code-works** | Deep dive into Claude Code context engineering internals | — | Mar 2026 |
| 2.5k | **wquguru/harness-books** | Two books on harness engineering & context governance | Python | Apr 2026 |
| 1.7k | **humanlayer/advanced-context-engineering-for-coding-agents** | Advanced context engineering guide | — | Aug 2025 |

**Key signal:** Context Engineering is becoming the successor label to Prompt Engineering. The XHS prediction from KE-1915 (Skill Engineering as next paradigm) may be running in parallel — "Context Engineering" focuses on the input pipeline, "Skill Engineering" on the capability layer. Both are infrastructure-level, not behavior-level.

### New Category: Agent Persistence & Crash Recovery

File-based planning and crash-proof agent state — a new pattern addressing the "context loss" problem in long-running agents.

| Stars | Repo | What It Does | Language | Created |
|-------|------|-------------|----------|---------|
| 23k | **OthmanAdi/planning-with-files** | Crash-proof markdown plans, deterministic completion gates, multi-agent shared state | Python | Jan 2026 |
| 20k | **snarktank/ralph** | Autonomous agent loop that runs until all PRD items complete | TypeScript | Jan 2026 |
| 12k | **wanshuiyin/Auto-claude-code-research-in-sleep** | ARIS: autonomous ML research with cross-model review loops | Python | Mar 2026 |
| 7.7k | **gsd-build/gsd-2** | Spec-driven development enabling long autonomous sessions | TypeScript | Mar 2026 |

**Connection to KE-1928 (Exploration Monopoly):** planning-with-files directly addresses the amnestic exploration problem — interrupted sessions that discard all state. Its "SKILL.md standard" is an attempt to standardize how agents persist and share plan state. This is the missing exploration memory the planner needs.

### New Category: Agent Security & Supply Chain

Agent security is consolidating from scattered concerns into a product category.

| Stars | Repo | What It Does | Language | Created |
|-------|------|-------------|----------|---------|
| 15.6k | **mukul975/Anthropic-Cybersecurity-Skills** | 754 cybersecurity skills mapped to MITRE ATT&CK, NIST, D3FEND | Python | Feb 2026 |
| 2.6k | **snyk/agent-scan** | Security scanner for agents, MCP servers, and skills | Python | Apr 2025 |
| 3.3k | **agentgateway/agentgateway** | Agentic proxy for agents and MCP servers (Rust) | Rust | Mar 2025 |

**Connection to HN findings (KE-1927):** The AgentJacking attack class (fake bug reports in Sentry tricking agents) and the Fedora supply-chain attack both demonstrate agent-as-attack-surface. Agent-scan (Snyk) is the first major security vendor entering this space.

### New Category: Domain-Specific Agent Studios

Vertical agent systems for specific professional domains — beyond general coding.

| Stars | Repo | What It Does | Language | Created |
|-------|------|-------------|----------|---------|
| 86k | **karpathy/autoresearch** | Automated ML research on single GPU | Python | Mar 2026 |
| 86k | **TauricResearch/TradingAgents** | Multi-agent financial trading | Python | Dec 2024 |
| 22k | **esengine/DeepSeek-Reasonix** | DeepSeek-native coding agent for terminals (prefix-cache stable) | Go | Apr 2026 |
| 22k | **Donchitos/Claude-Code-Game-Studios** | 49 agents, 72 skills: full game dev studio hierarchy | Shell | Feb 2026 |
| 18.6k | **alchaincyf/huashu-design** | HTML-native design skill for high-fidelity prototypes | HTML | Apr 2026 |
| 17k | **op7418/guizang-ppt-skill** | AI skill for polished slide decks | HTML | Apr 2026 |

### New Category: Agent Observability Platforms

As predicted by XHS (KE-1915: "agent observability tooling as next commercial wave"), dedicated agent observability is now a funded category.

| Stars | Repo | What It Does | Language | Created |
|-------|------|-------------|----------|---------|
| 6.5k | **GoogleCloudPlatform/agent-starter-pack** | Production templates with built-in eval & observability | Python | Jan 2025 |
| 5.5k | **coze-dev/coze-loop** | Full-lifecycle agent optimization (ByteDance/Coze) | Go | Jun 2025 |
| 1.4k | **trpc-group/trpc-agent-go** | Go framework with A2A, AG-UI, memory, eval, observability | Go | May 2025 |
| 1.1k | **future-agi/future-agi** | End-to-end eval, tracing, guardrails, gateway | Python | Apr 2026 |

### Repo-Level Star Velocity Update (June 13 → June 15)

Approximate 48-hour changes for repos already in prior scan:

| Repo | Stars (Jun 13) | Stars (Jun 15) | Δ |
|------|---------------|----------------|---|
| **obra/superpowers** | 227k | 227k | ~stable |
| **affaan-m/ECC** | 215k | 215k | ~stable |
| **NousResearch/hermes-agent** | 193k | 193k | ~stable |
| **google-gemini/gemini-cli** | 105k | 105k | ~stable |
| **browser-use/browser-use** | 98k | 99k | +~1k |
| **karpathy/autoresearch** | 87k | 87k | ~stable |
| **mem0ai/mem0** | 58k | 58k | ~stable |
| **antigravity-awesome-skills** | 41k | 41k | ~stable |

**Note:** The mega-repos have plateaued from their explosive growth phases. The fastest growth is now in the mid-tier (5k-25k) — context engineering tools, domain skills, and observability.

### New Notable Repos Not in Prior Scan

| Stars | Repo | What It Does | Why Notable |
|-------|------|-------------|-------------|
| 30k | **nanocoai/nanoclaw** | Lightweight OpenClaw alternative in containers | Security-first: sandboxed execution, multi-messenger |
| 24k | **jackwener/OpenCLI** | Make any website into CLI for agents | Browser→CLI bridge, interesting for agent-web interface |
| 22k | **manaflow-ai/cmux** | Ghostty-based terminal with notifications for coding agents | Agent-native terminal UX layer |
| 22k | **esengine/DeepSeek-Reasonix** | DeepSeek coding agent optimized for prefix-cache stability | Non-Anthropic/OpenAI agent — diversification signal |
| 18k | **tanweai/pua** | "Your AI is on a PIP" — high-motivation skill (satirical) | Cultural artifact: 18k stars for a joke skill = skills economy saturation signal |
| 17.6k | **phuryn/pm-skills** | PM Skills Marketplace: 100+ skills for product management | Domain expansion beyond engineering |
| 17k | **agentscope-ai/QwenPaw** | Personal AI assistant (Qwen-native) | Chinese LLM ecosystem building agent layer |
| 10k | **MemTensor/MemOS** | Self-evolving memory OS: hybrid retrieval, cross-task skill reuse, 35% token savings | Memory + skills convergence |
| 7.4k | **EverMind-AI/EverOS** | Cross-agent portable memory layer | Addresses agent lock-in: one memory for all agents |

---

## Updated Landscape Analysis: What's Changed (June 13 → June 15)

### Five Structural Shifts Confirmed

1. **Context Engineering is crystallizing as a discipline** — 8+ repos, dedicated books, frameworks. This is the infrastructure-side complement to Skill Engineering (KE-1915). Together they represent the bifurcation of "prompt engineering" into two mature practices: managing inputs (context) and managing capabilities (skills).

2. **Agent persistence is solving the amnesia problem** — planning-with-files (23k★) and ARIS (12k★) directly address the exploration monopoly's amnestic waste (KE-1928). The SKILL.md standard is an early attempt at cross-agent state portability.

3. **Memory is converging with skills** — MemOS (10k★) and EverOS (7.4k★) blur the line between memory and skills. Memory entries that improve over time ARE skills that self-evolve. This validates the Skills Absorption trajectory (KE-1915) from another angle.

4. **Agent observability is a funded category now** — Google Cloud, ByteDance/Coze, and multiple startups have production observability tools. This was predicted by XHS trends analysis. The gap remains: no tool measures self-repair rate or waste conversion efficiency.

5. **The saturation signal** — tanweai/pua (18k★), a satirical "PIP your AI" skill, hitting 18k stars suggests the skills economy is entering its meme phase. When jokes about a category attract the same star counts as serious tools in adjacent categories, the category is saturating.

### Updated Architecture Patterns

| Pattern | Status (Jun 13) | Status (Jun 15) | Key Change |
|---------|-----------------|-----------------|------------|
| **Skills-as-Code** | 🔥 Dominant | 🔥 Dominant, entering saturation | 18k★ joke skill = meme phase |
| **Context Engineering** | (not tracked) | 🆕 Crystallizing | 8+ repos, dedicated books |
| **Agent Persistence** | (not tracked) | 🆕 Emerging | SKILL.md standard, crash-proof plans |
| **Agent Security** | (not tracked) | 🆕 Emerging category | Snyk entering, cybersecurity skills |
| **Harness Engineering** | 🔥 Crystallizing | 🔥 Mature | Books published, principles codified |
| **Agent Memory** | 🔥 Exploding | 🔥 Converging with skills | MemOS, EverOS blur boundaries |
| **Agent Observability** | (implicit in eval) | 🆕 Funded category | Google Cloud, Coze templates |
| **Domain Agent Studios** | (not tracked) | 🆕 Growing | Game dev, design, PM, finance |

### The Forgetting Gap Persists

Checked all 20+ memory repos again. **Zero** implement forgetting, decay, or memory lifecycle governance. All remain append-only. The arXiv convergence (KE-1920: 5 papers, all recommending forgetting) has zero adoption in the tooling ecosystem. This is the widest research-to-practice gap in the current agent landscape.

---

*Data sourced from GitHub Search API, June 13 & 15, 2026. Star counts are approximate and change daily. June 15 data was truncated by API rate limits after ~6 query batches.*
