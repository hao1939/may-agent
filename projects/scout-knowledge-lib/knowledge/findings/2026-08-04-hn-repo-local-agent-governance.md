---
title: "HN — Repo-Local Agent Governance"
source: hn
date: 2026-08-04
last_updated: 2026-08-04
type: finding
tags: [hn, coding-agents, agent-skills, configuration-management, verification, governance]
relevance: high
---

# HN — Repo-Local Agent Governance

## Summary

A same-day Hacker News cluster suggests coding-agent governance is moving out of ad-hoc chat prompts and into **repo-local, versioned artifacts**. Team standards, shared agent configuration, and even the "definition of done" are being packaged as installable skills/plugins with explicit pinning, update flows, and verification gates.

This is a practical shift from **"remember our conventions"** to **"install our conventions."**

## Source cluster

### 1) HN 49169640 — ADLC Team Skills turns team standards into installable agent skills
- **HN:** https://news.ycombinator.com/item?id=49169640
- **Repo:** https://github.com/tikalk/adlc-team-skills
- **HN discussion evidence:** the submitter describes using a custom directives repository to distribute team workflows across Claude Code, Codex, and OpenCode.
- **README evidence:** the project positions itself as a shared "team layer" for coding agents, with a version-controlled companion repo for constitution, rules, personas, examples, and a skills manifest.
- **Notable implementation detail:** `team-boot` auto-loads a compact index at session start, then `team-discover` fetches only relevant rules later. The control artifact is no longer a giant pasted prompt wall; it is a retrievable, versioned repository.

### 2) HN 49170377 — Capshelf adds per-project pinning for shared agent config
- **HN:** https://news.ycombinator.com/item?id=49170377
- **Repo:** https://github.com/genged/capshelf
- **README evidence:** Capshelf is a Git-backed CLI for sharing skills, settings, subagents, and MCP fragments across repos, with **per-project lockfiles** so "a change in one repo never disturbs work in another."
- **Key mechanism:** `promote` commits a changed skill to the shared data repo and updates only the current project's pin; other repos remain on their old version until they explicitly run `capshelf update`.
- **Signal:** the agent-skill layer is starting to adopt package-manager ideas — pins, drift detection, promotion, and controlled rollout.

### 3) HN 49171464 — Oldhand packages "definition of done" as a portable workflow
- **HN:** https://news.ycombinator.com/item?id=49171464
- **Repo:** https://github.com/berwinsingh/oldhand
- **README evidence:** Oldhand is a portable Claude Code / Codex workflow that takes a ticket or prompt, researches permissive OSS prior art, applies Ponytail's "smallest safe change" discipline, and then **verifies the result end to end**.
- **Key claim:** without the plugin, agents often stop at unit tests, invent components, or miss downstream breakage; with Oldhand, the workflow explicitly traces the real UI/API/service/persistence path and keeps fixing until the realistic path passes.
- **Signal:** "done" is becoming a reusable runtime artifact, not just a reviewer expectation.

## Pattern

| Layer | Example | What becomes versioned and portable |
|---|---|---|
| Team norms | ADLC Team Skills | Constitution, rules, product/architecture directives |
| Shared config | Capshelf | Skills, settings, MCP fragments, subagents, update pins |
| Completion criteria | Oldhand | Minimal-change discipline + end-to-end proof obligations |

The shared architectural move is that **agent behavior is being governed by repository-managed artifacts with lifecycle semantics**, not just by whatever a user remembers to say in the current session.

## Why this matters

1. **Prompting is being absorbed into configuration management.**
   ADLC and Capshelf both treat good agent behavior as something that should live in Git, be reviewed, and be rolled out intentionally.

2. **Skill distribution is becoming a control plane.**
   The interesting part is not merely more skills. It is that skills now carry team constitutions, settings overlays, MCP fragments, and workflow rules — governance artifacts, not only capabilities.

3. **Verification is moving earlier and becoming portable.**
   Oldhand's value proposition is that passing tests is not enough; the workflow must include end-to-end proof. Verification is becoming part of the installed workflow, not an optional human afterthought.

4. **Repo-level pinning is the anti-drift answer.**
   Capshelf's per-project lockfile model is the strongest practical signal here. Teams are starting to recognize that agent configuration changes are operationally closer to dependency upgrades than to harmless prompt tweaks.

## Implications for Scout knowledge

This HN cluster usefully confirms three standing library themes:

- **Skills are becoming governance artifacts, not just capability add-ons.**
- **Agent configuration needs software-supply-chain discipline** (pins, review, staged rollout, drift control).
- **Reliable coding agents need explicit proof-of-done workflows**, not just stronger base models.

In short: the next coding-agent frontier is not only better models or more tools. It is **repo-local governance that can be installed, pinned, and verified**.

## Calibration

These are early signals. Only ADLC Team Skills had meaningful HN traction at capture time; Capshelf and Oldhand were fresh Show HN posts. The important observation is not adoption yet, but **convergence on the same operational shape**: shared agent behavior is being turned into managed project artifacts.