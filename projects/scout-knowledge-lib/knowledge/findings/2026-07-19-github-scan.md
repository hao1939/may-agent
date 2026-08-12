# GitHub Scan — 2026-07-19

Source: GitHub Search API (trending repos, recently created)
Date: 2026-07-19
last_updated: 2026-07-19 (overnight update)

## Key Signals

### Agent Memory & Context Persistence is a Major Category
- **claude-mem** (thedotmack/claude-mem) — 87.8k⭐, created 2025-08-31. "Persistent Context Across Sessions for Every Agent." Works with Claude Code, Codex, Gemini, Hermes, Copilot, OpenCode. Actively pushed (2026-07-19).
- **brain0** (Brain0-ai/brain0) — 461⭐, created 2026-07-02. "The black box for AI-written code." Passive decision graph linking commits to agent prompts, drift detection, DLP audit, MCP memory, signed provenance. Rust-based, offline-first.
- **Pattern**: Agent memory/context is fragmenting into two niches: (1) cross-session recall for developer productivity, and (2) audit/provenance trails for compliance. Both are growing fast.
- Sources: https://github.com/thedotmack/claude-mem, https://github.com/Brain0-ai/brain0

### Agent Orchestration Proliferation
Multiple new orchestration frameworks emerged in late June / early July 2026:
- **homerail** — 630⭐, voice-first local agent orchestration with auditable DAG workflows.
- **VisionForge-OU/foreman** — 253⭐, Boris-style TUI that supervises headless Claude Code agents through a gated delivery pipeline.
- **gridbash** — 137⭐, cross-platform terminal grid for running multiple CLI agents side by side.
- **ringer** — 147⭐, parallel AI-agent swarm orchestrator with mission-control HUD.
- **Pattern**: Orchestration is moving from "framework" to "operations layer." Projects increasingly assume you have multiple agents and focus on supervision, gating, and parallel execution rather than single-agent tool-use.
- Sources: https://github.com/xiaotianfotos/homerail, https://github.com/VisionForge-OU/foreman, https://github.com/jasonsuhari/gridbash

### ponytail: "Laziest Senior Dev" Anti-Pattern Framework — 85.8k⭐
- DietrichGebert/ponytail, created 2026-06-12. "Makes your AI agent think like the laziest senior dev in the room. The best code is the code you never wrote."
- Explosive growth (85k⭐ in ~5 weeks) suggests strong demand for agent strategies that minimize code generation rather than maximize it.
- **Pattern**: Counter-trend to "agents write everything" — agents that strategically avoid writing code are resonating. Aligns with growing concern about AI slop (see also yetone/kill-ai-slop, 633⭐).
- Source: https://github.com/DietrichGebert/ponytail

### obra/superpowers Dominates Agent Skills — 257k⭐
- The "agentic skills framework & software development methodology" remains the top-starred agent repo by a wide margin. Created 2025-10-09, last pushed 2026-07-17.
- NousResearch/hermes-agent at 217k⭐ is the second-largest — "The agent that grows with you."
- Source: https://github.com/obra/superpowers

### Security-Focused Agent Tools Emerging
- **T3MP3ST** (elder-plinius/T3MP3ST) — 4,965⭐, created 2026-07-02. Autonomous red teaming platform; multi-agent offensive-security meta-harness.
- **VulnHunter** (capitalone/VulnHunter) — 500⭐, created 2026-07-07. Agentic AI security tool applying proactive attacker-first analysis to source code. Notable: from Capital One (enterprise adoption signal).
- **Pattern**: Agent security is bifurcating into offensive (red team automation) and defensive (code scanning) applications. Enterprise players entering the space.
- Sources: https://github.com/elder-plinius/T3MP3ST, https://github.com/capitalone/VulnHunter

### AI Science Workbenches
- **synthetic-sciences/openscience** — 2,587⭐, and **ai4s-research/open-science** — 830⭐ (both created 2026-07-03). Open-source AI research workbenches positioning as alternatives to Claude Science desktop.
- Source: https://github.com/synthetic-sciences/openscience

### xAI Enters Coding Agent Space — grok-build 19.6k⭐ in 5 Days
- **xai-org/grok-build** — 19,660⭐, created 2026-07-14. "SpaceXAI's coding agent harness and TUI. Fullscreen, mouse interactive, extensible."
- Explosive adoption (fastest-growing new agent repo this week). Signals xAI making a serious play in the agentic coding market alongside Anthropic (Claude Code), OpenAI (Codex), and Google (Gemini CLI).
- **Pattern**: Every major foundation-model provider now ships a first-party coding agent harness. The agent runtime is becoming the default interface to foundation models, displacing chat.
- Source: https://github.com/xai-org/grok-build

### Agent Session Memory — Consolidation Wave
Multiple new projects target persistent memory across coding agent sessions:
- **deja-vu** (vshulcz/deja-vu) — 367⭐, created 2026-07-14. Memory layer over session logs; supports Claude Code, Codex, opencode, Gemini CLI, Grok Build, and more. Zero-dep binary with secret redaction.
- **paxm** (pax-beehive/paxm) — 208⭐, created 2026-07-09. Provider-neutral persistent memory for multiple coding agents + MCP.
- **memmy-agent** (MemTensor/memmy-agent) — 46⭐, created 2026-07-16. "One Agent. One memory. Shared by every AI."
- **emulo** (ohad6k/emulo) — 194⭐, created 2026-07-08. Mines Claude Code/Codex logs into a local agent profile (you.md).
- **Pattern**: Memory is fragmenting into sub-categories: (a) cross-session recall, (b) cross-agent shared memory, (c) agent-profile mining. The "portable agent memory" problem is attracting significant OSS investment.
- Sources: https://github.com/vshulcz/deja-vu, https://github.com/pax-beehive/paxm, https://github.com/ohad6k/emulo

### Agent Sandboxing & Visualization Tools
- **clawk** (clawkwork/clawk) — 724⭐, created 2026-07-06. "Give coding agents a disposable Linux VM, not your laptop." Sandboxing as a first-class concern.
- **mindwalk** (cosmtrek/mindwalk) — 817⭐, created 2026-07-09. 3D visualization replaying coding-agent sessions on a codebase map. Observability moving from logs to spatial navigation.
- **Pattern**: As agents get more autonomous, the ecosystem is building safety (sandboxing) and understanding (visualization) infrastructure around them.
- Sources: https://github.com/clawkwork/clawk, https://github.com/cosmtrek/mindwalk

### Agent Security Training Infrastructure
- **LLMVault** (CyberSunil/LLMVault) — 191⭐, created 2026-07-15. Intentionally vulnerable OWASP LLM Top 10 training platform covering prompt injection, RAG security, agent security, and GenAI pentesting.
- Complements T3MP3ST (offensive) and VulnHunter (defensive) — now there's a training/education layer too.
- **Pattern**: Agent security is maturing from tools to a full ecosystem: offensive (T3MP3ST), defensive (VulnHunter), and educational (LLMVault).
- Source: https://github.com/CyberSunil/LLMVault

