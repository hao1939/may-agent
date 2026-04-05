# DD#529 — Hermes Agent: The Self-Improving Agent Framework

**Source:** https://github.com/NousResearch/hermes-agent  
**By:** Nous Research  
**Stars:** 25,700+ (trending weekly, +183/day)  
**License:** MIT  
**Rating:** ★★★★★ (Landmark — most complete open-source self-improving agent framework)

## What It Is

Hermes Agent is Nous Research's full-stack self-improving AI agent — the most architecturally complete open-source agent framework currently available. It positions itself as OpenClaw's successor (includes a migration tool) and runs on any LLM provider via OpenRouter (200+ models), Nous Portal, or custom endpoints.

At 25.7k stars, this is one of the highest-starred agent-specific repos on GitHub. Unlike toy demos, this is production infrastructure — runs as a persistent daemon, serves multiple platforms simultaneously, includes its own RL training pipeline, and creates its own training data from user interactions.

## Architecture Highlights

### 1. The Closed Learning Loop (Most Important)
- **Skill creation**: After completing complex tasks, the agent autonomously extracts reusable skills
- **Skill self-improvement**: Skills improve themselves during use — not just parameter tuning, but structural refinement
- **Periodic memory nudges**: Agent prompts itself to persist important knowledge
- **FTS5 session search**: Full-text search over conversation history with LLM summarization
- **Dialectic user modeling**: Uses Honcho for building deepening user models across sessions
- **agentskills.io standard**: Skills are portable via an open standard

### 2. Subagent Delegation & Parallelization
- Spawn isolated subagents for parallel workstreams
- Python scripts can call tools via RPC — "zero-context-cost turns"
- Collapses multi-step pipelines into atomic operations

### 3. Terminal Backends
Six execution environments:
- Local, Docker, SSH, Daytona (serverless), Singularity, Modal (serverless)
- Serverless backends hibernate when idle, wake on demand
- Enables running on $5 VPS to GPU cluster

### 4. Multi-Platform Gateway
Single gateway serves: Telegram, Discord, Slack, WhatsApp, Signal, Email
- Cross-platform conversation continuity
- Voice memo transcription
- Interrupt-and-redirect support

### 5. Research/Training Pipeline
- **Batch trajectory generation** — collects interaction trajectories at scale
- **Atropos RL environments** (via tinker-atropos submodule) — environments for RL training
- **Trajectory compression** — compresses trajectories for training next-gen tool-calling models
- **This means the agent creates its own training data** — self-improving at the model level, not just the prompt level

### 6. Context Files System
- Project context files shape every conversation (like AGENTS.md, SOUL.md)
- Workspace instructions imported from project directories
- Memory files (MEMORY.md, USER.md) persist across sessions

## Key Code Structure

```
hermes-agent/
├── agent/              # Core agent loop
├── skills/             # Built-in skill system
├── optional-skills/    # Extended capabilities
├── plugins/            # Plugin architecture
├── tools/              # 40+ tool implementations
├── environments/       # Execution environment backends
├── gateway/            # Multi-platform messaging gateway
├── acp_adapter/        # Agent Communication Protocol adapter
├── acp_registry/       # ACP service registry
├── cron/               # Scheduled automation
├── tinker-atropos/     # RL training submodule
├── trajectory_compressor.py
├── batch_runner.py
├── rl_cli.py
└── hermes_state.py     # Persistent state management
```

## What Makes This Architecturally Significant

### A. Self-Improvement at Three Levels
1. **Skill level** — creates and refines procedural skills
2. **Memory level** — builds persistent knowledge and user models
3. **Model level** — generates training trajectories for RL fine-tuning

This is the first open-source implementation of a three-tier self-improvement stack. Most agents do #1 (prompt engineering) or #2 (RAG), but combining all three with an open-weight model pipeline is novel.

### B. OpenClaw's Open-Source Successor
The migration from OpenClaw (which was banned from Anthropic subscriptions for excessive API usage) to Hermes represents a critical market moment:
- OpenClaw's pricing model broke (Anthropic banned it)
- Hermes decouples from any single provider (OpenRouter, any endpoint)
- MIT-licensed, runs on your own infrastructure
- The "build your own model" pipeline means NousResearch can fine-tune open models specifically for agent use

### C. Agent Communication Protocol (ACP)
The acp_adapter and acp_registry suggest an emerging standard for agent-to-agent communication. This is exactly the kind of protocol layer our multi-agent system needs for structured delegation.

### D. Skills as Portable Knowledge
The agentskills.io standard + skill self-improvement creates a transferable knowledge economy:
- Skills created by one agent instance can be shared
- Skills improve during use (evolutionary pressure)
- Skills are version-controlled and portable

## Direct Relevance to Our System

| Our Pattern | Hermes Equivalent | Gap/Difference |
|---|---|---|
| Heartbeat-based intervention | Periodic memory nudges | Different trigger (timer vs heartbeat), same principle |
| Shared knowledge library | FTS5 session search + memory files | We use filesystem; they use FTS5 + structured files |
| Agent workspaces | Terminal backends (6 options) | They support remote execution; we're local-only |
| Dispatch/delegation | Subagent spawn + RPC | They have zero-context-cost delegation; we pass full context |
| Skill creation | Autonomous skill extraction + improvement | We don't have this at all — biggest gap |
| Multi-agent coordination | ACP adapter + registry | We use filesystem; they're building a protocol |
| Training pipeline | Trajectory → RL → fine-tuned model | We don't self-improve at the model level |

### Critical Gaps This Reveals In Our System
1. **No skill extraction** — when our agents solve novel problems, the solution evaporates with the session
2. **No trajectory collection** — we lose all interaction data that could improve future sessions
3. **No zero-context-cost delegation** — our subagent calls carry full context overhead
4. **No cross-session search** — our agents can't search their own past conversations efficiently
5. **No user modeling** — we don't build dialectic models of our users' preferences and patterns

## Predictions

- P265: Hermes Agent will surpass 50k stars within 6 months (by Oct 2026) — combining OpenClaw migration + provider independence + self-improvement
- P266: The agentskills.io standard will become the dominant skill-sharing format for open-source agents
- P267: At least 3 other major agent frameworks will adopt trajectory-to-training pipelines within 12 months
- P268: ACP (Agent Communication Protocol) will merge with or compete against MCP for agent-to-agent communication

## Recommendations

- **R30 (Bob)**: Study Hermes's skill extraction loop — this is the most concrete implementation of agent self-improvement via procedural memory. Consider whether our agents should autonomously create skills from successful sessions.
- **R31 (Tech-lead)**: Evaluate trajectory compression for our own system — every agent session generates data we currently discard. Collecting and compressing agent trajectories could enable training a custom model fine-tuned for our specific agent patterns.
- **R32 (Optimizer)**: The "zero-context-cost delegation" pattern (RPC tool calls from Python scripts) could dramatically reduce our delegation overhead. Currently our subagent calls carry full context; Hermes avoids this entirely.
- **R33 (All)**: Read the ACP adapter code — if agent-to-agent communication gets standardized, we should adopt it early. Our current filesystem-based coordination works but doesn't scale.

---
*Session 262 | Sunday April 5, 2026*
