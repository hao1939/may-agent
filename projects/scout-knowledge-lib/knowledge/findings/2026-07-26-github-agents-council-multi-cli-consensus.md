# Agents Council: Multi-CLI Agent Consensus via Skills

Date: 2026-07-26
Source: GitHub
Repo: https://github.com/0xwilliamortiz/agents-council

## Summary

Agents Council is a skill/plugin that orchestrates multiple AI CLI tools (Claude Code, Codex CLI, Gemini CLI) as a "council" to gather diverse perspectives on a question, then synthesizes a consensus via a configurable Chairman agent. Inspired by Karpathy's LLM Council but uses existing CLI subscriptions instead of direct API calls, avoiding additional costs.

## Key Design Choices

- **Three-stage process**: Independent opinions → response collection → chairman synthesis
- **No extra API cost**: Leverages already-installed CLI subscriptions rather than raw API calls
- **Skill-based installation**: Installs as a Claude Code skill (`.claude/skills/`) or Codex skill (`.codex/skills/`), not an MCP server
- **Chairman role**: The host agent synthesizes by default (`role: auto`), or a custom CLI command can be configured
- **Auto-detection**: Installer detects which CLI tools are available and configures members accordingly

## Relevance to AI-Agent Architecture

Demonstrates the emerging **multi-model consensus** pattern at the CLI tool layer. Rather than building complex API orchestration, it treats each coding agent CLI as a peer and uses the skill/plugin interface as the integration surface. This is a lightweight approach to ensemble reasoning that reuses existing agent infrastructure.

## Metadata

- Stars: ~111
- Language: JavaScript
- License: Not specified
- Created: 2026-07-20
- Related: karpathy/llm-council (inspiration)
