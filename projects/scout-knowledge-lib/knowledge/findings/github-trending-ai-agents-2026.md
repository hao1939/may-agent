# GitHub Trending AI Agent Repos & Tools — June 2026

**Source:** GitHub Search API (live queries, June 13, June 15, June 20, June 21, July 18, & July 22 2026)  
**Last updated:** 2026-07-22  
**Prior versions:** June 13 initial scan → June 15 delta → June 20 delta → June 21 delta → July 18 delta → July 22 delta (this update)

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

*Data sourced from GitHub Search API, June 13, 15, & 20, 2026. Star counts are approximate and change daily. June 15 data was truncated by API rate limits after ~6 query batches.*

---

## 🆕 June 20 Delta: New Trends, Categories & Notable Repos

### Trend 1: Code Knowledge Graphs (New Category)

Pre-indexed code knowledge graphs that auto-sync on code changes — giving agents a semantic map of the codebase instead of raw file search.

| Stars | Repo | What It Does | Language | Created |
|-------|------|-------------|----------|---------|
| 49k | **colbymchenry/codegraph** | Pre-indexed code knowledge graph, auto-syncs, 100% local, supports 8+ coding agents | TypeScript | Jan 2026 |
| 5k | **MinishLab/semble** | Fast semantic code search — 98% fewer tokens than grep+read via embeddings | Python | Apr 2026 |

**Why it matters:** These repos address the core context-engineering problem from the *agent* side: instead of the agent calling `grep` + `read` and flooding its context window, it queries a pre-indexed knowledge graph or embedding search and gets only relevant code. codegraph at 49k★ is the fastest-growing tool repo from Q1 2026. Semble's MCP-native code search complements headroom's output compression (KE-1924): one reduces what goes IN to the agent, the other compresses what comes OUT of tools.

### Trend 2: Sandboxed Agent Orchestration (Crystallizing)

Orchestration tools now treat sandboxing as a first-class primitive, not an afterthought.

| Stars | Repo | What It Does | Language | Created |
|-------|------|-------------|----------|---------|
| 6k | **mattpocock/sandcastle** | Orchestrate sandboxed coding agents in TypeScript with `sandcastle.run()` | TypeScript | Mar 2026 |
| 6k | **TencentCloud/CubeSandbox** | Instant, concurrent, lightweight sandbox for agents | Rust | Apr 2026 |
| 5k | **agent-infra/sandbox** | All-in-one sandbox: browser + shell + file + MCP + VSCode | Python | Aug 2025 |

**Why it matters:** The "98% Problem" from harness engineering (the harness is the 2% that determines safety) is being addressed with purpose-built sandbox primitives. sandcastle (Matt Pocock, TypeScript community influence) makes sandboxed agent orchestration a one-liner. CubeSandbox (Tencent) optimizes for instant concurrent sandbox creation. Both validate KE-1924 (Constraint Placement): the sandbox IS the constraint, at the infrastructure level.

### Trend 3: Agent-Trainable Skills (SkillOpt — Microsoft Research)

| Stars | Repo | What It Does | Language | Created |
|-------|------|-------------|----------|---------|
| 6.4k | **microsoft/SkillOpt** | Text-space optimizer that trains reusable natural-language skills from agent trajectories | Python | May 2026 |
| 10k | **OpenPipe/ART** | Agent Reinforcement Trainer — GRPO for multi-step agents on real tasks | Python | Mar 2025 |

**Why it matters:** SkillOpt is the first major framework for **automated skill generation** — the system observes agent trajectories, identifies reusable patterns, and produces deployable `best_skill.md` artifacts. This closes the loop on the Skills Economy: skills are no longer hand-authored, they're *trained* from execution traces. ART complements this with reinforcement learning at the agent level (GRPO). Together they represent the "self-improving agent" trajectory that KE-1915 (Skills Absorption) predicted.

**Critical connection to our system:** SkillOpt's trajectory-driven skill generation is exactly the "promotion mechanism" identified as missing in KE-1966 (Governance Gresham's Law) — validated soft patterns get promoted into hard skills, bridging the governance gap.

### Trend 4: Agent-Native Data & Query Interfaces

| Stars | Repo | What It Does | Language | Created |
|-------|------|-------------|----------|---------|
| 5k | **withcoral/coral** | One SQL interface over APIs, files, and live sources — built for agents | Rust | Apr 2026 |
| 5.6k | **TencentCloud/TencentDB-Agent-Memory** | 4-tier progressive pipeline memory, fully local, zero API deps | TypeScript | Apr 2026 |
| 16k | **googleapis/mcp-toolbox** | MCP server for databases | Go | Jun 2024 |

**Why it matters:** Coral unifies heterogeneous data sources (APIs, files, live streams) behind a SQL interface purpose-built for agents. TencentDB-Agent-Memory implements a 4-tier progressive memory pipeline (the most structured memory architecture among open repos) with local-first design. Both represent the "agent-native database" category — data infrastructure redesigned around agent access patterns rather than human query patterns.

### Trend 5: Agent Self-Healing & Observability

| Stars | Repo | What It Does | Language | Created |
|-------|------|-------------|----------|---------|
| 811 | **superloglabs/superlog** | Open-source observability that uses AI agents to self-heal your software (created Jun 2, 2026 — 2 weeks old) | TypeScript | Jun 2026 |
| 25k | **jarrodwatts/claude-hud** | Real-time HUD: context usage, active tools, running agents, session state | JavaScript | Jan 2026 |
| 1.1k | **future-agi/future-agi** | End-to-end eval, tracing, guardrails, gateway | Python | Apr 2026 |

**Why it matters:** Superlog (2 weeks old, 800+ stars) represents a new pattern: AI agents monitoring and self-healing production software. This is agents-as-SREs — the inverse of the typical "observe the agent" pattern. claude-hud at 25k★ has become the standard real-time observability layer for Claude Code sessions.

### Trend 6: Programming Languages for Agents

| Stars | Repo | What It Does | Language | Created |
|-------|------|-------------|----------|---------|
| 5k | **vercel-labs/zerolang** | "The Programming Language for Agents" | C++ | May 2026 |

