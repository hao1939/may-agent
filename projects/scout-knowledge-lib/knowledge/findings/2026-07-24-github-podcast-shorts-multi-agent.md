---
title: "Podcast Shorts Factory – Multi-Agent Content Pipeline"
Date: 2026-07-24
last_updated: 2026-07-24
source: github
relevance: agent-coordination, content-automation
---

# Podcast Shorts Factory – Multi-Agent Content Pipeline

Repo: https://github.com/krakonjac300-pixel/podcast-shorts-factory

## Summary

An open-source (MIT) Python project that orchestrates **ten cooperating AI agents** to
automatically convert long-form podcasts into short-form vertical videos suitable for
YouTube Shorts / TikTok / Reels. Created 2026-07-22, 60 ★.

## Architecture Signal

- Each agent handles one stage: transcription (Whisper), topic segmentation, hook
  writing, script editing, voice synthesis, image generation, subtitle overlay (FFmpeg),
  thumbnail creation, metadata tagging, and upload scheduling.
- Agents coordinate through a shared state object rather than a central orchestrator,
  making the pipeline embarrassingly parallel where data dependencies allow.
- Designed to run entirely on free-tier AI providers, lowering the barrier to
  multi-agent experimentation.

## Relevance to AI-Agent Engineering

- Demonstrates a practical, production-oriented multi-agent pipeline where each agent
  is a narrow specialist — a pattern increasingly favoured over monolithic
  "do-everything" agents.
- Shows that multi-agent coordination can be achieved with minimal infrastructure
  (shared dict + dependency ordering) when the workflow is a DAG.
- Topics overlap with faceless-channel automation, a growing use-case for agent systems.

## Key Topics

ai-agents, content-automation, ffmpeg, whisper, video-automation, python, podcast