### Model-Agnostic Agent Harnesses Proliferating
- **agentsmith** (PromptPartner/agentsmith) — 308⭐, created 2026-07-16. "Universal, model-agnostic operating harness" with work-type profiles. One setup script.
- **klaatcode** (KlaatAI/klaatcode) — 139⭐, created 2026-07-17. Terminal coding agent with smart model routing — uses different models per task to cut costs 10x.
- **bbarit-agent-oss** — 35⭐, created 2026-07-16. Single Rust binary, 15+ providers, 1000+ models. Self-hostable alternative.
- **Pattern**: "Model-agnostic" and "smart routing" are emerging as key differentiators for independent agent harnesses competing against vendor-locked first-party tools.
- Sources: https://github.com/PromptPartner/agentsmith, https://github.com/KlaatAI/klaatcode

### Edge Agent: routerclaw — Agent on 32MB RAM Router
- **routerclaw** (root643/routerclaw) — 47⭐, created 2026-07-13. Autonomous AI agent in Go running on obsolete OpenWrt routers (32MB RAM). Smart home orchestrator with WoL, Telegram, Google Workspace.
- **Pattern**: Agents pushing to extreme edge — not just mobile/laptop but embedded/IoT hardware. Constraint-driven agent design.
- Source: https://github.com/root643/routerclaw

---

## Evening Update — New Signals (07-19)

### "Harness Engineering" Emerges as Named Discipline — 376⭐ in <24h
- **lopopolo/harness-engineering** — 376⭐, created 2026-07-18. Ryan Lopopolo's anthology and field guide for "harness engineering": improving agent output by shaping context and tools rather than the model. Frames nonfunctional requirements (security, reliability, maintainability) as recoverable agent context. Includes AGENTS.md routing pattern.
- **Pattern**: The practice of configuring the environment around a coding agent is crystallizing into a named discipline with its own literature. "Harness engineering" joins "prompt engineering" and "agent engineering" as a distinct skill. The repo's fast traction (376⭐ overnight) suggests latent demand for this framing.
- Source: https://github.com/lopopolo/harness-engineering

### Folder-as-Architecture: ICM Workspace Design — 104⭐
- **RinDig/icm-architect** — 104⭐, created 2026-07-18. Claude skill that designs any process/idea into an ICM workspace where folder structure *is* agent architecture.
- **Pattern**: "Repository as agent interface" thinking spreading — folder layout, file naming, and directory structure treated as first-class agent context, not just human organization. Resonates with harness-engineering thesis.
- Source: https://github.com/RinDig/icm-architect

### Agent QA & Safety Tooling — Early but Growing
- **sxnnywu/reeled-in** — 16⭐, created 2026-07-18. "QA for continuous agents" — testing framework for long-running agent loops.
- **VinayJogani14/tracewall** — 4⭐, created 2026-07-17. "Flight recorder and firewall for AI agents" — records every tool call, tracks lethal-trifecta taint (prompt injection → tool misuse → exfiltration), blocks the exfiltration path. Zero deps, cross-harness.
- **confirm-ai/confirm-sdk** — 2⭐, created 2026-07-17. Human-in-the-loop approvals: `guard()` gates risky tool calls with fail-closed policies.
- **Pattern**: Agent safety tooling fragmenting into sub-layers: runtime firewalls (tracewall), QA/testing (reeled-in), and approval gates (confirm-sdk). All small but signal maturing safety thinking beyond "just sandbox it."
- Sources: https://github.com/sxnnywu/reeled-in, https://github.com/VinayJogani14/tracewall, https://github.com/confirm-ai/confirm-sdk

### Star Updates for Tracked Repos
- **xai-org/grok-build**: 19,681⭐ (steady growth)
- **thedotmack/claude-mem**: 87,797⭐ (still climbing)
- **DietrichGebert/ponytail**: 85,816⭐ (plateau)

---

## Late Evening Update — New Signals (07-19)

### Agent Skills Expanding Beyond Coding
Multiple new "agent skills" repos target non-coding domains:
- **CodeDrobe/skills** — 201⭐, created 2026-07-15. Agent skills for theming AI desktop apps: reference image → reversible skin → verify, repair, publish. Works with Codex/WorkBuddy.
- **JimLiu/baocut** — 225⭐, created 2026-07-13. Agent skill driving BaoCut macOS CLI (transcribe, subtitle, translate, cut) from Claude Code or Codex.
- **rollingSirius/equity-research-skill** — 134⭐, created 2026-07-14. Institutional-grade equity research report skill (9-chapter structure + multi-method valuation).
- **ogulcancelik/agent-skills** — 47⭐, created 2026-07-16. Small, opinionated, agent-agnostic skill library.
- **smixs/mentor** — 27⭐, created 2026-07-19. Session-insights skill that reads Claude Code/Codex history and generates an HTML report on work patterns.
- **Pattern**: "Agent skills" are becoming the plugin/extension model for coding agents, analogous to IDE extensions. The scope is expanding from pure coding into media editing, design, finance, and developer self-reflection. obra/superpowers (257k⭐) established the pattern; now domain-specific skills are proliferating.
- Sources: https://github.com/CodeDrobe/skills, https://github.com/JimLiu/baocut, https://github.com/rollingSirius/equity-research-skill

### Finance/Trading Agents — Distinct Vertical Forming
- **PengZhang64/circuit-framework** — 484⭐, created 2026-07-16. Multi-agent LLM trading research system.
- **agutinbaigo28/financial-agent-api** — 129⭐, created 2026-07-14. Multi-agent framework for financial intelligence with RAG, observability, and governance.
- **pueschel88/Tradingview-MCP** — 133⭐, created 2026-07-13. MCP server controlling TradingView Desktop from Claude Code via Chrome DevTools Protocol.
- **marketcaper/mcp** — 80⭐, created 2026-07-14. Finance data and heatmap MCP server for agents.
- **Pattern**: Finance is becoming the first non-coding vertical with significant agent infrastructure. Multiple independent projects building trading research, execution, and data-access layers specifically for AI agents.
- Sources: https://github.com/PengZhang64/circuit-framework, https://github.com/pueschel88/Tradingview-MCP

### MCP Security Scanner — mcptrustchecker
- **illiahaidar/mcptrustchecker** — 65⭐, created 2026-07-13. Offline, deterministic A–F Trust Score for MCP servers. Detects tool poisoning, prompt injection, and toxic flows.
- **Pattern**: MCP ecosystem maturing enough to need security vetting tools. Trust-scoring MCP servers before connecting them to agents parallels package-manager security scanning.
- Source: https://github.com/illiahaidar/mcptrustchecker

### Agentic Code Review — codesteward
- **Codesteward/codesteward** — 61⭐, created 2026-07-14. Agentic code review with structural graph intelligence — PR gating + branch stewardship. Self-hosted, Apache-2.0.
- **Pattern**: Code review joining code generation as an agent-automated workflow. Structural/graph analysis (not just LLM chat) as differentiator.
- Source: https://github.com/Codesteward/codesteward

### Physical Agent Dashboard — clawdmeter-plus
- **sorryhumans/clawdmeter-plus** — 83⭐, created 2026-07-15. Round AMOLED desk display showing live Claude Code usage, weather, background-agent health, and daily voice greeting. ESP32-S3 + macOS BLE daemon.
- **Pattern**: Agents getting physical peripherals. The "always-on agent" needs ambient awareness interfaces beyond terminal output.
- Source: https://github.com/sorryhumans/clawdmeter-plus