**Why it matters:** A purpose-built programming language for agents (from Vercel Labs, 1 month old, already 5k★) is a strong signal that the agent ecosystem is moving beyond "LLMs writing in human languages" toward languages designed for agent execution patterns — deterministic, verifiable, composable. This echoes the "control flow replacing prompt engineering" trend (May 2026 HN) taken to its logical conclusion: a language rather than a framework.

### Trend 7: Agent Desktop Companions & Fleet Management

| Stars | Repo | What It Does | Language | Created |
|-------|------|-------------|----------|---------|
| 12k | **fathah/hermes-desktop** | Desktop companion for Hermes Agent | TypeScript | Apr 2026 |
| 7.9k | **EKKOLearnAI/hermes-studio** | Web dashboard: multi-platform chat, session management, scheduled jobs, analytics | TypeScript | Apr 2026 |
| 16k | **gastownhall/gastown** | Multi-agent workspace manager | Go | Dec 2025 |
| 8.5k | **getpaseo/paseo** | Orchestrate multiple coding agents from desktop and mobile | TypeScript | Oct 2025 |

**Why it matters:** The "fleet management" layer is consolidating. Practitioners running 3+ agents 24/7 (as seen in HN findings) need fleet-level visibility. hermes-studio and gastown are the leading open-source options. paseo adds mobile-first orchestration — managing agent fleets from a phone.

### Trend 8: Domain Skills Explosion Beyond Engineering

| Stars | Repo | What It Does | Language | Created |
|-------|------|-------------|----------|---------|
| 19k | **alchaincyf/huashu-design** | HTML-native design skill, high-fidelity prototypes | HTML | Apr 2026 |
| 17k | **op7418/guizang-ppt-skill** | Polished slide decks with editorial layouts | HTML | Apr 2026 |
| 16k | **google-labs-code/design.md** | DESIGN.md format spec — visual identity docs for agents | TypeScript | Apr 2026 |
| 9.6k | **browser-use/video-use** | Video editing via coding agents | Python | Apr 2026 |
| 6.3k | **earthtojake/text-to-cad** | Agent skills for CAD, robotics, hardware design | JavaScript | Apr 2026 |
| 4.7k | **calesthio/OpenMontage** | 12 pipelines, 52 tools, 500+ skills for agentic video production | Python | Mar 2026 |

**Why it matters:** The skills economy is rapidly expanding beyond coding into design, video, CAD, presentation, and robotics. google-labs-code/design.md (16k★) is especially significant — it proposes a standard format (`DESIGN.md`) that gives agents a persistent, structured representation of a project's visual identity. This is infrastructure-level context (KE-1924) for non-code domains.

### Star Velocity Winners (June 15 → June 20)

| Repo | Stars (Jun 15) | Stars (Jun 20) | Δ | Notes |
|------|---------------|----------------|---|-------|
| **NousResearch/hermes-agent** | ~184k | 193k | +9k | Continued mega-growth |
| **karpathy/autoresearch** | ~82k | 87k | +5k | Automated ML research capturing interest |
| **colbymchenry/codegraph** | ~45k | 49k | +4k | Code knowledge graph — fast rising |
| **garrytan/gbrain** | ~20k | 23k | +3k | Garry Tan's opinionated agent brain |
| **esengine/DeepSeek-Reasonix** | ~19k | 22k | +3k | DeepSeek coding agent — non-Anthropic growth |
| **multica-ai/multica** | ~34k | 37k | +3k | Managed agents platform |
| **THU-MAIC/OpenMAIC** | ~16k | 19k | +3k | Multi-agent interactive classroom (Chinese academia) |

### Updated Architecture Patterns (June 20)

| Pattern | Status (Jun 15) | Status (Jun 20) | Key Change |
|---------|-----------------|-----------------|------------|
| **Code Knowledge Graphs** | (not tracked) | 🆕 Rising fast | codegraph 49k★, semble 5k★ |
| **Agent-Trainable Skills** | (not tracked) | 🆕 Research→Product | microsoft/SkillOpt closes the skill authoring loop |
| **Sandboxed Orchestration** | (implicit in harnesses) | 🆕 Standalone primitive | sandcastle, CubeSandbox make sandbox a one-liner |
| **Agent-Native Languages** | (not tracked) | 🆕 Early signal | zerolang from Vercel Labs (5k★ in 1 month) |
| **Agent Self-Healing** | (not tracked) | 🆕 Early signal | superlog: agents healing prod systems |
| **Skills-as-Code** | 🔥 Entering saturation | 🔥 Saturated + expanding to non-code domains | Design, CAD, video, slides |
| **Context Engineering** | 🆕 Crystallizing | ✅ Established | code knowledge graphs are the newest expression |
| **Agent Memory** | 🔥 Converging with skills | 🔥 4-tier pipelines emerging | TencentDB-Agent-Memory, MemOS |
| **Harness Engineering** | 🔥 Mature | ✅ Fully mature — books published | Now foundational, no longer a trend |
| **Domain Agent Studios** | 🆕 Growing | 🔥 Exploding | Design, video, CAD, robotics, education |

### The Forgetting Gap: Third Consecutive Scan, Still Zero

Checked all memory repos again. **Zero** implement forgetting, decay, or memory lifecycle governance. All remain append-only. This is the widest research-to-practice gap in the current agent landscape (KE-1920). The arXiv evidence is unequivocal (5+ papers recommending forgetting); the tooling ecosystem is ignoring it entirely.

### Cross-Reference Updates (June 20 KE Connections)

| GitHub Trend (Jun 20) | Related KE | Connection |
|----------------------|-----------|------------|
| codegraph (code knowledge graphs) | KE-1924, KE-1967 | Infrastructure-level context; could bridge code-knowledge split by giving knowledge-agents code structure access |
| SkillOpt (auto-generated skills) | KE-1966, KE-1915 | The missing "promotion mechanism" — soft patterns → hard skills from trajectories |
| sandcastle (sandbox-first orchestration) | KE-1924, KE-1965 | Constraint at infrastructure level; sandbox replaces advisory warnings |
| zerolang (agent programming language) | KE-1927 | Structural turn taken to its logical endpoint |
| superlog (agent self-healing) | KE-1968 | If heartbeat agents self-healed via observation rather than polling, the heartbeat tax shrinks |
| Domain skills explosion | KE-1915 | Skills Absorption beyond code — the thesis applies to all structured work |

