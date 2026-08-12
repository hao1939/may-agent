---
title: "Voicebox — Local-First Voice I/O Stack for AI Agents via MCP"
source: github
date: 2026-07-22
last_updated: 2026-07-22
type: finding
tags: [github, mcp, agent-tools, voice, multimodal, local-first]
Repo: https://github.com/jamiepine/voicebox
---

# Voicebox — Local-First Voice I/O Stack for AI Agents via MCP

## Summary

Voicebox (45.7k★, MIT-licensed) is an open-source local-first AI voice studio that provides bidirectional voice I/O for MCP-aware agents. Created 2026-01-25. Agents can speak to users via a single `voicebox.speak` tool call and receive transcribed dictation — all running locally via MLX (Apple Silicon) or PyTorch (CUDA/ROCm/DirectML/CPU).

## Key Signal

**Pattern: Voice becoming a first-class agent I/O channel via MCP.**

Unlike text-only agent interactions, Voicebox gives any MCP-aware agent (Claude Code, Cursor, Cline) a cloned voice identity. Per-agent voice binding lets users distinguish agents by voice rather than reading output. The same floating pill UI surfaces both user dictation and agent speech states, creating a single mental model for bidirectional voice loops.

## Architecture Notes

- **Built-in MCP server** — exposes `voicebox.speak` and voice personality modes (Compose, Rewrite, Respond) to any connected agent
- **REST API** — `POST /speak` and `/transcribe` endpoints for non-MCP integrations (ACP, A2A, shell scripts)
- **Per-agent voice binding** — Settings → MCP lets you pin different cloned voices to different agent clients (`last_seen_at` confirms connection)
- **Local TTS engines** — 7 engines, 23 languages; voice cloning from seconds of audio
- **Whisper transcription** — same model backs dictation, captures, and the transcribe API
- **On-screen pill** — OS-level floating overlay shows `recording`, `transcribing`, `refining`, `speaking` states for both directions

## Scout Assessment

- **Relevance**: High — demonstrates MCP expanding from tool-use into sensory I/O modalities. Voice is the first non-text modality to get standardized agent plumbing at scale.
- **Implication for agent architectures**: Multi-agent systems can now have distinguishable voice personas without custom integration. Voice becomes composable infrastructure rather than a bespoke feature.
- **Comparison**: ElevenLabs/WisprFlow offer similar capabilities but as cloud services without MCP integration. Voicebox is local-first and agent-native by design.
- **Adoption signal**: 45.7k★ with broad MCP client support suggests voice I/O is becoming expected agent infrastructure, not a novelty.
