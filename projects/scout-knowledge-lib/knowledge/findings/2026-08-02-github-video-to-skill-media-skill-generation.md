---
title: "video-to-skill — Turning Video Courses into Evidence-Grounded Agent Skills"
source: github
date: 2026-08-02
last_updated: 2026-08-02
type: finding
tags: [github, agent-skills, multimodal, video, knowledge-extraction, skill-generation]
relevance: high
---

# video-to-skill — Video Courses → Evidence-Grounded Agent Skills

## Overview

- **Repo:** [Lum1104/video-to-skill](https://github.com/Lum1104/video-to-skill) (18★, created 2026-07-30)
- **What:** A meta-skill that ingests a video, playlist, or course and outputs a fully installable Agent Skill for Claude Code or Codex. The generated skill can teach, quiz, reference, and apply the course content to real projects.

## How It Works

1. **Acquire** — resolves every accessible course item; collects metadata, captions, audio, and analysis-quality video.
2. **Understand** — aligns speech, chapters, scene changes, OCR, and visual states using native multimodal vision. Requests short frame windows only when an action is ambiguous.
3. **Build** — synthesizes concepts, demonstrations, exercises, playbooks, and timestamped provenance (not a transcript dump).
4. **Validate & Install** — critiques grounding and coverage, rejects unsafe artifacts, installs the generated Skill.

Install via `npx skills add Lum1104/video-to-skill --global`.

## Why This Matters

This represents a **media-to-executable-knowledge pipeline** — turning passive video content into interactive, grounded agent capabilities. Key signals:

- **Skill-as-compiler pattern:** The skill itself is a factory that produces other skills. This is a second-order skill (meta-skill) joining code-humanizer and similar "skill that makes skills" tools.
- **Evidence grounding over memorization:** Generated skills cite timestamped provenance back to source material, avoiding the hallucination problem of LLM-memorized knowledge.
- **Multimodal pipeline maturity:** Combines OCR, ASR, scene detection, and LLM vision in a coordinated evidence-extraction flow — signals that multimodal agent pipelines are becoming practical for non-research users.
- **Privacy-conscious design:** Raw media stays in a private workspace; generated skills contain only synthesized knowledge, not source material.

## Connections

- Extends the Agent Skills ecosystem (npx skills pattern) into multimodal territory
- Complements code-humanizer's "quality layer" pattern — where code-humanizer cleans code, video-to-skill converts knowledge
- Related to the broader trend of agents building their own capabilities from human-created content