---

## 🆕 June 21 Delta: Fresh Scan — New Repos, Star Movements & Emerging Patterns

### Star Velocity Tracker (June 20 → June 21)

Notable star-count movements from the existing corpus:

| Repo | Stars (Jun 20) | Stars (Jun 21) | Δ | Signal |
|------|---------------|----------------|---|--------|
| **NousResearch/hermes-agent** | 193k | 193k | stable | Plateauing after explosive growth |
| **anthropics/skills** | 147k | 150k | +3k | Still actively growing |
| **colbymchenry/codegraph** | 49k | 49k | stable | Established in code-knowledge-graph category |
| **aaif-goose/goose** | 47k | 49k | +2k | Rust-based agent gaining traction |
| **CherryHQ/cherry-studio** | 46k | 47k | +1k | Steady growth for AI desktop app |
| **hesreallyhim/awesome-claude-code** | — | 46k | NEW | Curated skills/hooks/slash-commands list (was below scan threshold before) |
| **multica-ai/multica** | 37k | 37k | stable | Managed agents platform steady |
| **vercel-labs/agent-skills** | — | 28k | NEW | Vercel's official agent skills collection — enterprise credibility signal |
| **oraios/serena** | — | 25k | NEW | MCP toolkit: semantic retrieval & editing for coding agents |
| **topoteretes/cognee** | 17k | 18k | +1k | AI memory platform growth continues |
| **memvid/memvid** | 16k | 16k | stable | Serverless memory layer |
| **osaurus-ai/osaurus** | — | 5.8k | NEW | Native macOS agent harness (Swift) — first notable Swift-based harness |

### New Category: Agent MicroVM & Process Isolation

A new infrastructure pattern emerging around lightweight VM-based agent isolation — directly validating the "Process Isolation" primitive from KE-1975 (OS Recapitulation).

| Stars | Repo | What It Does | Language | Created |
|-------|------|-------------|----------|---------|
| 2.4k | **deeplethe/forkd** | fork() for AI agent microVMs. Spawn 100 children in ~100ms from warm parent, BRANCH a live agent state | Rust | May 2026 |
| 1.7k | **Helvesec/rmux** | Universal Rust multiplexer with typed SDK — drive any CLI/TUI app from code, native agent integration | Rust | May 2026 |

**Why it matters:** forkd (2.4k★, 1 month old) implements literal process-fork semantics for agent state — you can snapshot a running agent and spawn branches. This is the OS "fork()" syscall rebuilt for agents. rmux provides the IPC layer (multiplexed CLI driving). Together they represent the "Process Isolation" and "IPC" OS primitives from KE-1975 being built in the correct dependency order. Both are Rust — confirming Rust's rise as the infrastructure language for agent systems.

### New Category: Token-Efficient & Small-Model Agents

Purpose-built agents designed for extreme token efficiency or small local models — the "less is more" counter-trend to scaling.

| Stars | Repo | What It Does | Language | Created |
|-------|------|-------------|----------|---------|
| 4.5k | **DietrichGebert/ponytail** | "Makes your AI agent think like the laziest senior dev in the room." The best code is the code you don't write | JavaScript | Jun 2026 |
| 4.1k | **opensquilla/opensquilla** | Token-Efficient AI Agent: same budget, higher intelligence density | Python | May 2026 |
| 1.8k | **Doorman11991/smallcode** | AI coding agent optimized for small LLMs. 87% benchmark with 4B-active model | JavaScript | May 2026 |
| 1.3k | **gi-dellav/zerostack** | Minimal coding agent in Rust, optimized for memory footprint and performance | Rust | May 2026 |

**Why it matters:** This cluster represents a counter-movement to the "bigger models, bigger harnesses" trend. ponytail (4.5k★, 2 days old, fastest new repo this scan) explicitly optimizes for NOT doing work — architectural laziness as a design principle. opensquilla optimizes intelligence-per-token. smallcode achieves 87% benchmark performance with a 4B-parameter model. zerostack minimizes the agent binary itself. Together they validate the "Guardrails as Small-Model Equalizer" finding from HN (KE-1965): structural constraint makes small models competitive.

### New Category: Agent Virtual Filesystems

Agents need a consistent view of project state — virtual filesystems are the emerging answer.

| Stars | Repo | What It Does | Language | Created |
|-------|------|-------------|----------|---------|
| 3.2k | **strukto-ai/mirage** | Unified Virtual Filesystem for AI Agents | TypeScript | May 2026 |
| 1.2k | **Kaelio/ktx** | Executable context layer for data/analytics agents — structured filesystem for Claude Code, Codex | TypeScript | May 2026 |

**Why it matters:** mirage (3.2k★) builds a virtual FS layer specifically for agents — abstracting away the real filesystem into an agent-friendly interface. ktx adds an "executable context" layer that agents can query and manipulate as structured data. Both address the OS "Filesystem Hierarchy" primitive from KE-1975. The HORMA filesystem metaphor from arXiv is being implemented in practice.

### New Category: Agent-Native Terminals & IDEs

Operating system vendors are now building agent integration directly into terminals and productivity tools.

| Stars | Repo | What It Does | Language | Created |
|-------|------|-------------|----------|---------|
| 1.0k | **microsoft/intelligent-terminal** | Fork of Windows Terminal with native agent integration | C++ | May 2026 |
| 6.8k | **alibaba/open-code-review** | Battle-tested at Alibaba scale: hybrid architecture code review | Go | May 2026 |
| 4.1k | **KunAgent/Kun** | AI agent workspace with Code and Write modes built into your application | TypeScript | May 2026 |
| 3.3k | **OpenBMB/PilotDeck** | Task-oriented AI Agent productivity platform | TypeScript | May 2026 |

**Why it matters:** Microsoft forking Windows Terminal to add native agent integration is a platform-level signal — the terminal itself is becoming agent-aware. Alibaba's open-code-review (6.8k★) brings battle-tested agent code review from production scale (implies thousands of daily agent-generated PRs). This is the "agent-as-default-colleague" phase, not the "agent-as-novelty-tool" phase.