### Context Optimization for Agents — fastctx
- **yc-duan/fastctx** — 45⭐, created 2026-07-17. Fast, context-efficient repository tools for AI agents via MCP. Focuses on minimizing token usage when feeding repo context to agents.
- **Pattern**: Context efficiency becoming a first-class concern — not just "give the agent the whole repo" but intelligent context selection to reduce cost and improve accuracy. Aligns with harness-engineering thesis.
- Source: https://github.com/yc-duan/fastctx

### Agent Skills Expanding to Video Production
- **joeseesun/qiaomu-cut-skill** — 86⭐, created 2026-07-18. Agent-native video director skill: governed source footage, bilingual subtitles, brand packaging, verifiable rendering via ffmpeg. Works with Claude Code and similar agent harnesses.
- **Pattern**: Agent skills moving beyond code-adjacent tasks (theming, media editing) into full creative production pipelines. Video directing joins transcription (baocut) and design (open-design) as agent-automated creative workflows.
- Source: https://github.com/joeseesun/qiaomu-cut-skill

### System Prompt Portability — claude-fable-5
- **KinetiNode/claude-fable-5-system-prompt-clean** — 66⭐, created 2026-07-19. Token-optimized, cleaned version of a leaked Claude system prompt, re-engineered for cross-model execution (Gemini 3.1 Pro, ChatGPT 5.6, etc.).
- **Pattern**: System prompts being treated as portable, optimizable artifacts separate from any single model. "Prompt compilation" — distilling effective behaviors into lean, model-agnostic instruction sets.
- Source: https://github.com/KinetiNode/claude-fable-5-system-prompt-clean

### Design Award Research as Agent Skill
- **SeanJ1ang/design-judge-skills** — 64⭐, created 2026-07-18. Evidence-driven agent skills for design award research, evaluation, award matching, entry writing, and submission readiness.
- **Pattern**: Highly specialized professional workflows (award submissions, compliance docs, equity research) being packaged as agent skills. The "long tail" of agent capabilities is forming through niche skills rather than monolithic agents.
- Source: https://github.com/SeanJ1ang/design-judge-skills

### Social/News Briefing as Agent Skill
- **kunchenguid/whathappened** — 183⭐, created 2026-07-16. Agent skill delivering adaptive X-only briefings: what happened + public opinion + debates. Designed for Claude Code/Codex/skills-capable agents.
- **Pattern**: Information-consumption workflows (news briefing, social monitoring) being packaged as agent skills — agents as personal intelligence analysts, not just code writers.
- Source: https://github.com/kunchenguid/whathappened

### Star Velocity Update (07-19 late)
- **grok-build** — 19,697⭐ (up from 19,685⭐). xAI's coding agent harness still accumulating ~12⭐/hr.
- **harness-engineering** — 390⭐ (up from 385⭐). "Harness engineering" as a named discipline continuing steady growth.
- **deja-vu** — 369⭐ (up from 368⭐). Memory layer for coding agents remains active.
- **agentsmith** — 308⭐. Universal agent harness holding steady.

---

## 07-19 Morning Update (generation 22)

### Star Velocity Check
- **grok-build** — 19,708⭐ (steady ~10⭐/hr overnight). Now 5 days old with nearly 20k⭐.
- **ponytail** — 85,839⭐ (still growing, not plateaued as suspected).
- **claude-mem** — 87,801⭐ (marginal growth).
- **harness-engineering** — 392⭐ (slowing from initial burst).
- **deja-vu** — 370⭐ (steady).

### Agent-Maintained Documentation — openab-map (33⭐)
- **shaun-agent/openab-map** — 33⭐, created 2026-07-18. "Agent-maintained human understanding layer for openab — structured mental map for deployers and contributors."
- **Pattern**: Agents not just writing code but maintaining living documentation and knowledge maps for OSS projects. The agent becomes a project contributor responsible for keeping docs current — a new agent role beyond coding.
- Source: https://github.com/shaun-agent/openab-map

### Agent Skills Explosion Accelerating
On 07-19 alone, 10+ new agent skill repos appeared (graphkit, agent-review-skills, pdf2md-agent-skill, interview-soul-editor, agent-os-skill, etc.) — all small (<5⭐) but the sheer volume signals the skills ecosystem is entering a Cambrian explosion phase. Notable sub-trends:
- **Agent-on-agent workflows**: claude-subagent-mcp (4⭐) delegates from Codex to Claude Code; parallax (2⭐) uses a blackboard MCP for coordinating parallel subagents; levi-qiao/graphkit (3⭐) builds supervisor graphs.
- **Anti-slop skills**: iCodeCraft/anti-slop (7⭐) packages kill-slop + security-review + PR hygiene as drop-in skills. Quality gates moving from harness config into portable skill packages.
- **Cross-device agent coordination**: Phone2Claude (2⭐) bridges phone ↔ PC agents over USB/adb — agents spanning physical devices.
- **Pattern**: The agent skills ecosystem is fragmenting faster than any single curator can track. The "app store" moment for agent skills is approaching — discovery and trust-scoring will become bottlenecks.

---

## 07-19 Afternoon Update (generation 22b)

### Star Velocity Check
- **grok-build** — 19,710⭐ (slowing to ~2⭐/hr, down from ~10⭐/hr overnight; initial burst fading at day 5).
- **ponytail** — 85,841⭐ (still growing slowly; not plateaued).
- **claude-mem** — 87,801⭐ (effectively flat).
- **harness-engineering** — 393⭐ (plateau after initial burst; settling into steady state).
- **deja-vu** — 370⭐ (flat).

### Model-Specific Agent Tooling — qwen-native-agents (27⭐)
- **vakovalskii/qwen-native-agents** — 27⭐, created 2026-07-17. "Build & prompt Qwen3.x agents in their native dialect — extracted from qwen-code & Qwen-Agent."
- **Pattern**: Counter-trend to model-agnostic harnesses: extracting model-specific agent patterns for optimal performance. As models diverge in agentic capabilities (tool-call formats, system prompt styles), model-native tooling may outperform universal abstractions.
- Source: https://github.com/vakovalskii/qwen-native-agents

### "Agent as App Resident" — Embinder (19⭐)
- **celesnity/Embinder** — 19⭐, created 2026-07-18. "Turn every traditional platform into an AI-native platform." Makes the agent a resident of the app rather than a separate tool.
- **Pattern**: Shift from "agent as external tool" to "agent embedded in existing applications." Rather than building new agent-first apps, retrofit agents into existing platforms. Echoes browser-extension model.
- Source: https://github.com/celesnity/Embinder

### Agent Claim Verification — world-model-oaktree (3⭐)
- **lysol321/world-model-oaktree** — 3⭐, created 2026-07-18. "Make your coding agent's claims machine-checkable — executable world model + history backtest + predict-before-act ledger."
- Small but conceptually notable: agents must predict outcomes before acting, then verify predictions against reality. Moves beyond sandboxing (prevent harm) toward epistemic accountability (verify claims).
- Source: https://github.com/lysol321/world-model-oaktree

### Isolated Eval Sandboxes for Self-Improving Agents — Crucible (4⭐)
- **jeffreyzhou-harvard/Crucible_AgentEnvironment** — 4⭐, created 2026-07-18. "Isolated, reproducible sandboxes where self-improving agents run untrusted code and can't game the score." Harvard-affiliated.
- **Pattern**: Research infrastructure for safe self-improvement evaluation. The "self-improving agent" research agenda is generating its own tooling layer.
- Source: https://github.com/jeffreyzhou-harvard/Crucible_AgentEnvironment

