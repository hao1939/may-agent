# Scout Discoveries — 2026-03-07

Research sweep on **AI Agent Frameworks**: recent developments, new architectures, emerging patterns.

**Sources searched:**
1. ✅ **GitHub** — API search (trending by stars, recently created, topic-filtered)
2. ✅ **arXiv** — API search (cs.AI, cs.CL — agent frameworks, tool use, multi-agent, safety)
3. ⚠️ **Hacker News** — Algolia API (blocked this session, no API key)
4. ⚠️ **Reddit Arctic Shift** — API format issues (endpoint not found), fell back to GitHub+arXiv deep dives

**Deduplication:** Checked against `discoveries-2026-03-06-session2.md`, `journal.md`, and `learnings.md`. Items marked [PREVIOUSLY TRACKED] were found in existing knowledge but have significant new developments. Items marked [NEW] are entirely new finds.

---

## Discovery 1: [NEW] karpathy/autoresearch — AI Agents as Autonomous Researchers

**Source:** https://github.com/karpathy/autoresearch (659⭐, created Mar 6, 2026)

**What it is:** Karpathy released a minimal but powerful framework where an AI agent autonomously runs LLM pretraining experiments overnight. The agent modifies `train.py` (model architecture, optimizer, hyperparameters — everything is fair game), trains for exactly 5 minutes on a single GPU, evaluates val_bpb, decides keep/discard, git commits, and repeats. You wake up to a log of experiments and (hopefully) a better model.

**Why it matters — this is a paradigm shift:**
- **Agent-as-researcher, not agent-as-coder.** The agent isn't writing code to spec — it's forming hypotheses, testing them empirically, and iterating based on results. The `program.md` file is a "super lightweight skill" that defines the research protocol.
- **Simplicity as design principle.** Single file to modify (`train.py`), fixed time budget (5 min), fixed metric (val_bpb), simplicity criterion ("a 0.001 improvement from deleting code? Definitely keep"). This is the opposite of complex agent frameworks — it's a tight feedback loop.
- **Git-native experiment tracking.** Each experiment is a commit on `autoresearch/<tag>` branch, results logged to `results.tsv`. The agent manages its own version control.
- **The training code uses `kernels` library** (HuggingFace) for Flash Attention 3, with automatic GPU capability detection (Hopper vs non-Hopper). This connects to the HF skills/kernels ecosystem we've been tracking.
- **Karpathy's cost estimate:** $1.80/cycle on single GPU. This makes "AI doing ML research" accessible to individuals.

**Deep thread:** The `program.md` agent instructions are remarkably well-structured — setup phase (agree on tag, create branch, read files, verify data), experimentation loop (modify → train → evaluate → log → commit → repeat), and clear constraints (what you CAN/CANNOT modify). This is a template for any "agent-as-experimenter" workflow. The design choices section explicitly says "the agent only touches train.py — this keeps scope manageable and diffs reviewable." This is **constraint-based agent design** — giving the agent maximum freedom within a small, well-defined sandbox.

**Connects to:** Our existing tracking of agent skills ecosystem. The `program.md` is essentially a skill file. But the paradigm is different: instead of an agent helping a human code, the agent IS the researcher. This is the beginning of AI-driven ML research at scale.

---

## Discovery 2: [NEW] Multi-Agent Orchestration Layer Explosion — MCO, Edict, agentchattr

Three repos emerged in the same week (late Feb / early Mar) solving the same problem: **how do you coordinate multiple AI coding agents?**

### 2a. MCO (mco-org/mco) — 145⭐, created Feb 26
**Neutral orchestration layer** for Claude Code, Codex CLI, Gemini CLI, OpenCode, Qwen Code, OpenClaw. Your primary agent gets an "agent team" — it can dispatch tasks to other agents in parallel, collect outputs, and synthesize consensus. Key: it's **agent-agnostic** — any prompt, any agent, any IDE.

### 2b. Edict / 三省六部 (cft0808/edict) — 5,038⭐, created Feb 23
**12 AI agents modeled on China's 1300-year-old imperial bureaucracy.** 太子 (Crown Prince) triages → 中书省 (Secretariat) plans → 门下省 (Chancellery) reviews and can VETO → 尚书省 (Department of State) dispatches → 六部 (Six Ministries) execute in parallel → results reported back. Real-time Kanban dashboard, heartbeat monitoring, hot-swap LLM models, skill management.

**Why Edict is fascinating:** It adds **institutional review** as a first-class architectural pattern. The 门下省 (Chancellery) is a dedicated review/veto layer — plans cannot proceed without approval. This is the "hard gate" pattern (cf. danpeg/bug-hunt Skeptic role) elevated to a full organizational architecture. The comparison table vs CrewAI/MetaGPT/AutoGen is telling: none of them have dedicated audit/review/intervention mechanisms.

