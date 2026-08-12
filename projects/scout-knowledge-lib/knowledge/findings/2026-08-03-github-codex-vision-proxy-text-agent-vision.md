---
title: "agent-vision-toolkit — Cross-Agent Vision Capability Layer for Text-Only Coding Agents"
source: github
date: 2026-08-03
last_updated: 2026-08-05
type: finding
tags: [github, agent-tooling, vision, multimodal, codex, claude-code, skills, computer-use, text-only-llm, capability-augmentation]
relevance: high
---

# agent-vision-toolkit — Vision for Text-Only Coding Agents

## Overview

- **Repo (current):** [Anionex/agent-vision-toolkit](https://github.com/Anionex/agent-vision-toolkit) (288★, 14 forks, created 2026-08-01, pushed 2026-08-05)
- **Repo:** [Anionex/codex-vision-proxy](https://github.com/Anionex/codex-vision-proxy) (same repository; now redirects to `agent-vision-toolkit`)
- **What:** The project has widened from a Codex-specific image proxy into a two-layer vision capability package for text-only coding agents: shell tools plus a skill (`glance`, `ground`, `detect`, `trace`) and an optional seamless-integration layer that makes pasted images and built-in image tools work in Codex, Claude Code, Pi / Oh My Pi, and OpenCode.
- **Language:** Python
- **License:** MIT

## 2026-08-05 Update

The README now frames the repo as two coordinated layers instead of a single proxy hack:

1. **Toolkit layer:** four CLIs plus a skill for any agent that can run shell commands.
2. **Seamless integration layer:** a local proxy or native extension so pasted images and built-in image-reading paths work without extra prompting.

Notable new details from the current README and repo metadata:

- **Cross-agent scope is explicit:** verified paths are now documented for **Codex**, **Claude Code**, **Pi / Oh My Pi**, and **OpenCode**, instead of only Codex.
- **Perception is split by job:** `glance` handles image Q&A / OCR, `ground` returns bounding boxes, `detect` inventories visible elements with coordinates, and `trace` converts image regions into SVG **locally and deterministically**.
- **Protocol adaptation is host-aware but unified:** the same proxy autodetects OpenAI Responses payloads (Codex) vs Anthropic Messages payloads (Claude Code) from request shape alone.
- **The built-in-image gap is the target surface:** the repo is no longer just about calling a tool on demand; it explicitly patches the higher-friction paths where users paste screenshots or the host agent's built-in image tool would otherwise fail on text-only models.

## Key Design Decisions

| Aspect | Detail |
|---|---|
| **Two-layer architecture** | Skill-backed CLI toolkit for deliberate image work, plus proxy/extensions for pasted-image and built-in-tool paths |
| **Targeted descriptions** | Each image description is focused on the agent's current question/intent, not a generic caption |
| **Vision model only describes** | The multimodal model transcribes/describes but never reasons — conclusions remain with the coding model |
| **Multi-image concurrency** | Handles multiple images in parallel |
| **Cross-turn caching** | Repeated references to the same image reuse cached descriptions |
| **Cross-host compatibility** | One describe layer is reused across Codex, Claude Code, Pi / Oh My Pi, and OpenCode |
| **Exact geometry stays local** | `trace` keeps shape extraction deterministic and pixel-derived instead of relying on model-estimated coordinates |
| **Computer-use support** | `ground` and `detect` give text-only agents actionable GUI coordinates and element inventories |

## Why This Matters

1. **The modality patch is becoming a portable agent layer:** This is no longer just a Codex workaround. The repo shows a broader pattern where perception is packaged as a reusable capability layer that can be attached to multiple coding-agent hosts.

2. **Agent skills and protocol shims are converging:** The interesting architecture is the split between explicit shell tools (the agent chooses when to look) and wire-level adaptation (pasted images and built-in image tools "just work"). That combination is stronger than either a skill-only or proxy-only design.

3. **Computer-use is getting a more precise perception stack:** `ground`/`detect` give model-assisted localization, while `trace` handles exact geometry locally. That hints at a practical separation between semantic seeing and deterministic coordinate extraction.

4. **Economy of model choice still holds:** Teams can keep a cheaper or preferred text-only reasoning model, then rent multimodality only for perception. The repo's growth to 288★ in four days suggests real demand for this separation.

## Connections to Library Themes

- **Agent capability composition** — a modality-level equivalent of tool / MCP augmentation
- **Agent skills ecosystem** — the repo now ships not just code but a skill-backed installation path for coding agents
- **Computer-use agents** — broadens GUI perception beyond natively multimodal frontier models
- **Cost-aware agent architecture** — separation of perception vs reasoning models
- **Protocol-surface adaptation** — shows that some agent capability gaps are best patched at the transport / host-integration layer, not only at prompt or workflow level