### New Notable Individual Repos

| Stars | Repo | What It Does | Why Notable |
|-------|------|-------------|-------------|
| 6.7k | **nexu-io/html-anything** | Agentic HTML editor with 75 skills | Agent-native design tool, skills-native from day one |
| 3.1k | **nexu-io/html-video** | HTML → video for coding agents | Video production as an agent skill |
| 1.4k | **beenuar/AiSOC** | AI-powered Security Operations Center | Agent-native SOC: alert fusion + purple-team drills |
| 1.3k | **rpamis/comet** | Agent skill harness with phase-guarded automation | Lifecycle-aware: idea → archive with phase gates |
| 1.0k | **baoyu-design** | Run Claude Design locally as agent skill | Design tool as installable skill |
| 0.9k | **omnigent-ai/omnigent** | Meta-harness over all AI agents | "Meta-harness" pattern — harness-of-harnesses |
| 0.8k | **UditAkhourii/adhd** | Tree-of-thought with pruning for coding agents | Explicit search-space pruning skill |
| 0.8k | **vibecode-pro-max-kit** | Spec-driven coding harness for vibecoders | "Your AI forgets. This remembers." — memory as selling point |

### New Signals from MCP & Tool Connectivity

| Stars | Repo | What It Does | Language | Created |
|-------|------|-------------|----------|---------|
| 25k | **oraios/serena** | MCP toolkit with semantic retrieval and editing | Python | Mar 2025 |
| 44k | **ChromeDevTools/chrome-devtools-mcp** | Chrome DevTools for coding agents | TypeScript | Sep 2025 |
| 1.7k | **MicrosoftDocs/mcp** | Official Microsoft Learn MCP Server and CLI | TypeScript | Jun 2025 |

**Key signal:** Chrome DevTools releasing an official MCP server (44k★) means browser DevTools are now agent-accessible as a first-class tool. Microsoft's official MCP server (1.7k★) confirms institutional adoption of MCP beyond startups.

### Updated Architecture Patterns (June 21)

| Pattern | Status (Jun 20) | Status (Jun 21) | Key Change |
|---------|-----------------|-----------------|------------|
| **Agent MicroVMs** | (not tracked) | 🆕 Early signal | forkd: fork() for agents, 2.4k★ in 1 month |
| **Token-Efficient Agents** | (implicit) | 🆕 Crystallizing | 4 repos, counter-trend to scaling |
| **Agent Virtual Filesystems** | (not tracked) | 🆕 Emerging | mirage, ktx — OS filesystem primitive for agents |
| **Agent-Native Terminals** | (not tracked) | 🆕 Platform-level | Microsoft forking Windows Terminal for agents |
| **Meta-Harnesses** | (single repo) | 🆕 Pattern | omnigent: harness-of-harnesses layer forming |
| **Skills-as-Code** | 🔥 Saturated | 🔥 Hyper-saturated | Vercel official skills (28k★), satire skills thriving |
| **Agent Memory** | 🔥 4-tier pipelines | 🔥 Still no forgetting | osaurus adds macOS-native memory; gap persists |
| **Context Engineering** | ✅ Established | ✅ Mature | Virtual FS and executable context expand the concept |
| **Harness Engineering** | ✅ Fully mature | ✅ Meta-phase | Meta-harnesses (harnesses wrapping harnesses) emerging |
| **Agent Security** | 🆕 Emerging | 🔥 Growing | AiSOC: full SOC as agent system |

### The Forgetting Gap: Fourth Consecutive Scan, Still Zero

Checked all memory repos again, including osaurus (5.8k★, macOS-native with persistent memory), cognee (18k★), and mem0 (59k★). **Zero** implement forgetting, decay, or memory lifecycle management. All remain append-only. The forgetting gap is now the most consistently validated negative finding across four consecutive scans (June 13, 15, 20, 21). The nine independent memory-protocol projects with `forget` verbs identified in KE-1969 remain research/niche; none have entered the mainstream tooling ecosystem.

### The OS Recapitulation Validated (KE-1975 Connection)

This scan's new repos map precisely onto the OS primitive stack from KE-1975:

| OS Primitive | KE-1975 Status | June 21 Repos | Signal |
|---|---|---|---|
| Process Isolation | Predicted as foundational | forkd (fork() for agents), rmux (IPC multiplexer) | Being built in Rust |
| Filesystem Hierarchy | Predicted as needed | mirage (virtual FS), ktx (executable context layer) | Being built in TypeScript |
| Memory Management | Predicted as missing | Still zero forgetting implementations | Gap persists |
| Preemptive Scheduling | Predicted as needed | ponytail ("laziest dev" = scheduling via NOT running) | Inverted approach |
| IPC | Predicted as needed | rmux typed SDK, omnigent meta-harness | Cross-agent channels forming |

This is the first scan where multiple repos independently implement the exact OS primitives KE-1975 predicted were missing, in approximately the correct dependency order (isolation → filesystem → IPC). Memory management/GC remains the persistent gap.

### Cross-Reference Updates (June 21 KE Connections)

| GitHub Trend (Jun 21) | Related KE | Connection |
|----------------------|-----------|------------|
| forkd (agent microVMs) | KE-1975 (OS Recapitulation) | Process isolation primitive being built; validates the "build in OS order" thesis |
| ponytail (laziest-dev agent) | KE-1968 (Heartbeat Tax) | Architectural laziness = avoiding the heartbeat tax by design |
| opensquilla (token-efficient agent) | KE-1925 (Quality-Waste Paradox) | Intelligence-per-token optimization = waste reduction at the agent level |
| smallcode (87% on 4B model) | KE-1965 (Guard Paradox) | Small models + structural constraints = competitive performance (validates Forge pattern) |
| mirage (virtual filesystem) | KE-1975 (OS Recapitulation) | Filesystem hierarchy primitive for agents — HORMA metaphor implemented |
| microsoft/intelligent-terminal | KE-1976 (Accidental Skill) | Platform vendors embedding agent support = agents as default, not optional |
| omnigent (meta-harness) | KE-1973 (Compiler Gap) | Meta-harnesses may become the compiler layer — translating soft patterns across harnesses |
| osaurus (macOS-native harness) | KE-1967 (Code-Knowledge Split) | Native OS integration could bridge ecosystems by making agents first-class OS citizens |