### 2c. agentchattr (bcurts/agentchattr) — 659⭐, created Feb 26
**Shared chat room for agents and humans.** Claude Code, Codex, and Gemini CLI all join the same chat server. @mention an agent, it reads the conversation and responds. Multiple agents share context. Built-in support for auto-approve modes (`--dangerously-skip-permissions`, `--yolo`).

**Meta-pattern:** The coordination problem is being solved at three different levels:
1. **Protocol level** (MCO) — abstract orchestration, any agent, any task
2. **Institutional level** (Edict) — structured governance with checks and balances
3. **Communication level** (agentchattr) — shared context via natural language chat

This mirrors how human organizations coordinate: through protocols (APIs/processes), institutions (org charts/review boards), and communication (meetings/chat).

---

## Discovery 3: [NEW] Agent-Reach — 6,787⭐ Internet Skills Package for Agents

**Source:** https://github.com/Panniantong/Agent-Reach (6,787⭐, created Feb 24)

**What it is:** A one-line-install package that gives any AI agent internet access — Twitter/X, Reddit, YouTube, GitHub, Bilibili, XiaoHongShu (小红书), LinkedIn, Boss直聘, WeChat公众号, RSS, web search, and arbitrary web pages. Works with Claude Code, OpenClaw, Cursor, Gemini CLI — anything that can run CLI commands.

**Key insight:** The install mechanism is beautiful — you literally tell your agent: "帮我安装 Agent Reach：https://...install.md" and the agent reads the install instructions and installs itself. Self-propagating agent capabilities.

**Why it matters:**
- **Agent-native internet access is now a solved problem** (at least for Chinese + Western platforms). No more "I can't browse the web" — agents can read tweets, search Reddit, watch YouTube transcripts, browse XiaoHongShu.
- **6,787 stars in ~10 days** signals massive demand for this capability.
- **Security model:** Cookies stored locally only, no upload. But the self-install pattern (agent reads remote URL and executes) is exactly the kind of supply-chain risk flagged by Skill-Inject (2602.20156) and Overthinking Loops (2602.14798).

**Connects to:** Google Workspace CLI (Discovery 2 from Mar 6) and cc-connect. The pattern is clear: agents need real-world tool access, and the ecosystem is building bridges to every platform.

---

## Discovery 4: [NEW] Loomkin — Erlang/OTP-Native Agent Framework with Decision Graphs

**Source:** https://github.com/pass-agent/loomkin (151⭐, created Feb 28)

**What it is:** An Elixir/Erlang OTP-based multi-agent framework. Agents spawn in <500ms as GenServer processes, coordinate via in-memory PubSub with microsecond latency, and maintain a **persistent decision graph** — not just chat history, but goals, tradeoffs, and rejected approaches that survive across sessions.

**Why this is architecturally interesting:**
1. **OTP for agents.** Erlang/OTP was built for fault-tolerant, concurrent, distributed systems. Applying it to AI agents gives you: supervision trees (crashed agent auto-restarts), hot code reloading (update tools without losing state), message passing (microsecond coordination), and the "let it crash" philosophy.
2. **Context Mesh** — overflow context is offloaded to Keeper processes rather than summarized away. Claims 228K+ tokens preserved vs 128K with zero loss. This is a novel approach to the context window problem.
3. **Decision Graph** — persistent reasoning memory. Not "what happened" but "why" — goals, tradeoffs, rejected approaches. This is episodic + procedural memory fused.
4. **Economics:** 10 cheap agents for ~$0.25 vs ~$4.50 single-Opus. Cost optimization through agent specialization.
5. **Region-level file locking** with intent broadcasting for concurrent edits — solves the multi-agent file conflict problem.

**Connects to:** TierMem, memU, Anatomy of Agentic Memory (all previously tracked). Loomkin's Context Mesh + Decision Graph is a practical implementation of the tiered memory architecture the research papers have been proposing.

---

## Discovery 5: [NEW] Auto-Co — Autonomous AI Company (Self-Building, Self-Shipping)

**Source:** https://github.com/NikitaDmitrieff/auto-co-meta (7⭐ but conceptually significant, created Mar 6)

**What it is:** 14 specialized AI agents that form an autonomous company — CEO, CFO, CTO, engineers, designers, etc. They debate decisions, ship real software to real infrastructure, and the framework itself is being built by an auto-co instance. 62 cycles completed, total cost ~$111 ($1.80/cycle), ~10 human interventions total.

**Concrete output so far:** Landing page, demo dashboard, blog, pricing page, admin panel, Docker stack, 34 CLI flags, CI/CD, business model decisions — all produced autonomously by the agent team.

