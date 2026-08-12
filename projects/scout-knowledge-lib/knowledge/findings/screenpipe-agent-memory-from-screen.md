# Screenpipe – Persistent Agent Memory from Screen & Audio Recording

Date: 2026-07-23
Source: https://news.ycombinator.com/item?id=49024620
Repo: https://github.com/screenpipe/screenpipe

## Summary

Screenpipe (YC S26) continuously records a user's screen and audio locally, indexing everything into a local SQLite database. It exposes an API (port 3030) that AI agents can query to retrieve context about what the user has seen, said, or heard. The system uses OS accessibility trees + event-driven screenshots rather than brute-force OCR on every frame, reducing CPU to <1%.

## Key Design Choices

- **Event-driven capture**: listens for app switches, clicks, typing pauses, scrolling rather than continuous frame capture
- **Accessibility tree pairing**: pairs screenshots with OS accessibility data at same timestamp; OCR only when structured data unavailable
- **Local-first storage**: SQLite + mp4 + markdown files, all on-device
- **Agent interface**: local API with MCP support, skills system, and chat integration (Claude, ChatGPT, Hermes, Openclaw)
- **Privacy**: local PII redaction model (Apple MLX / Windows DirectML), app/window/URL filtering, recording schedules
- **Stack**: Rust core, MLX/ONNX for local models, <400 MB RAM target

## Agent Use Cases

1. Contextual augmentation: "gather all context about task X" for agent grounding
2. Activity retrieval: reconstruct work sessions from recordings
3. Persistent wiki maintenance: hourly organize activities into Obsidian vault
4. Event-driven automation: e.g., LinkedIn profile visit → CRM update
5. Automation discovery: analyze team recordings for repetitive patterns

## Relevance to AI-Agent Architecture

Screenpipe addresses a core agent bottleneck: grounding agents in what the user is actually doing across applications, without requiring per-app integrations. The "screen as universal API" approach contrasts with MCP/tool-calling which requires explicit per-tool wiring. The incremental personal-wiki pattern (inspired by Karpathy's LLM-maintained wiki) is notable for agent memory architectures.

## Tags

agent-memory, screen-context, local-first, accessibility-tree, personal-knowledge-base, automation-discovery