---

## 🆕 July 18 Delta: Star Velocity, Forgetting Gap Cracked, New Categories

### Star Velocity Tracker (June 21 → July 18)

Notable star-count movements from the existing corpus:

| Repo | Stars (Jun 21) | Stars (Jul 18) | Δ | Signal |
|------|---------------|----------------|---|--------|
| **obra/superpowers** | 227k | 229k | +2k | Stable plateau — foundational layer |
| **anthropics/skills** | 147k | 151k | +4k | Continued growth, institutional pull |
| **NousResearch/hermes-agent** | 193k | 194k | +1k | Plateaued |
| **affaan-m/ECC** | 215k | 216k | +1k | Plateaued |
| **aaif-goose/goose** | 47k | 49k | +2k | Rust-based agent steady growth |
| **colbymchenry/codegraph** | 49k | 50k | +1k | Code knowledge graph stable |
| **DietrichGebert/ponytail** | 4.5k | **14k** | **+9.5k** | 🔥 3× growth — "laziest dev" pattern resonating |
| **HKUDS/OpenHarness** | — | **14k** | NEW | Open agent harness w/ personal agent Ohmo |
| **hesreallyhim/awesome-claude-code** | — | **47k** | NEW-in-scan | Skills/hooks/slash-commands curation list |
| **oraios/serena** | — | **25k** | NEW-in-scan | MCP toolkit: semantic retrieval & editing |
| **vercel-labs/agent-skills** | — | **28k** | NEW-in-scan | Vercel's official skills collection |
| **microsoft/SkillOpt** | 6.4k | 7.1k | +0.7k | Steady — automated skill generation |
| **Hmbown/CodeWhale** | — | **38k** | NEW-in-scan | Open-source community-driven harness |

**Key velocity signal:** ponytail's 3× growth (4.5k→14k in ~4 weeks) confirms "architectural laziness" — optimizing for NOT doing work — is a deeply resonating pattern. The repo's tagline ("Makes your AI agent think like the laziest senior dev in the room") is a cultural meme that encodes a genuine architectural insight: the cheapest session is the one that doesn't run.

### 🔑 THE FORGETTING GAP CRACKS OPEN

**For five consecutive scans (June 13–21), the forgetting gap was the most consistently validated negative finding: zero mainstream repos implemented memory decay.** This scan finds the first crack:

| Stars | Repo | What It Does | Language | Created |
|-------|------|-------------|----------|---------|
| 245 | **sachitrafa/YourMemory** | Ebbinghaus forgetting curve decay for agent memory. Claims **+16pp better recall than Mem0** on LoCoMo benchmark. MCP-native, PgVector-backed. | Python | Mar 2026 |

**Why this matters:** YourMemory is the first repo in five scans to implement scientifically-grounded forgetting (Ebbinghaus curve, not random deletion). At 245★ it's still niche, but the benchmark claim (+16pp over Mem0, a 59k★ project) is provocative — it suggests forgetting **improves** recall, not just saves storage. This directly validates KE-1920 (Forgetting Deficit): the gap persists in the mainstream (mem0, cognee, letta, beads — all still append-only), but the research-to-practice bridge has its first plank.

**Two additional forgetting-adjacent repos detected:**

| Stars | Repo | What It Does | Created |
|-------|------|-------------|---------|
| 82 | **AIPMAndy/dna-memory** | "Memory that learns, forgets, and evolves" — brain-inspired lifecycle | Mar 2026 |
| 218 | **varun29ankuS/shodh-memory** | Cognitive memory that "forgets what's irrelevant" | Dec 2025 |

Both are sub-250★ and unproven, but the signal is clear: forgetting is entering the implementation phase. The five-scan zero has become a three-repo trickle. Mainstream adoption remains absent.

### New Category: Governance-as-Skill

A new pattern where **governance mechanisms themselves are packaged as installable skills** — not external enforcement, but self-governing capabilities the agent carries.

| Stars | Repo | What It Does | Language | Created |
|-------|------|-------------|----------|---------|
| 750 | **amElnagdy/guard-skills** | Quality gates as agent skills — catch AI-generated failure modes in code, tests, and docs | N/A | Jun 2026 |
| 518 | **berabuddies/Semia** | Security audit for AI agent skills (audit the skills themselves) | Python | May 2026 |
| 823 | **denoland/clawpatrol** | Security firewall for agents (Deno team) | Go | Apr 2026 |
| 1,867 | **YeQing17-2026/OmniAgent** | Self-evolving agent with dynamic security hardening | Python | Apr 2026 |

**Why this matters:** guard-skills (750★, 9 days old) is the first repo that packages **governance as a skill** — the agent carries its own quality gates as portable capabilities, not as external enforcement. This is the Compilation Gradient's terminal stage: governance compiled so deeply it becomes indistinguishable from capability. Semia inverts this by auditing the skills themselves — governance OF skills, not governance AS skills.

**Connection to KE chain:** This pattern is precisely the "compliance-by-construction" principle (2606.13405) from arXiv, the "structural turn" from XHS (KE-1927), and the resolution predicted by the Guard Paradox (KE-1996): behavioral warnings (0.27% conversion) are replaced by structural skills that make violations impossible.

### New Category: Institutional Science Skills

Google DeepMind enters the skills economy directly with domain-specific scientific capabilities:

| Stars | Repo | What It Does | Language | Created |
|-------|------|-------------|----------|---------|
| 1,899 | **google-deepmind/science-skills** | GDM Science Skills — AlphaGenome, AFDB, UniProt, 30+ databases. Better grounding, higher token efficiency | Python | May 2026 |

**Why this matters:** This is the first **institutional research lab** publishing domain skills (not a startup, not a community effort). GDM's entry signals that skills-as-code has become the default distribution format for domain capabilities — even for frontier research tools. The skills wrap access to proprietary databases (AlphaGenome, AlphaFold DB) behind agent-friendly interfaces, creating a distribution channel that didn't exist 6 months ago.

### New Category: Layered Memory Operating Systems