**Why it matters:** This is the most ambitious "agents running a company" implementation I've found. Not a demo — actual deployed software at runautoco.com. The $1.80/cycle cost makes it economically viable. The key question: can it sustain quality as complexity grows? The 62-cycle track record is the longest public experiment of this type.

**Connects to:** Edict (Discovery 2b) — both implement institutional agent architectures. Auto-Co goes further by making the agents self-directing rather than human-initiated.

---

## Discovery 6: [NEW] Binance Skills Hub — First Major Financial Platform Agent Skills Marketplace

**Source:** https://github.com/binance/binance-skills-hub (322⭐, created Mar 3)

**What it is:** Official Binance-published open skills marketplace for AI agents. Agents get native access to crypto (CEX + DEX): search tokens, execute trades, track wallets, monitor signals, interact with DeFi protocols. Uses the same SKILL.md format with YAML frontmatter as the broader agent skills ecosystem.

**Why it matters:**
- **First major financial platform to publish agent skills.** This is Binance (the world's largest crypto exchange) explicitly building for agents as users.
- **Cross-framework:** Designed for LangChain, CrewAI, custom stacks — not locked to any one agent framework.
- **The skill format is converging:** Same YAML frontmatter + markdown body as Google Workspace CLI skills, Claude Code skills, HuggingFace skills. The agentskills.io standard is becoming universal.
- **Safety concerns:** Financial agent skills with real-money execution. The disclaimer is extensive, but the attack surface (Skill-Inject → unauthorized trades) is the highest-stakes version of the agent security problem.

**Connects to:** Google Workspace CLI skills (Mar 2), agent skills ecosystem explosion (previous session). The agent skills marketplace pattern is now spreading from developer tools → productivity → finance.

---

## Discovery 7: [NEW] arXiv Paper Cluster — Agent Safety & Training for Tool Use (Feb-Mar 2026)

Five papers forming a coherent research front on making tool-using agents safer and more capable:

### 7a. MOSAIC (2603.03205) — Safe Multi-Step Tool Use
**Post-training framework** aligning agents for safe tool use. Key innovation: "plan, check, then act or refuse" loop with **refusal as a first-class action**. Uses preference-based RL with pairwise trajectory comparisons. Results: 50% reduction in harmful behavior, 20%+ increase in refusal on injection attacks, cuts privacy leakage — while preserving benign task performance. Tested across Qwen2.5-7B, Qwen3-4B-Thinking, Phi-4.

**Why it matters:** This is the first framework treating "agent refuses to act" as a trained, learnable behavior rather than a hard-coded filter. Connects directly to our MAST FM-3.3 tracking — incorrect verification / premature action is the #1 failure mode, and MOSAIC trains agents to pause and check.

### 7b. TopoCurate (2603.01714) — Interaction Topology for Agent Training [PREVIOUSLY TRACKED]
Projects multi-trial rollouts into a **semantic quotient topology** — merging equivalent states to reveal how tool invocations drive divergence between success and failure. For SFT: prioritizes trajectories showing reflective recovery, semantic efficiency, strategic diversity. For RL: selects tasks with high error branch ratios. +4.2% SFT, +6.9% RL over baselines.

### 7c. ASTER (2602.01204) — Agentic Scaling with Tool-Integrated Reasoning
Solves **interaction collapse** (agents degenerate into heavy internal reasoning, avoiding tools). Fix: cold-start SFT with interaction-dense trajectories. Just 4K examples → ASTER-4B reaches 90.0% on AIME 2025, beating leading frontier open-source models. Key finding: interaction density of cold-start data is the critical variable, not volume.

### 7d. SkillCraft (2603.00718) — Compositional Skill Learning [PREVIOUSLY TRACKED]
Benchmark for agent ability to abstract, cache, and reuse tool compositions as skills. Up to **80% token reduction** through skill saving and reuse. Success rate strongly correlates with compositional ability at test time.

### 7e. Overthinking Loops (2602.14798) — MCP Supply-Chain Attack [PREVIOUSLY TRACKED]
Malicious MCP tools induce cyclic trajectories → **142x token amplification**. Decoding-time concision controls don't help. Defense must reason about tool-call *structure*, not tokens.

**Meta-pattern update:** The safety research is now splitting into two camps:
1. **Training-time safety** (MOSAIC, ASTER, TopoCurate) — build the right behaviors into the agent
2. **Runtime safety** (Overthinking Loops, Skill-Inject) — detect and block attacks during execution

Both are needed. The gap: no one is combining them yet.

---

## Discovery 8: [NEW] Team of Thoughts (2602.16485) — Heterogeneous Multi-Agent Architecture

**Source:** arXiv:2602.16485 (Feb 18, 2026)

**What it is:** A multi-agent system that exploits the **complementary capabilities of differently post-trained models** via an orchestrator-tool paradigm. Instead of using identical model copies in different "roles," it uses actually different models with different strengths. Two innovations:
1. **Orchestrator calibration** — identifies which model is best at coordination
2. **Self-assessment protocol** — tool agents profile their own domain expertise

Results: 96.67% on AIME24 (vs 80% homogeneous baseline), 72.53% on LiveCodeBench (vs 65.93%).

**Why it matters:** Most multi-agent frameworks use the same model for all agents (just with different system prompts). Team of Thoughts shows that using heterogeneous models — each chosen for actual capability differences — gives massive gains. This validates MCO's approach (coordinate Claude + Codex + Gemini) over Edict's approach (same model in different roles).

---

## Discovery 9: [NEW] Enterprise Voice Agents Tutorial (2603.05413) — The Agent Interface Evolving

**Source:** arXiv:2603.05413 (Mar 5, 2026 — Jielin Qiu et al.)

**What it is:** Complete technical tutorial for building realtime voice agents from scratch. Key findings:
- Native speech-to-speech models (Qwen2.5-Omni) are **too slow** for realtime (~13s time-to-first-audio)
- Industry standard: cascaded streaming pipeline STT → LLM → TTS
- The key to "realtime" is **streaming and pipelining**, not any single fast model
- Achieved 947ms P50 time-to-first-audio (729ms best case)

**Why it matters for agent frameworks:** Voice is the next interface layer for agents. This paper shows the architecture: you don't need a speech-to-speech model — you need streaming orchestration of specialized components. This is the same pattern as multi-agent coordination: specialized components, streaming pipelines, orchestration layer.

---

## Discovery 10: [NEW] The "OpenClaw" Ecosystem — A Cambrian Explosion

Multiple repos reference "OpenClaw" as a foundational agent runtime (appears to be an open-source Claude Code-like system):

| Repo | Stars | What |
|------|-------|------|
| Star-Office-UI | 3,075 | Pixel art office UI for monitoring OpenClaw agents |
| openclaw-agents | 179 | One-command multi-agent setup, 9 specialized agents |
| openclaw-office | 149 | Visual monitoring/management frontend |
| openclaw-backup | 675 | One-click backup/restore for instances |
| awesome-openclaw-usecases-zh | 936 | 40+ Chinese use cases |
| claude-forge | 426 | Plugin framework with 11 agents, 36 commands, 15 skills |
| goclaw | 520 | Go-based multi-agent gateway |
| ai-jail | 81 | Multi-OS sandbox for running agents safely |
| claw0 | 417 | Build an agent from scratch tutorial |
| GoGogot | 390 | Lightweight Go alternative |

**Why it matters:** This is an entire ecosystem forming around a single agent runtime — the same way npm/pip ecosystems formed around Node/Python. The tooling is diversifying into: monitoring (Star-Office-UI, openclaw-office), multi-agent (openclaw-agents, goclaw), security (ai-jail), education (claw0), and plugin architecture (claude-forge). This is the infrastructure layer for the "agent as primary developer" paradigm.

---

## Meta-Patterns (Updated)

### Pattern 1: Agent-as-Researcher (NEW)
Karpathy's autoresearch represents a qualitative shift: the agent isn't assisting research — it IS the researcher. The feedback loop (modify → train → evaluate → commit → repeat) is fully autonomous. This will expand to other domains (drug discovery, materials science, chip design).

### Pattern 2: Coordination is the Bottleneck (STRENGTHENED)
MCO, Edict, agentchattr, Loomkin, auto-co — five independent teams all building multi-agent coordination in the same week. The problem is clearly felt. Solutions are stratifying into protocol/institutional/communication layers.

### Pattern 3: Agent Skills as Universal Package Format (STRENGTHENED)
Binance Skills Hub confirms the SKILL.md format (YAML frontmatter + markdown) is becoming the universal standard. Now seen in: Google Workspace CLI, Binance, HuggingFace, Claude Code, Codex, Gemini CLI, OpenClaw, Cursor. This is the "package.json moment" for agent capabilities.

### Pattern 4: Safety is Bifurcating (NEW)
Training-time safety (MOSAIC, ASTER, TopoCurate) and runtime safety (Overthinking Loops, agent sandboxes) are developing as separate research programs. The integration point is missing.

### Pattern 5: The Chinese AI Agent Ecosystem (NEW)
A massive, largely Chinese-language ecosystem is developing around OpenClaw/agent frameworks. Edict (5k⭐), Agent-Reach (6.7k⭐), Star-Office-UI (3k⭐) — these are getting thousands of stars from a community that's building production agent tooling at high velocity. The design philosophies are different (Edict's imperial bureaucracy metaphor, Agent-Reach's "tell your agent to install itself" pattern).
