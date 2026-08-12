# Qwen Audio Agent — Real-Time Voice Runtime for AI Agents

Date: 2026-07-29
Source: GitHub
Repo: https://github.com/QwenAudio/qwen-audio-agent

## Signal

Alibaba's Qwen Audio team released an open-source (Apache 2.0) real-time voice
runtime that keeps AI agents conversationally present even while executing
background tasks. 185★ within two days of creation (2026-07-27).

## Key Details

- **Full-duplex voice**: natural interruption and continuous multi-turn dialogue
  while the agent works — no "please wait" pauses during tool calls.
- **Background task parallelism**: questions answered immediately; long-running
  tool/MCP calls delegated to a backend agent, with results injected back into
  the conversation context automatically.
- **ACP-based agent composition**: plugs into existing coding agents (OpenCode,
  Hermes, Claude Code, Codex, Qoder) via the Agent Communication Protocol,
  acting as a voice presentation layer rather than replacing the underlying agent.
- **Three interaction surfaces**: WebUI, terminal TUI, and macOS floating widget.
- **Cross-session personal memory**: local user profiles persist across sessions.
- Language: JavaScript/TypeScript, requires Node 22.22+.

## Why It Matters

This is one of the first open-source implementations treating voice as a
**composition layer** on top of existing agents rather than a standalone voice
assistant. The architectural pattern — separating the conversational presence
layer from the task execution layer — mirrors the ADE (Agent Development
Environment) pattern seen in Orca but applied to voice modality. It signals that
agent UX is fragmenting into specialised modality runtimes (voice, visual,
terminal) that wrap a shared agent backend via protocols like ACP.

## Connections

- Validates the **delegation-surface** pattern: voice runtime delegates to
  specialised agents rather than building capabilities internally.
- Complements the ADE category (Orca, OpenWork) as a modality-specific
  composition layer.
- Uses ACP, the same protocol emerging as the standard agent interop surface.

## Status

Early-stage (185★, 2 days old). Worth monitoring for adoption trajectory and
whether ACP-based voice composition becomes a pattern others replicate.