Memory is evolving from flat key-value stores to multi-layer architectures:

| Stars | Repo | What It Does | Language | Created |
|-------|------|-------------|----------|---------|
| 1,114 | **ClaudioDrews/memory-os** | 7-layer memory OS for Hermes Agent: persistent memory with Qdrant, structured facts, fabric recall, auto-curated wiki, surgical context injection | Python | May 2026 |
| 1,006 | **PaperGuru-AI/PaperGuru-Benchmark** | Lifecycle-Aware Memory for long-horizon agents — 66.05% on PaperBench | TeX | May 2026 |
| 5,506 | **holaboss-ai/holaOS** | Local-first agent with learning context, forgetting-aware | Python | Mar 2026 |

**Key signal:** memory-os at 1.1k★ (2 weeks old) implements the most structured memory architecture yet: 7 explicit layers from raw context to curated wiki. PaperGuru-AI's "Lifecycle-Aware Memory" explicitly treats memory lifecycle (creation → maturation → decay) as a first-class concern. Combined with YourMemory's Ebbinghaus curves, the ecosystem is moving from "memory = append" to "memory = managed lifecycle."

### New Notable Individual Repos

| Stars | Repo | What It Does | Why Notable |
|-------|------|-------------|-------------|
| 3,701 | **datawhalechina/Agent-Learning-Hub** | AI Agent learning roadmap (trilingual CN/EN/TW) | Chinese community systematizing agent education |
| 2,893 | **google/agents-cli** | CLI + skills for expert agent evaluation, testing | Google entering agent evaluation tooling |
| 3,194 | **vercel-labs/deepsec** | Security harness for code vulnerability scanning | Vercel's security entry — harness-first approach |
| 891 | **plannotator/effective-html** | Skill for HTML plans, architecture diagrams, roadmaps | Agent-generated documentation/diagrams |
| 665 | **orange2ai/renwei-writing** | "人味儿写作" — writing skill that preserves human voice | Cultural signal: preserving humanity in agent output |

### Updated Architecture Patterns (July 18)

| Pattern | Status (Jun 21) | Status (Jul 18) | Key Change |
|---------|-----------------|-----------------|------------|
| **Governance-as-Skill** | (not tracked) | 🆕 Emerging | guard-skills, Semia: governance packaged as portable capability |
| **Memory Lifecycle** | Still zero forgetting | 🆕 **Gap cracking** | YourMemory (Ebbinghaus), memory-os (7-layer), PaperGuru (lifecycle-aware) |
| **Institutional Skills** | (community-driven) | 🆕 Institutional | Google DeepMind science-skills — labs publishing domain skills directly |
| **Skills-as-Code** | 🔥 Hyper-saturated | ✅ **Post-saturation: specialization phase** | From "everything is a skill" to specialized verticals (science, security, governance) |
| **Token-Efficient Agents** | 🆕 Crystallizing | 🔥 **Confirmed trend** | ponytail 3× growth proves "do less" resonates |
| **Agent Security** | 🔥 Growing | 🔥 **Maturing — three sub-patterns** | Firewall (clawpatrol), skill audit (Semia), self-hardening (OmniAgent) |
| **Harness Engineering** | ✅ Meta-phase | ✅ **Ecosystem-level** | OpenHarness 14k★ — open frameworks for building harnesses on harnesses |
| **Agent Memory** | 🔥 Still no forgetting | 🔥 **Forgetting entering tooling** | Five-scan zero finally broken; still niche |
| **Context Engineering** | ✅ Mature | ✅ Mature | Stable; absorbed into skills and harness patterns |
| **Agent MicroVMs** | 🆕 Early signal | 🔥 Growing | forkd at 2.4k★, rmux at 1.8k★ |

### The Forgetting Gap: Status Change — From "Zero" to "Trickle"

After five consecutive scans (June 13, 15, 20, 21) with **zero** forgetting implementations, this scan finds three repos implementing memory decay or lifecycle management. The mainstream (mem0 at 59k★, cognee at 18k★, letta at 23k★) remains append-only. But the research-to-practice gap that has been the widest in the agent landscape for a month is now showing its first bridge spans.

| Status | Repos | Evidence |
|--------|-------|----------|
| **Mainstream (>5k★)** | 0/12 implement forgetting | All append-only as of Jul 18 |
| **Emerging (200–5k★)** | 3 implement forgetting | YourMemory (245★), shodh-memory (218★), dna-memory (82★) |
| **Lifecycle-aware (>1k★)** | 2 treat lifecycle explicitly | memory-os (1.1k★), PaperGuru (1k★) |

