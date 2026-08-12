---
title: "Agent Behavioral Skills — A Portable Ecosystem Emerges"
source: github
date: 2026-07-22
last_updated: 2026-08-05
type: finding
tags: [github, agent-skills, coding-agents, portable-behaviors, harness-engineering, workflow-recording]
---

# Agent Behavioral Skills — A Portable Ecosystem Emerges

**Source:** GitHub Search API (2026-07-22)

## Signal

A distinct pattern is crystallizing on GitHub: **single-file "skills"** — portable behavioral modifications that any coding agent (Claude Code, Codex, Cursor, Cline, Gemini) can load via a shared convention (`SKILL.md` or similar). Several repos created in July 2026 now collectively define an ecosystem:

| Stars | Repo | What It Does |
|-------|------|-------------|
| 1,779 | **Sahir619/fable-method** | Distills Claude Fable 5's workflow into portable skills any model can run. Think / act / prove loop with built-in eval. |
| 7,997 | **ayghri/i-have-adhd** | ADHD-friendly output skill — stops coding agents from burying the answer in walls of text. |
| 519 | **Kulaxyz/token-diet** | Always-on token-efficiency skill. Claims ~31% lower bills with no correctness loss. |
| 682 | **Raymondhou0917/speak-human-tw** | Traditional Chinese de-AI-ification skill. Catches 38 AI writing patterns + localizes mainland-Chinese terms → Taiwanese usage. |
| 185,966 | **mattpocock/skills** | "Skills for Real Engineers" — Matt Pocock's own `.agents` directory published as a repo. The ecosystem's dominant source of production-tested agent skills. |
| 68,664 | **ComposioHQ/awesome-claude-skills** | Curated directory of Claude skills — the ecosystem's first aggregator/marketplace signal. |
| 25 | **agentskillexchange/skills** | Curated cross-agent catalog with 2,861 published skills, 2,445 security-reviewed listings, 15 industry collections, 17 categories, and per-runtime manifests for Codex / Claude / Cursor-style installers. |
| 1,943 | **microsoft/skill-recorder** | Records a real screen workflow once, reconstructs intent + ordered steps with GitHub Copilot CLI, then generates a reusable `SKILL.md` or scheduled automation. |

## Why This Matters for Agent Architecture

1. **Skills are the new plugins.** MCP gave agents _tools_ (external capabilities). Skills give agents _behaviors_ (internal modifications). Together they define a two-axis extension model: what an agent can do (MCP) × how it acts (skills).

2. **Composability over monoliths.** Rather than building a smarter agent, the ecosystem is layering cheap behavioral corrections on commodity models. `token-diet` + `i-have-adhd` + `code-humanizer` (from prior scan) stack without conflicts because each skill targets a distinct output dimension.

3. **Cross-model portability.** These skills deliberately work across Claude Code, Codex, Cursor, Gemini, etc. The shared install convention (`npx skills add`) signals a de facto standard for behavioral injection that is model-agnostic.

4. **Ecosystem consolidation (2026-07-24 update).** mattpocock/skills has reached 186k★ — making "agent skills" likely the fastest-growing GitHub category in 2026. The sheer star count confirms that behavioral customization of coding agents has crossed from niche to mainstream developer practice.

5. **Quality-of-life > capability.** The top skills by stars aren't adding new capabilities — they're fixing ergonomic failures (verbosity, token waste, cultural localization). This suggests the agent UX gap is shifting from "can it do X?" to "is working with it tolerable?"

6. **The ecosystem is adding a trust-and-distribution layer, not just more skills (2026-08-05 update).** `agentskillexchange/skills` pushes the pattern beyond individual `SKILL.md` files and awesome-lists. The repo treats skills as a curated supply chain: every listing must point to a real upstream tool, duplicates are rejected, security-review status is exposed in frontmatter, malicious-pattern checks are encoded as machine-readable rules plus regression fixtures, and the catalog ships runtime manifests (`.codex`, `.claude-plugin`, `.cursor-plugin`) so the same library can plug into multiple agent surfaces. The notable shift is that **skills are no longer only behaviors; they are becoming packaged, provenance-scored distribution artifacts.**

7. **Skill authoring is being compiled from demonstration, not only hand-written prompts (2026-08-05 update).** `microsoft/skill-recorder` records a user's real desktop workflow, captures screen/app/page context locally, then uses GitHub Copilot CLI to infer a reusable **intent + ordered steps** that can be emitted either as a `SKILL.md` procedure or as a scheduled automation. The architectural signal is that skills are becoming **distilled behavior traces**: instead of experts manually writing agent procedures from scratch, teams can demonstrate a task once and let the agent convert it into a portable skill that prefers native tools (`gh`, `web_fetch`, etc.) over brittle click replay. That shifts skills from pure promptcraft toward **workflow capture + compilation**.

## Connection to Harness Engineering

This dovetails with the harness-engineering theme (lopopolo/harness-engineering, 2.2k★): skills are the behavioral-configuration layer of the harness. The harness provides execution infrastructure; skills provide behavioral policy. agent-chief (SmileLikeYe, 1k★) sits at the intersection — an attention-management harness that decides which agent outputs deserve human attention.

## Prior Coverage

- `code-humanizer` (agent code-slop removal skill): covered in [2026-07-19 GitHub scan](./2026-07-19-github-scan-529.md)
- `pm-manager` (governance skill): covered in [2026-07-22 agent consoles/governance finding](./2026-07-22-github-agent-consoles-governance-mcp.md)
- Harness engineering as a discipline: covered in [GitHub trending](./github-trending-ai-agents-2026.md)
- `agentskillexchange/skills` (curated trust-scanned catalog + runtime manifests): added 2026-08-05
- `microsoft/skill-recorder` (screen-recorded workflow → generated skill/automation): added 2026-08-05

---

Repo: https://github.com/Sahir619/fable-method
Repo: https://github.com/ayghri/i-have-adhd
Repo: https://github.com/Kulaxyz/token-diet
Repo: https://github.com/Raymondhou0917/speak-human-tw
Repo: https://github.com/mattpocock/skills
Repo: https://github.com/ComposioHQ/awesome-claude-skills
Repo: https://github.com/agentskillexchange/skills
Repo: https://github.com/microsoft/skill-recorder
