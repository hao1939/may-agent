# HB-260425: Wuphf — Multi-Agent Collaboration Platform

**Source**: Hacker News / GitHub (nex-crm/wuphf)  
**Date**: April 25, 2026  
**Relevance**: HIGH — Directly addresses multi-agent collaboration, a core OpenClaw research area

---

## Overview

**Wuphf** is positioned as "Slack for AI employees with a shared brain" — a platform that enables multiple AI agents (Claude, Codex, "OpenClaws") to collaborate autonomously while maintaining shared context.

**HN Reception**: 39 points, 13 comments (trending Show HN)

---

## Key Features

1. **Multi-Agent Native**: Designed from ground up for multiple AI agents to work together
2. **Shared Context**: Agents maintain collective memory/context across sessions
3. **Autonomous Operation**: Agents can work independently without constant human oversight
4. **Markdown + Git Based**: Uses familiar developer workflows for agent knowledge management

---

## Architecture Clues from Repo Structure

```
wuphf/
├── mcp/                 # MCP (Model Context Protocol) integration
├── claude-code-plugin/  # Claude Code plugin
├── prompts/            # Prompt templates
├── internal/           # Core implementation
├── web/                # Web interface
├── AGENTS.md           # Agent configuration
├── ARCHITECTURE.md     # System design
└── DESIGN-WIKI.md      # Knowledge management design
```

**Notable**: Explicit MCP directory suggests deep integration with the emerging Model Context Protocol standard.

---

## What This Means for OpenClaw

### ✅ Validations
- Multi-agent collaboration is an active, investable problem space
- MCP is becoming the standard protocol for agent-tool interaction
- Shared context/memory across agents is a recognized need

### ⚠️ Gaps to Address
- Wuphf focuses on "AI employees" (human-like agents) rather than tool/skills-based agents
- OpenClaw's skill-centric architecture is different but complementary
- Opportunity: Skill-aware multi-agent coordination vs. general-purpose agent chat

### 🔍 Research Questions
1. How does Wuphf handle agent conflict resolution?
2. What's their shared memory architecture?
3. How do they handle agent discovery and capability advertisement?

---

## Links

- **GitHub**: https://github.com/nex-crm/wuphf
- **HN Discussion**: https://news.ycombinator.com/item?id=47899844

---

## Cross-References

- Related to: DiffMAS paper (arXiv:2604.21794) on learned multi-agent communication
- Related to: Tool Attention paper (arXiv:2604.21816) on MCP efficiency
- Contrasts with: Stash (memory layer, see HB-260425-stash-memory-layer.md)
