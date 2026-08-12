# Poirot: Deep Research Agent Kernel with 5-Layer Memory & Middleware Architecture

Date: 2026-08-03
Source: GitHub
Repo: https://github.com/HezaoHezao/poirot

## Summary

Poirot is an open-source (MIT, Python 3.12+, LangGraph) deep research agent kernel that prioritizes architectural rigor over feature breadth. Its standout contributions are a **five-layer cognitive-science-inspired memory system** and a **middleware-first agent loop** where all cross-cutting concerns (memory recall, skill injection, context governance, sandbox lifecycle) are pluggable middleware rather than embedded logic.

Created 2026-07-28, 114★. 2400+ tests guard every layer.

## Key Architectural Patterns

### Five-Layer Long-Term Memory

| Layer | Role | Design Principle |
|-------|------|-----------------|
| L1 | Schema + Protocol | Frozen `MemoryTrace` dataclass (15 fields) + episodic/semantic/procedural types + 5 atomic ops — tools have no LLM, pure data |
| L2 | Default Strategies | Ebbinghaus decay formula with lazy computation at retrieve-time; no background tasks |
| L3 | Store + Retriever | Markdown file store with YAML frontmatter + BM25 hybrid retriever; retrieve reinforcement strengthens traces on access |
| L4 | Middleware + Bootstrap | Per-call HumanMessage injection (protects prompt cache prefix); `hide_from_ui=True` |
| L5 | Auto-Consolidation | Non-blocking daemon thread; LLM extracts episodic memories → merges → consolidates; errors log+skip, never blocks |

### Middleware-First Agent Loop

21 middleware cross-cut every lifecycle hook (`before/after_agent`, `before/after_model`, `wrap_tool_call`). The `app → agents` dependency is strictly one-directional. This makes the agent loop itself minimal while all behavior is composed externally.

### Context Engineering Governance

Dynamic externalization based on live token budget resolved by penetrating through FallbackChatModel to the active provider's real context window. Dual strategies: compaction (summarization) and externalization (offloading).

### Multi-Agent with Shared Sandbox

Delegates sub-tasks to external coding agents (Claude Code, Codex) via MCP SpecialistMcpServer with sandboxed tool exposure.

### Three-Layer Skill Self-Evolution

Skills are extracted from successful research sessions and evolve through use — forming a self-improving procedural memory layer.

## Relevance to AI-Agent Architecture

1. **Memory as first-class architecture**: The 5-layer separation (schema → strategy → storage → middleware → consolidation) is the most rigorous open-source agent memory architecture observed. Contrasts with flat vector-store approaches.

2. **Middleware pattern for agents**: Borrowing from web framework design (Express/Koa middleware), this pattern decouples agent behavior composition from the core loop — enabling independent testing and swappable capabilities.

3. **Lazy memory decay**: Computing Ebbinghaus-style strength at retrieve-time (not via background jobs) is a practical insight for systems that can't afford persistent workers.

4. **Per-call memory injection as HumanMessage**: Protecting prompt cache prefix by injecting recalled context as a human message rather than modifying the system prompt is a subtle but important optimization for production agents with caching.

5. **Context governance as runtime concern**: Resolving token budget dynamically from the active model's real window (not static config) enables seamless multi-provider operation.

## Tags

agent-memory, middleware-architecture, context-engineering, deep-research, cognitive-science, langgraph, multi-agent