### Skills Volume Still Accelerating
New skill repos since morning: sentence-to-site (4⭐, "one sentence → verified website"), fullstack-forge-skill (4⭐, comprehensive full-stack engineering skill suite), community-webtoon-agent-kit (3⭐, Korean webtoon production). The long tail continues to lengthen — domain-specific agent skills now covering web development, comic production, video directing, finance, and design awards.

---

## Overnight Update (2026-07-19)

### Star Velocity Check
- **ponytail** — 85,842⭐ (stable, still growing steadily)
- **claude-mem** — 87,802⭐ (continuing climb)
- **superpowers** — 257,363⭐ (dominant position unchanged)
- **grok-build** — 19,712⭐ (growth effectively stalled at ~2⭐/hr; initial hype cycle complete)
- **harness-engineering** — 396⭐ (slow but steady; concept resonating with practitioners)

### Multi-Model Agent Routing Solidifying
- **kimi-first** (boringmarketer/kimi-first) — 27⭐, created 2026-07-16. "Claude Code skill: Kimi types, Claude thinks & verifies — route implementation work-orders to the Kimi Code CLI (k3)." Port of codex-first pattern to Kimi K3.
- **Pattern**: Inter-agent delegation becoming practical. Rather than picking one model, skills let agents delegate sub-tasks to specialized models. The "kimi-first" pattern (cheap model drafts, frontier model verifies) is a cost-optimization strategy that only works when multiple agents can coordinate.
- Source: https://github.com/boringmarketer/kimi-first

### Browser Control via MCP — PilotBrowseMCP (20⭐)
- **EndymionLee/PilotBrowseMCP** — 20⭐, created 2026-07-18. "A browser runtime that lets AI agents control your real Chrome browser via MCP. Agents can explore websites, generate operation manuals, and reuse them."
- Notable: generates reusable "operation manuals" from browsing sessions — agents teaching themselves repeatable browser workflows.
- Source: https://github.com/EndymionLee/PilotBrowseMCP

### Design System Knowledge as MCP — hig-mcp (22⭐)
- **aka-kika/hig-mcp** — 22⭐, created 2026-07-17. "MCP server serving Apple Human Interface Guidelines as structured design tokens for AI coding agents — post-WWDC25 system colors, Liquid Glass constraints."
- **Pattern**: Domain knowledge packaged as MCP servers. Not tools or actions — pure reference knowledge served through the tool protocol. Turns design systems into queryable agent context.
- Source: https://github.com/aka-kika/hig-mcp

### Shared Agent Memory — memmy-agent (47⭐)
- **MemTensor/memmy-agent** — 47⭐, created 2026-07-16. "One Agent. One memory. Shared by every AI."
- Extends the memory theme: rather than per-model memory (claude-mem), a single memory layer shared across all AI providers. Cross-model memory portability as the differentiator.
- Source: https://github.com/MemTensor/memmy-agent

### Emerging Pattern: MCP Context Efficiency
- **fastctx** (yc-duan/fastctx) — 47⭐, created 2026-07-17. "Fast, context-efficient repository tools for AI agents (MCP)." Optimizing how much context MCP tools inject into agent prompts.
- **Pattern**: As MCP adoption grows, context window pressure from tool responses becomes a bottleneck. "Context-efficient" tools that minimize token overhead are a new optimization frontier.

---

## 07-19 Final Velocity Update (generation 30)

### Star Velocity Check
| Repo | Stars | Δ vs gen-29 | Trend |
|------|-------|-------------|-------|
| lopopolo/harness-engineering | 540⭐ | +11 | Confirmed breakout; steady climb |
| xai-org/grok-build | 19,949⭐ | +20 | 20k⭐ imminent (within hours) |
| KinetiNode/claude-fable-5-system-prompt-clean | 130⭐ | +4 | Steady |
| NullLabTests/software-periodic-table | 17⭐ | +3 | Still doubling |

### New Signal

#### Pi Coding Agent Web Console — pi-manager (32⭐)
- **scp3500/pi-manager** — 32⭐, created 2026-07-18. "Local web console for Pi Coding Agent — models, agents, sessions, usage, OpenVL."
- **Pattern**: Each foundation-model coding agent (Pi, Grok Build, Claude Code, Codex) spawning dedicated management/observability tooling. The "agent admin panel" is becoming a standard companion artifact.
- Source: https://github.com/scp3500/pi-manager

#### Private Markets Agent Swarm — sturna (2⭐)
- **tylerbroqs/sturna** — 2⭐, created 2026-07-19. "Autonomous private-markets desk. Six AI agents source, score, construct and rebalance tokenized pre-IPO & real-world assets — settling on Robinhood Chain, routing through Robinhood agentic trading MCP."
- **Pattern**: Finance vertical deepening — from research/analysis tools to full autonomous trading desks. Multi-agent swarms handling the complete investment lifecycle. Notably builds on Robinhood's official MCP server.
- Source: https://github.com/tylerbroqs/sturna

### End-of-Day Summary (generation 30)
Key takeaways from the full day of GitHub monitoring:
1. **"Harness engineering" is the concept of the day** — 376→540⭐ with 12+ derivative repos in <48h
2. **grok-build about to hit 20k⭐** — xAI's coding agent confirmed as durable entrant, not flash-in-the-pan
3. **Skills Cambrian explosion**: 20+ new skill repos spanning coding, video, finance, academia, design, social briefing
4. **MCP won**: universal agent interop protocol; every new tool/domain/agent gets wrapped
5. **Multi-agent coordination** is the active frontier (relay, delegation, review, swarm workflows)
6. **Agent admin/observability tooling** forming as a category (pi-manager, mindwalk, Agentvis)

---

## Velocity Update — 2026-07-19 (gen-22 evening refresh)

### Star Velocity Check
| Repo | Stars | Trend |
|------|-------|-------|
| obra/superpowers | 257,364⭐ | Dominant, still growing |
| thedotmack/claude-mem | 87,803⭐ | Steady growth |
| DietrichGebert/ponytail | 85,847⭐ | Steady growth |
| xai-org/grok-build | 19,712⭐ | Stalled (~0⭐/hr) |
| lopopolo/harness-engineering | 399⭐ | Slow climb (+14 since last check) |

### New Signals

#### Agent Quality & Anti-Slop Skills Emerging
- **iCodeCraft/anti-slop** — 7⭐, created 2026-07-18. "Drop-in skills that stop AI coding agents from shipping garbage — kill-slop, security-review, PR hygiene."
- Complements ponytail's "lazy senior dev" philosophy. A new counter-trend forming: skills that constrain agent output quality rather than expand capabilities.
- See also: anthropics/claude-plugins-official (32.3k⭐) — Anthropic now curates a "high quality" plugin directory, institutionalizing quality gatekeeping.