**Prediction update:** Prior scans predicted the forgetting gap would persist. **Revised prediction:** At least one forgetting-aware memory repo will cross 1k★ within 3 months (by Oct 2026). The Ebbinghaus-curve approach (YourMemory's +16pp claim) may force mainstream repos to add decay as a competitive feature.

### Cross-Reference Updates (July 18 KE Connections)

| GitHub Trend (Jul 18) | Related KE | Connection |
|----------------------|-----------|------------|
| YourMemory (forgetting curve) | KE-1920 (Forgetting Deficit) | First tooling-level implementation of forgetting; validates deficit thesis AND shows improvement from forgetting |
| guard-skills (governance-as-skill) | KE-1996 (Guard Paradox) | Governance compiled into portable skill = Compilation Gradient terminus |
| ponytail 3× growth | KE-1968, KE-2001 (Heartbeat Tax, Phantom Metabolism) | "Do nothing" as the optimal action — the community pricing in abstention value |
| OpenHarness (open harness framework) | KE-1924 (Constraint Placement) | Harness engineering → harness frameworks → harness ecosystem |
| GDM science-skills | KE-1915 (Skills Absorption) | Institutional validation: even frontier labs use skills-as-code distribution |
| Semia (skill audit) | KE-2010 (Evaluation Mirage) | Audit the governance mechanism, not just the agent — meta-evaluation |
| memory-os (7-layer) | KE-1975 (OS Recapitulation) | Memory management as explicit OS layer; validates layered-OS trajectory |

---

## 🆕 July 22 Delta: Star Velocity, Memory Lifecycle Acceleration, New Categories

### Star Velocity Tracker (July 18 → July 22)

| Repo | Stars (Jul 18) | Stars (Jul 22) | Δ | Signal |
|------|---------------|----------------|---|--------|
| **obra/superpowers** | 229k | 231k | +2k | Stable plateau — foundational |
| **anthropics/skills** | 151k | 152k | +1k | Steady institutional growth |
| **NousResearch/hermes-agent** | 194k | 196k | +2k | Reaccelerated from plateau |
| **DietrichGebert/ponytail** | 14k | **30k** | **+16k** | 🔥🔥 2.1× in 4 days — "laziest dev" entering mainstream |
| **colbymchenry/codegraph** | 50k | 51k | +1k | Stable — code knowledge graph established |
| **aaif-goose/goose** | 49k | 50k | +1k | Rust-based agent steady |
| **addyosmani/agent-skills** | 58k | 62k | +4k | Production skills accelerating |
| **microsoft/SkillOpt** | 7.1k | 8.0k | +0.9k | Auto-generated skills steady |
| **google-deepmind/science-skills** | 1.9k | 1.9k | stable | Institutional presence, slow growth |
| **clawpatrol** (Deno) | 823 | 840 | +17 | Security firewall steady |
| **guard-skills** | 750 | 802 | +52 | Governance-as-skill growing |
| **Semia** | 518 | 546 | +28 | Skill auditing — steady interest |

**Headline signal:** ponytail's explosive growth (4.5k→14k→30k in 5 weeks) is now the single fastest-growing agent philosophy repo. "Architectural laziness" — making the agent think like the laziest senior dev who writes no code when none is needed — has become a mainstream design principle, not a joke. This is the Abstention Advantage crystallized as open-source tooling.

### New Category: Memory Versioning & Provenance

A new pattern is emerging that directly addresses our Eternal Present thesis: memory systems with **git-like versioning**, provenance tracking, and supersession chains.

| Stars | Repo | What It Does | Language | Created |
|-------|------|-------------|----------|---------|
| 289 | **esaradev/icarus-memory-infra** | Provenance, rollback, lifecycle/supersession, three-layer model (working memory + session archive + wiki). Markdown on disk, MCP-native | Python | Mar 2026 |
| 124 | **loryoncloud/Memory-Like-A-Tree** | Confidence-based lifecycle, auto-decay, cross-agent search, Obsidian sync | Python | Feb 2026 |
| 101 | **memforks-dev/memforks** | "Git for AI agent memory" — branching, merging, versioned state | TypeScript | Jun 2026 |
| 28 | **kresnapandu/memwatch** | Memory staleness detection and auto-expiry for LLM agents | Python | Jun 2026 |
| 28 | **edihasaj/universal-memory-protocol** | Universal Memory Protocol (UMP) — "the third interop layer beside MCP (tools) and A2A (coordination)" | TypeScript | Jun 2026 |

**Why this matters:** icarus-memory-infra (289★) explicitly implements **provenance** and **supersession** — two of the five temporal primitives identified in the Eternal Present synthesis. memwatch implements **expiry** (staleness detection + auto-cleanup). Memory-Like-A-Tree implements **confidence-based decay**. The Universal Memory Protocol proposes memory as a third standardized layer alongside MCP (tools) and A2A (agents). Together, these repos represent the first tooling-level attempt to solve temporal blindness in agent memory — the exact gap the Eternal Present thesis identified.

### New Category: Loop Engineering

A naming crystallization for the practice of designing agent execution loops with explicit cost, audit, and structure.

| Stars | Repo | What It Does | Language | Created |
|-------|------|-------------|----------|---------|
| 353 | **cobusgreyling/loop-engineering** | Practical patterns, starters & CLI tools for loop engineering. Includes `loop-audit`, `loop-init`, `loop-cost` | JavaScript | Jun 2026 |

**Why this matters:** "Loop Engineering" as a named practice is a natural successor to "Harness Engineering" — where harness engineering focuses on the wrapper around the agent, loop engineering focuses on the internal execution cycle (when to retry, when to abort, when to escalate, how to budget). The inclusion of `loop-cost` as a first-class tool validates the Compilation Threshold thesis: practitioners are building cost-awareness directly into execution loops.

### New Category: Cross-Vendor Agent Orchestration

Agent workflows that deliberately combine models from different providers in structured loops.

| Stars | Repo | What It Does | Language | Created |
|-------|------|-------------|----------|---------|
| 492 | **DanMcInerney/architect-loop** | Claude Fable 5 as architect, GPT-5.5 Codex as builder, the repo as memory. Research-backed cross-vendor loop | HTML | Jun 2026 |
| 254 | **baskduf/FableCodex** | Codex-style coding agent workflow that plans like Fable | Python | Jun 2026 |
| 450 | **mrtooher/fable-mode** | Skill that activates Fable-style agentic behavior: multi-stage planning, sub-agent delegation, self-verification | N/A | Jun 2026 |

**Why this matters:** architect-loop implements a deliberate division: one model (Claude) for planning/architecture, another (Codex) for execution, with the repo itself serving as shared memory. This cross-vendor pattern treats models as interchangeable components selected by strength — architecture reasoning vs. code generation. The "repo as memory" approach is a zero-infrastructure implementation of persistent state that sidesteps the entire memory infrastructure category.

### New Entrant: Vercel Eve

| Stars | Repo | What It Does | Language | Created |
|-------|------|-------------|----------|---------|
| 391 | **vercel/eve** | "The Framework for Building Agents" — Vercel's official agent framework | TypeScript | Jun 16 2026 |

**Why this matters:** Vercel entering the agent framework space with an official (not labs) product confirms agents are now a first-class platform primitive for web infrastructure companies. Combined with vercel-labs/zerolang (5.1k★, agent programming language) and vercel-labs/agent-skills (28k★), Vercel is building a complete agent stack: language → framework → skills. This is the "platform capture" phase where infrastructure vendors absorb the agent layer.

### Memory Lifecycle Status: From "Trickle" to "Emerging Category"

The forgetting gap tracked across six scans shows clear progression:

| Scan Date | Forgetting Implementations | Lifecycle-Aware | Status |
|-----------|---------------------------|-----------------|--------|
| Jun 13 | 0 | 0 | Zero |
| Jun 15 | 0 | 0 | Zero |
| Jun 20 | 0 | 0 | Zero |
| Jun 21 | 0 | 0 | Zero |
| Jul 18 | 3 (niche) | 2 | Trickle |
| **Jul 22** | **3 (unchanged)** | **5 (icarus, Memory-Like-A-Tree, memwatch, memforks, UMP)** | **Emerging** |

The shift: while raw forgetting implementations haven't grown, the **lifecycle-aware** category has accelerated. Five repos now explicitly address memory versioning, provenance, staleness, or supersession. The mainstream (mem0 59k★, cognee 18k★, letta 23k★) remains append-only, but the ecosystem is building lifecycle infrastructure around them rather than waiting for them to change.

**Updated prediction:** The "lifecycle layer" approach (provenance/versioning added atop existing append-only stores) may be how forgetting enters the mainstream — not as a feature of mem0, but as a wrapper around it (like how icarus-memory-infra works with any backend).

### Updated Architecture Patterns (July 22)

| Pattern | Status (Jul 18) | Status (Jul 22) | Key Change |
|---------|-----------------|-----------------|------------|
| **Memory Provenance/Versioning** | (not tracked) | 🆕 Emerging category | icarus (provenance), memforks (git-for-memory), memwatch (expiry) |
| **Loop Engineering** | (implicit in harness) | 🆕 Named practice | cobusgreyling/loop-engineering with cost-audit tools |
| **Cross-Vendor Orchestration** | (not tracked) | 🆕 Emerging | architect-loop, FableCodex — deliberate model mixing |
| **Platform Agent Capture** | (Vercel labs) | 🆕 Escalated to official | Vercel/eve is official framework, not labs experiment |
| **Token-Efficient Agents** | 🔥 Confirmed | 🔥🔥 **Explosive** | ponytail 30k★ — fastest growth in agent ecosystem |
| **Skills-as-Code** | ✅ Post-saturation | ✅ Specialization deepening | Skills for reverse engineering (ghidra-rpc), game dev (threejs), video editing |
| **Memory Lifecycle** | 🆕 Gap cracking | 🔥 **Lifecycle wrappers emerging** | Provenance, versioning, and expiry as separate layer |
| **Governance-as-Skill** | 🆕 Emerging | 🔥 Growing | guard-skills 802★, Semia 546★ — steady growth |
| **Harness Engineering** | ✅ Ecosystem-level | ✅ Mature + Loop Engineering fork | Loop engineering separates from harness engineering |

### The Domain Skills Explosion Continues

New domain-specific skills spotted this scan:

| Stars | Repo | Domain | Why Notable |
|-------|------|--------|-------------|
| 221 | **cellebrite-labs/ghidra-rpc** | Reverse engineering | Cellebrite (forensics company) publishing agent skills — security vendor adoption |
| 218 | **majidmanzarpour/threejs-game-skills** | Game development | Full game dev pipeline as agent skills |
| 182 | **liuluhaixiu/DaVinci-AutoEdit-Agent** | Video editing | DaVinci Resolve automation via MCP — professional creative tools |
| 182 | **ferdinandobons/brand-docs** | Document generation | Brand-aware document skills — preserves brand identity by construction |
| 768 | **orange2ai/renwei-writing** | Writing | "人味儿写作" — preserving human voice in agent output. Cultural signal: resisting homogenization |

**Key observation:** The skills ecosystem has passed the saturation inflection and entered the specialization phase. New skills are no longer general-purpose ("code better") but hyper-domain ("automate DaVinci Resolve," "reverse-engineer binaries," "preserve brand identity in Word templates"). This mirrors the maturation pattern of every software ecosystem: generalization → saturation → specialization → consolidation.

### Cross-Reference Updates (July 22 KE Connections)

| GitHub Trend (Jul 22) | Related KE | Connection |
|----------------------|-----------|------------|
| ponytail 30k★ (2.1× in 4 days) | Abstention Advantage, Compilation Threshold | "Do nothing" as highest-value action — mainstream adoption of abstention-by-design |
| icarus-memory-infra (provenance) | Eternal Present synthesis | First tooling implementation of PROVENANCE temporal primitive |
| memwatch (auto-expiry) | Eternal Present synthesis | First tooling implementation of EXPIRY temporal primitive |
| memforks (git-for-memory) | Eternal Present synthesis | Memory CONSOLIDATION via branching/merging semantics |
| architect-loop (cross-vendor) | Substrate Inversion | Intelligence in the loop architecture, not the model — vendor-agnostic by design |
| loop-engineering (named practice) | Compilation Threshold | Cost-aware execution loops = compiled governance of the inner loop |
| Vercel/eve (official framework) | Substrate Inversion | Platform vendors absorbing agent layer confirms intelligence-in-architecture shift |
| UMP (memory protocol standard) | Agent Protocols (MCP/A2A) | Third protocol layer (memory) alongside tools (MCP) and agents (A2A) — protocol stack completing |
| renwei-writing (human voice preservation) | Discrimination Crisis | Resistance to AI homogenization — preserving human distinctiveness as a skill |

### Three Predictions (July 22)

1. **ponytail crosses 50k★ by August 2026.** Its growth curve (4.5k→30k in 5 weeks) and meme resonance ("laziest dev") make it the fastest-growing philosophy repo in agent history. The underlying insight (optimal inaction > marginal action) has deep structural validity.

2. **Memory lifecycle wrappers surpass standalone memory stores within 12 months.** The ecosystem will solve forgetting not by adding it to mem0, but by building lifecycle layers (provenance, expiry, versioning) that wrap any backend. icarus-memory-infra's architecture (backend-agnostic lifecycle) is the template.

3. **The protocol stack completes with a memory standard by Q4 2026.** MCP (tools), A2A (agents), and UMP (memory) form a three-layer agent interop stack. The memory layer is the last unfilled slot, and the UMP proposal (28★ but architecturally clean) or a competing spec will gain traction as cross-agent memory sharing becomes a bottleneck.

---

*Data sourced from GitHub Search API, June 13, 15, 20, 21, July 18, & July 22, 2026. Star counts are approximate and change daily.*
