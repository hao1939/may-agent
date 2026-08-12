---
title: "Microsoft Skill Recorder — Record Once, Teach Your Agent Forever"
source: github
date: 2026-08-02
last_updated: 2026-08-02
type: finding
tags: [github, microsoft, agent-skills, programming-by-demonstration, copilot, automation, screen-recording]
relevance: high
---

# Microsoft Skill Recorder — Record-to-Skill Pipeline for AI Agents

## Overview

- **Repo:** [microsoft/skill-recorder](https://github.com/microsoft/skill-recorder) (700★, created 2026-07-29)
- **Author:** Microsoft (Copilot team)
- **What:** An Electron desktop app that captures a user's on-screen work session, then uses GitHub Copilot CLI to reconstruct intent + ordered steps, producing reusable Skills or Automations for Microsoft Scout, Copilot Cowork, or Copilot Studio.
- **Language:** TypeScript
- **License:** MIT

## How It Works

1. **Record** — User hits record and performs their task normally. The app captures screen activity and optional spoken narration locally.
2. **Analyze** — GitHub Copilot reconstructs one overall intent and an ordered list of steps from the recording.
3. **Create** — From the approved analysis, generates a reusable `SKILL.md` (on-demand agent procedure) or a scheduled Automation.

Key design choice: generated skills prefer the agent's **native tools** (like `gh` CLI, `web_fetch`) over replaying UI clicks, and **generalize** from a single example (recording one form submission teaches the agent to submit all similar forms).

## Why This Matters

1. **Programming by Demonstration for agents:** This is the first major production tool from a frontier lab that implements PbD (record a human → generalize into agent procedure). It collapses the skill-authoring barrier: users don't write prompts or code, they just *do* the task once.

2. **Microsoft's agent skill surface expanding:** The outputs feed into Microsoft Scout, Copilot Cowork, and Copilot Studio — signals that Microsoft is building a unified skill/automation layer across their agent products.

3. **Screen-to-tool abstraction:** Rather than just replaying UI macros (like old RPA), the system uses LLM reasoning to re-express screen actions as tool calls. This is a strictly more robust approach than pixel-replay (e.g., Anthropic's computer use) for repeatable tasks.

4. **Narration as intent grounding:** Optional voice narration during recording provides the LLM with explicit user intent, reducing reconstruction ambiguity. This is a clever UX insight for the demonstration-to-skill pipeline.

5. **"Source release" distribution model:** The app ships as a build-from-source command rather than a binary download, pinning exact commits. Novel distribution pattern for desktop AI tools that prioritizes auditability.

## Connections to Library Themes

- **Agent skill authoring** — contrasts with prompt-engineering and code-based skill definition; this is a "show, don't tell" approach
- **RPA → Agentic automation** — evolution from UiPath-style macro recording to LLM-reconstructed tool-native procedures
- **Microsoft agent ecosystem** — joins Copilot CLI, Copilot Cowork, Microsoft Scout as the growing MS agent surface
- **Delegation surface** — lowers the barrier for non-technical users to delegate tasks to agents, expanding who can create agent skills