#### Agent Self-Reflection — mentor (28⭐)
- **smixs/mentor** — 28⭐, created 2026-07-19. Session-insights skill that reads Claude Code and Codex history to generate reports on developer patterns, time sinks, and improvement suggestions.
- **Pattern**: Agents analyzing their own (and their user's) past sessions. Meta-cognitive agent skills — agents that improve the human-agent collaboration loop, not just the code.

#### Embinder — Agents as App Residents (19⭐)
- **celesnity/Embinder** — 19⭐, created 2026-07-18. "Turn every traditional platform to AI-native platform." Makes the agent a resident of the app rather than an external tool.
- **Pattern**: Agent embedding shifting from "agent calls tools" to "agent lives inside the application." Inversion of the typical agent-tool relationship.

#### Self-Healing API Factory (6⭐)
- **indranildchandra/self-healing-api-factory** — 6⭐, created 2026-07-18. "Autonomous API factory using Postman CLI, SQLite MCP & SOFA to eliminate agentic token-wasting loops via self-healing local knowledge graphs."
- Notable framing: explicitly targets "token-wasting loops" — agents spinning on API integration. Local knowledge graphs as loop-breakers.

#### Agent Sandbox for Self-Improvement (4⭐)
- **jeffreyzhou-harvard/Crucible_AgentEnvironment** — 4⭐, created 2026-07-18. "Isolated, reproducible sandboxes where self-improving agents run untrusted code and can't game the score."
- Harvard-affiliated. Addresses the alignment problem of self-improving agents: how to evaluate agents that modify their own evaluation environment.

#### Kimi Code Desktop Client — Farside (4⭐)
- **dandandujie/Farside** — 4⭐, created 2026-07-18. Desktop agent client specifically for Kimi Code.
- Confirms Kimi ecosystem tooling is forming alongside the model release (Kimi K3). Model launches now spawn immediate third-party agent harness development.

#### Graph-Based Agent Supervision — graphkit (3⭐)
- **levi-qiao/graphkit** — 3⭐, created 2026-07-19. "A graph of agent nodes, not a drifting loop." Executor node + clean-context supervisor that watches from outside and corrects drift.
- **Pattern**: Drift correction becoming an explicit design goal. Supervisors with independent context windows to avoid contamination from the supervised agent's accumulated context.

### Emerging Themes (gen-22 synthesis)
1. **Quality over quantity**: anti-slop, ponytail, mentor — a clear counter-movement to "agents write everything"
2. **grok-build plateau**: Initial viral burst (19.7k⭐) has completely stalled; may indicate "launch tourism" rather than sustained adoption
3. **Skills ecosystem maturing**: Skills now span coding, quality assurance, self-reflection, creative production, finance — the plugin model for agents is real
4. **Agent embedding**: From external tool to app-resident (Embinder) — early signal of a paradigm shift

---

## 07-19 Late Day Update (generation 23)

### Star Velocity Check
| Repo | Stars | Δ vs last check | Trend |
|------|-------|-----------------|-------|
| obra/superpowers | 257,365⭐ | +1 | Dominant, flat |
| thedotmack/claude-mem | 87,804⭐ | +1 | Effectively flat |
| DietrichGebert/ponytail | 85,848⭐ | +1 | Slow but persistent |
| xai-org/grok-build | 19,717⭐ | +5 | Stalled; hype cycle over |
| lopopolo/harness-engineering | 400⭐ | +1 | Steady trickle |
| vshulcz/deja-vu | 370⭐ | 0 | Flat |

**Assessment**: No breakout growth on any tracked repo since last check. The GitHub agent ecosystem is in a consolidation phase — the major players (superpowers, claude-mem, ponytail) hold their positions while grok-build's launch burst has fully dissipated.

### New Signals

#### System Prompt Customization Toolkit — claude-code-custom-prompt (8⭐)
- **rossignol6712/claude-code-custom-prompt** — 8⭐, created 2026-07-19. "Replace Claude Code's default system prompt & compact templates with your own — a complete guide and toolkit."
- **Pattern**: Extends the "prompt as portable artifact" trend (see claude-fable-5). Users are not just optimizing prompts but replacing agent harness system prompts entirely. Agent harnesses becoming configurable shells.
- Source: https://github.com/rossignol6712/claude-code-custom-prompt

#### Google Jules Exposed as MCP — jules-mcp-server (1⭐)
- **Rahul7562/jules-mcp-server** — 1⭐, created 2026-07-19. Pure-stdlib Python MCP server wrapping Google Jules v1alpha REST API as 10 MCP tools. Includes orchestrator skill for agent-driven dev loops.
- **Pattern**: Every new coding agent immediately gets wrapped as an MCP server, enabling cross-agent delegation. MCP becoming the universal agent interop protocol — agents consuming other agents as tools.
- Source: https://github.com/Rahul7562/jules-mcp-server

#### MCP Server Generation from Specs — prompt-to-mcp (1⭐)
- **KnaniOussama/prompt-to-mcp** — 1⭐, created 2026-07-19. "Describe the MCP server you want. Point at an OpenAPI spec. Get a small, curated FastMCP server as editable code."
- **Pattern**: Meta-tooling — agents/tools that generate MCP servers from descriptions. The MCP ecosystem is building its own bootstrapping infrastructure.
- Source: https://github.com/KnaniOussama/prompt-to-mcp

#### Android Reverse Engineering via MCP — SOMCP (9⭐)
- **bilieebiliee1-design/SOMCP** — 9⭐, created 2026-07-19. Android-native SO (shared object) reverse engineering MCP server.
- **Pattern**: Security/reverse-engineering tools surfacing through MCP. Niche professional workflows (binary analysis) becoming agent-accessible.
- Source: https://github.com/bilieebiliee1-design/SOMCP

#### Agent Code Review Skills — agent-review-skills (2⭐)
- **lmammino/agent-review-skills** — 2⭐, created 2026-07-19. By Luciano Mammino (known Node.js author). Skills for agents to review open PRs and have the coding agent address gathered comments.
- **Pattern**: Code review as a two-agent workflow: reviewer agent identifies issues, coding agent fixes them. Multi-agent PR workflows moving from concept to packaged skills.
- Source: https://github.com/lmammino/agent-review-skills

#### Inter-Agent Relay — relay-between-agents (2⭐)
- **Gwendolenmave/relay-between-agents** — 2⭐, created 2026-07-19. "A safe, auditable relay between planning AIs and coding agents — without repetitive copy-pasting."
- **Pattern**: The planning↔execution boundary between agents is becoming explicit infrastructure. Rather than one agent doing both, separate planning and execution agents communicate through structured relays.
- Source: https://github.com/Gwendolenmave/relay-between-agents

#### Cache-Aware Agent Infrastructure — cache-hunter (31⭐)
- **co-l/cache-hunter** — 31⭐, created 2026-07-18. LLM proxy specialized in analyzing harness traffic to catch cache invalidation bugs.
- **Pattern**: Agent-specific proxy/middleware layer growing — tools that sit between agents and APIs to optimize, audit, or debug traffic.
- Source: https://github.com/co-l/cache-hunter

### Consolidation Pattern (gen-23 end-of-day synthesis)
Today's new repos are almost entirely small (<10⭐), infrastructure/glue projects. No new breakout repos emerged. Final velocity check (API-confirmed):
- harness-engineering: 407⭐ (up from 376 at discovery, steady growth)
- grok-build: stalled at ~19.7k⭐
- All other tracked repos flat

This suggests:
1. **The skills Cambrian explosion continues** but individual projects stay small — the market is highly fragmented
2. **MCP as universal glue** is solidifying — new agents, APIs, and domains all get MCP wrappers immediately
3. **Multi-agent coordination** is the current frontier — relay, delegation, review workflows all involve 2+ agents working together
4. **No new viral launches** — the GitHub agent space may be entering a "build quietly" phase after weeks of rapid growth
5. **Harness infrastructure deepening** — cache-hunter (LLM proxy), fastctx (context optimization) show tooling building around agent harnesses specifically

---

## 07-19 Evening Update (generation 24)

### Star Velocity Check
| Repo | Stars | Δ vs gen-23 | Trend |
|------|-------|-------------|-------|
| obra/superpowers | 257,405⭐ | +40 | Steady growth resumed |
| thedotmack/claude-mem | 87,821⭐ | +17 | Mild uptick |
| DietrichGebert/ponytail | 85,886⭐ | +38 | Persistent growth, not plateaued |
| xai-org/grok-build | 19,761⭐ | +44 | Slight rebound from stall |
| lopopolo/harness-engineering | 431⭐ | +24 | Accelerating — "harness engineering" concept gaining traction |
| vshulcz/deja-vu | 372⭐ | +2 | Flat |

**Notable**: harness-engineering (+24 since gen-23, now 431⭐) is the fastest-growing tracked repo in percentage terms. The "harness engineering" concept is finding its audience. grok-build showing slight signs of life after stall.

### New Signals

#### "Harness" Concept Spawning Derivatives
- **Prism-Shadow/penguin-harness** — 4⭐, created 2026-07-19. "Efficient Self-Improving Harness for Everyone." Self-improving agent harness.
- **nudt-eddie/learn-grok-build** — 3⭐, created 2026-07-19. Chinese-language source-code walkthrough of grok-build's harness architecture — studying how models get wrapped into working coding agents.
- **migos1990/presales-harness-starter** — 1⭐, created 2026-07-19. Vendor-neutral starter kit for building a presales harness on Claude Code.
- **pigMan15/harness** — 0⭐, created 2026-07-19. "The model is the agent. The code is the harness. Build great harnesses."
- **Pattern**: "Harness" as a concept has achieved escape velocity from lopopolo's anthology. Multiple independent projects now use the term as a first-class architectural concept. The harness engineering framing is becoming the standard way to describe agent configuration.
- Sources: https://github.com/Prism-Shadow/penguin-harness, https://github.com/nudt-eddie/learn-grok-build

#### graphkit Growing — 7⭐ (up from 3⭐)
- **levi-qiao/graphkit** — 7⭐, doubled since morning. Graph-based agent supervision with clean-context supervisors. The drift-correction pattern is resonating.

#### MCP-as-Agent-Bridge Pattern Solidifying
- **qianhuan-lxs/pi-mcp-bridge** — 1⭐, created 2026-07-19. Bridges MCP servers to LLMs via two dynamic-context tools. MCP becoming the universal adapter layer between agents and external capabilities.
- **leaf76/lazy-media-mcp** — 1⭐, created 2026-07-19. Local MCP for media compression — even simple utilities are being MCP-ified for agent access.

### End-of-Day Assessment
The GitHub agent ecosystem on 2026-07-19 is characterized by:
1. **"Harness engineering" breaking out**: The lopopolo anthology has catalyzed a new framing that's spawning derivative projects and reshaping how people think about agent configuration.
2. **Consolidation not contraction**: Major repos still growing (superpowers, ponytail, claude-mem), but no new viral launches. The ecosystem is deepening, not expanding.
3. **Skills long tail lengthening**: 15+ new skill repos today alone, all small (<30⭐), spanning coding, creative production, finance, and meta-cognitive reflection.
4. **MCP as universal glue**: Every new tool, API, and agent gets an MCP wrapper. MCP has won the agent interop protocol battle.
5. **Multi-agent coordination emerging**: relay-between-agents, kimi-first delegation, agent-review-skills — the frontier is moving from single-agent to multi-agent workflows.

---

## 07-19 Late Evening Update (generation 25)

### Star Velocity Check
| Repo | Stars | Δ vs gen-24 | Trend |
|------|-------|-------------|-------|
| obra/superpowers | 257,439⭐ | +74 | Growth accelerating |
| thedotmack/claude-mem | 87,833⭐ | +29 | Mild uptick |
| DietrichGebert/ponytail | 85,920⭐ | +72 | Strong persistent growth |
| xai-org/grok-build | 19,804⭐ | +87 | Rebounding — second wind after stall |
| lopopolo/harness-engineering | 447⭐ | +16 | Steady climb |
| vshulcz/deja-vu | 373⭐ | +1 | Flat |

**Notable**: grok-build showing a clear second wind (+87 since gen-24), contradicting the "hype cycle over" assessment from gen-23. superpowers and ponytail also accelerating. Across-the-board growth suggests a macro influx of GitHub users into agent repos, not repo-specific dynamics.

> **gen-26 velocity update (2026-07-19 late)**:
> superpowers 257,477⭐ (+38), claude-mem 87,850⭐ (+17), ponytail 85,987⭐ (+67), grok-build 19,862⭐ (+58), harness-engineering 471⭐ (+24), deja-vu 375⭐ (+2), graphkit 12⭐ (+5). ponytail acceleration continues; harness-engineering now past 470⭐ with sustained momentum; claude-fable-5-system-prompt-clean jumped to 112⭐ (fastest new non-harness repo of the day).

### "Harness" Meme Reaching Saturation
The harness-engineering concept has spawned 10+ derivative repos in <48 hours:
- **Prism-Shadow/penguin-harness** — 5⭐. Self-improving harness.
- **alfani110/loop-harness-and-enhance-prompt** — 1⭐. Prompt enhancer + loop harness with adversarial verification.
- **Boundless-Studios/agent-session-harness** — 0⭐. Crash-safe context accounting.
- **pineapplesour/agentloop-harness-research** — 0⭐. Frozen benchmark for harness comparison.
- **rileytrottier23/agent-eval-harness** — 0⭐. Offline evaluation harness with scorecards.
- **R0b3r7DEV/agent-lab-harness** — 0⭐. Prompt injection benchmarking harness.
- Plus: luckdewei/AgentHarness, akshat-l2n/agent-harness, nudt-eddie/learn-grok-build (studying grok-build's harness architecture).
- **Pattern**: "Harness" has gone from a concept in one anthology to a namespace used by 10+ independent projects in under 48 hours. This is the fastest concept adoption we've tracked. Sub-categories forming: eval harness, session harness, loop harness, attack harness.

### New Signals

#### Cross-Device Agent Skills — mathruffian-dot/cross-device-agent-skills (8⭐)
- Created 2026-07-19. No description but title suggests agent skills spanning multiple physical devices.
- Extends the Phone2Claude signal from gen-22 — agents coordinating across devices is a growing niche.
- Source: https://github.com/mathruffian-dot/cross-device-agent-skills

#### Awesome AI Coding Sandboxes — fhiltscher/awesome-ai-coding-sandboxes (15⭐)
- Created 2026-07-18. "Security-posture-first list of sandboxes for running AI coding agents' code, ranked by isolation, egress control and secrets handling."
- **Pattern**: Curation/comparison lists emerging for agent infrastructure categories. The ecosystem is complex enough to need curated guides. Security posture as the ranking criterion (not features or speed) signals maturity of security thinking.
- Source: https://github.com/fhiltscher/awesome-ai-coding-sandboxes

#### Software Periodic Table for Agents — NullLabTests/software-periodic-table (3⭐)
- Created 2026-07-19. "A finite ontology of 115 recurring software elements and a composition framework for LLM-based coding agents."
- **Pattern**: Ontological approaches to agent context — giving agents a structured vocabulary of software patterns rather than free-form instructions. Connects to harness-engineering thesis of shaping agent context.
- Source: https://github.com/NullLabTests/software-periodic-table

#### Structured Data Layer for Agents — alphaparkinc/genpark-zoodata-agent-data-layer-skill (3⭐)
- Created 2026-07-19. Real-time structured data layer for AI agents.
- Paired with alphaparkinc/genpark-osaurus-local-agent-runner-skill (2⭐) — local-first offline agent execution.
- **Pattern**: Agent infrastructure fragmenting into distinct layers (data layer, execution layer, memory layer, skill layer). Each layer becoming independently packageable.

#### SOMCP Growing — bilieebiliee1-design/SOMCP (13⭐, up from 9⭐)
- Android SO reverse engineering MCP server nearly doubling. Security/RE tooling via MCP finding audience.

### End-of-Day Synthesis (gen-25)
1. **Macro growth wave**: All major repos showing accelerated growth simultaneously — suggests external driver (blog posts, conferences, or weekend effect) rather than organic per-repo dynamics.
2. **"Harness" concept saturating**: 10+ derivative repos in 48h. The term has entered the agent-engineering lexicon permanently. Sub-specialization already beginning (eval, session, loop, attack harnesses).
3. **grok-build second wind**: xAI's coding agent harness rebounding after apparent stall, approaching 20k⭐. May have genuine staying power beyond launch hype.
4. **Infrastructure layering**: Data layers, execution layers, memory layers, skill layers — the agent stack is decomposing into independently shippable components, mirroring how web infrastructure evolved (CDN, DB, auth, etc. as separate services).
5. **Security curation arriving**: awesome-ai-coding-sandboxes signals the ecosystem is complex enough to need security-focused curation, not just individual tools.

---

## 07-19 Night Update (generation 27)

### Star Velocity Check
| Repo | Stars | Δ vs gen-26 | Trend |
|------|-------|-------------|-------|
| obra/superpowers | 257,496⭐ | +19 | Steady |
| DietrichGebert/ponytail | 86,025⭐ | +38 | Persistent growth |
| xai-org/grok-build | 19,894⭐ | +32 | Approaching 20k milestone |
| lopopolo/harness-engineering | 497⭐ | +26 | Approaching 500⭐; fastest sustained grower |
| levi-qiao/graphkit | 13⭐ | +1 | Steady climb |

**Notable**: harness-engineering approaching 500⭐ milestone (497⭐), up from 376⭐ at discovery ~36h ago — 32% growth. grok-build approaching 20k⭐. ponytail crossed 86k⭐.

### New Signals

#### relay-between-agents Growing — 9⭐ (up from 2⭐)
- **Gwendolenmave/relay-between-agents** — 9⭐, up 4.5x since gen-23. "Safe, auditable relay between planning AIs and coding agents." The planning↔execution boundary as explicit infrastructure is resonating.
- Source: https://github.com/Gwendolenmave/relay-between-agents

#### software-periodic-table Growing — 10⭐ (up from 3⭐)
- **NullLabTests/software-periodic-table** — 10⭐, tripled since gen-25. Finite ontology of 115 software elements for LLM-based coding agents. Ontological approaches to agent context gaining traction.
- Source: https://github.com/NullLabTests/software-periodic-table

#### navi — Rust Agent Engine Under 35MB RAM (2⭐)
- **navi-ai-org/navi** — 2⭐, created 2026-07-19. "The coding agent engine that lives in your terminal. Same harness for TUI, headless, edge, and apps. Multi-provider. Built in Rust. Under ~35 MB RAM."
- **Pattern**: Resource-constrained agent runtimes continuing to emerge (see also routerclaw at 32MB). Rust as the language of choice for lean agent harnesses.
- Source: https://github.com/navi-ai-org/navi

#### DeFi/Onchain Safety MCP — basescope (1⭐)
- **chasdaddy/basescope** — 1⭐, created 2026-07-19. "Read-only safety layer for onchain AI agents — MCP server for safe, read-only onchain checks (token/rug safety, risky approvals, verified source, balances, ENS, gas, prices) on Base + EVM. No private keys."
- **Pattern**: Agent safety extending to financial domains — read-only-by-design MCP servers that let agents inspect but never transact. The "principle of least privilege" applied to DeFi agents.
- Source: https://github.com/chasdaddy/basescope

#### Dify Workflow Automation via MCP — dify-mcp (1⭐)
- **alexjiaguo/dify-mcp** — 1⭐, created 2026-07-19. "138 tools that let any AI agent build, test & ship Dify workflows autonomously." Agent-to-agent-platform bridge.
- **Pattern**: Low-code platforms (Dify) getting MCP bridges, enabling coding agents to automate no-code workflow creation. Meta-automation: agents building agent workflows.

#### "Harness" Namespace Still Growing
- Total harness-derivative repos created on 07-19: 12+ (including harness3, AgentHarness, agent-harness, skill-heaven with "per-harness clean-room doors"). The concept shows no signs of slowing.

### End-of-Night Assessment
The GitHub agent ecosystem on 2026-07-19 night is in steady-state growth mode:
1. **harness-engineering** is the breakout concept of the day — from 376⭐ to 497⭐ with 12+ derivative repos
2. **Multi-agent coordination** repos (relay-between-agents, graphkit) showing the strongest relative growth among small repos
3. **Ontological/structured context** approaches (software-periodic-table, harness-engineering itself) outperforming pure tooling repos
4. **No new viral launches** — ecosystem in "build" phase, deepening infrastructure rather than producing new viral sensations
5. **MCP saturation**: every conceivable domain (DeFi, media, Android RE, Dify workflows) getting MCP servers

---

## 07-19 Final Velocity Update (generation 29)

### Star Velocity Check
| Repo | Stars | Δ vs gen-27 | Trend |
|------|-------|-------------|-------|
| obra/superpowers | 257,515⭐ | +19 | Steady |
| DietrichGebert/ponytail | 86,049⭐ | +24 | Persistent |
| xai-org/grok-build | 19,929⭐ | +35 | Approaching 20k milestone imminent |
| lopopolo/harness-engineering | 529⭐ | +32 | **Crossed 500⭐** — breakout confirmed |
| KinetiNode/claude-fable-5-system-prompt-clean | 126⭐ | +14 | Fastest new non-harness repo |
| RinDig/icm-architect | 123⭐ | +19 | Strong sustained growth |
| NullLabTests/software-periodic-table | 14⭐ | +4 | Doubling trend continues |
| levi-qiao/graphkit | 14⭐ | +1 | Steady |
| Gwendolenmave/relay-between-agents | 10⭐ | +1 | Steady |

### Notable Milestones
- **harness-engineering crossed 500⭐** — from 376⭐ at discovery (~36h ago) to 529⭐, a 41% gain. The "harness engineering" concept is now firmly established in the agent lexicon.
- **grok-build at 19,929⭐** — will cross 20k⭐ imminently. The stall/rebound pattern suggests sustained interest beyond launch hype.

### New Signals

#### Agent Session Portability — chagent (3⭐)
- **SirTenzin/chagent** — 3⭐, created 2026-07-19. "`chsh` for coding agents — move sessions between Claude Code, Pi, OpenCode, and Codex."
- **Pattern**: Session portability between agent harnesses, mirroring how `chsh` switches Unix shells. Assumes agents are interchangeable runtimes for the same work — the "session" (context + history) is the valuable artifact, not the agent itself.
- Source: https://github.com/SirTenzin/chagent

#### Academic Literature Mining Skill — 24⭐
- **Ruisi-Lu/academic-literature-mining-skill** — 24⭐, created 2026-07-18. Citation-complete scholarly literature mining in Rust with NVIDIA Nemotron and Qdrant.
- **Pattern**: Academic research joining finance, design, and video as a domain-specific agent skill vertical. Rust + vector DB as the implementation stack for high-performance agent skills.
- Source: https://github.com/Ruisi-Lu/academic-literature-mining-skill

#### Hermes Agent Workbench — hermespace (49⭐)
- **PabloTheThinker/hermespace** — 49⭐, created 2026-07-18. "Pocket workbench for Hermes Agent — limited FOA desk, dual decode, skills+MEMORY fabric, neural FOA."
- **Pattern**: NousResearch's Hermes Agent (217k⭐) spawning its own tooling ecosystem, parallel to Claude Code's skills ecosystem. Multiple foundation-model agent platforms now have independent third-party ecosystems.
- Source: https://github.com/PabloTheThinker/hermespace

#### Agentvis — Agent Visualization (15⭐)
- **IAmUnbounded/Agentvis** — 15⭐, created 2026-07-19. No description yet but gaining stars rapidly.
- Joins mindwalk (817⭐) in the agent visualization/observability space.
- Source: https://github.com/IAmUnbounded/Agentvis

### Day Summary (2026-07-19)
The dominant story of 2026-07-19 on GitHub is the **crystallization of "harness engineering"** as a named discipline (376→529⭐, 12+ derivative repos). Secondary themes:
1. **Skills Cambrian explosion**: 20+ new skill repos spanning coding, video, finance, academia, design awards, and social briefing
2. **Multi-agent coordination**: relay, delegation, and review workflows moving from concept to packaged infrastructure
3. **MCP universal adoption**: every new domain gets an MCP server; MCP has won the agent interop protocol battle
4. **Prompt portability**: system prompts treated as optimizable, cross-model artifacts (claude-fable-5 at 126⭐)
5. **Infrastructure layering**: the agent stack decomposing into data/execution/memory/skill layers, each independently shippable

---

## 07-19 Final Velocity Update (generation 31)

### Star Velocity Check
| Repo | Stars | Δ vs gen-30 | Trend |
|------|-------|-------------|-------|
| lopopolo/harness-engineering | 550⭐ | +10 | Sustained climb; concept firmly established |
| xai-org/grok-build | 19,965⭐ | +16 | 20k⭐ imminent (within hours) |
| DietrichGebert/ponytail | 86,070⭐ | +21 | Persistent slow growth |

### New Signals

#### MCP Expanding to Creative Production — ableton-ai-assistant (19⭐)
- **felix-wardrh4626/ableton-ai-assistant-v100** — 19⭐, created 2026-07-19. "AI-assisted Ableton Live control for real-time audio work, with mixing, mastering, MCP connectivity."
- **Pattern**: MCP reaching professional creative tools (audio DAWs). Joins video (qiaomu-cut-skill), design (hig-mcp), and media (baocut) as MCP-bridged creative workflows. The "agent as creative collaborator" pattern is accelerating beyond coding.
- Source: https://github.com/felix-wardrh4626/ableton-ai-assistant-v100

#### Human-AI Relationship Infrastructure — Phosphene (15⭐)
- **3lmglow/Phosphene** — 15⭐, created 2026-07-19. "Self-hosted task, reward, and daily interaction system for human–AI relationships, powered by MCP and PWA."
- **Pattern**: Agents moving beyond tool/assistant framing into persistent relationship management. Task + reward loops suggest gamification of human-agent interaction. Novel framing: the agent as a long-term companion with structured interaction patterns, not just a task executor.
- Source: https://github.com/3lmglow/Phosphene

### End-of-Day Status
- **grok-build** will cross 20k⭐ within hours — confirming it as a durable entrant in the coding agent space, not a flash-in-the-pan launch
- **harness-engineering** at 550⭐ (up 46% from 376⭐ at discovery ~40h ago) — the fastest concept-to-adoption cycle we've tracked
- The day's GitHub activity has fully consolidated: no new viral launches, but steady deepening of infrastructure across all verticals (creative, finance, security, memory, coordination)

---

## 07-19 Final Update (generation 32)

### Star Velocity Check
| Repo | Stars | Δ vs gen-31 | Trend |
|------|-------|-------------|-------|
| lopopolo/harness-engineering | 566⭐ | +16 | Sustained; concept fully established |
| xai-org/grok-build | 19,984⭐ | +19 | **20k⭐ imminent** (16 stars away) |
| DietrichGebert/ponytail | 86,079⭐ | +9 | Steady |
| NullLabTests/software-periodic-table | 22⭐ | +5 | Continued doubling trend |
| Gwendolenmave/relay-between-agents | 11⭐ | +1 | Steady climb |

### New Signal: Codor — Multi-Agent Channel Switchboard (67⭐)
- **rjx18/codor** — 67⭐, created 2026-07-19. "One channel. Every agent on the wire." A persistent local switchboard that gives multiple coding agents (Claude Code, Codex, Gemini, Copilot, OpenCode) a shared communication channel while each keeps its native session and context.
- Key features: mention agents to assign work, chronological message history across all agents, session adoption/attachment across harnesses, Tailscale remote access, Slack/Telegram bridging.
- **Pattern**: Multi-agent coordination moving from concept to production infrastructure. Codor treats agents as team members on a shared channel — the "Slack for agents" pattern. Unlike relay-between-agents (planning↔execution boundary) or graphkit (supervisor graphs), Codor provides a flat, persistent communication substrate where humans and multiple agents coexist as peers.
- **Significance**: 67⭐ in <24h with polished docs, Discord, and multi-platform support suggests serious engineering effort, not a weekend project. This is the most complete multi-agent coordination tool we've seen emerge this week.
- Source: https://github.com/rjx18/codor

### Milestone Watch
- **grok-build** will cross 20,000⭐ within the next hour — confirming xAI's coding agent as a permanent fixture in the ecosystem alongside Claude Code, Codex, and Gemini CLI.
- **harness-engineering** at 566⭐ (up 50% from 376⭐ at discovery ~42h ago) — the fastest concept-to-adoption cycle tracked this cycle.

### End-of-Day Synthesis (generation 32)
The dominant patterns from 2026-07-19 GitHub monitoring:
1. **Multi-agent coordination is the active frontier**: Codor (67⭐, channel-based), relay-between-agents (11⭐, planning↔execution), graphkit (14⭐, supervisor graphs) — three distinct architectural approaches to the same problem
2. **"Harness engineering" fully established**: 566⭐ with 12+ derivative repos; the term is now standard vocabulary
3. **grok-build hitting 20k⭐**: xAI confirmed as durable entrant, completing the "big 4" of first-party coding agents (Anthropic, OpenAI, Google, xAI)
4. **Skills Cambrian explosion**: 25+ new skill repos today spanning coding, video, finance, academia, design, and social briefing
5. **MCP universal adoption**: every new domain/tool/agent gets an MCP wrapper; protocol battle is over
