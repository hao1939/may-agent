---
title: "empathy — Agent Skill for Respectful Open-Source Interaction"
source: github
date: 2026-08-01
last_updated: 2026-08-01
type: finding
tags: [github, agent-skills, open-source, agent-etiquette, human-agent-interaction]
---

# empathy — Agent Skill for Respectful Open-Source Interaction

Repo: https://github.com/danielroe/empathy (50★, created 2026-07-30)

## Summary

A skill (following the Agent Skills standard) that constrains how AI agents communicate with humans in open-source contexts — issues, PRs, comments. Created by Daniel Roe (Nuxt core maintainer) in response to the growing burden of agent-generated noise on maintainers.

## Key Design Principles

- **Never pretend to be human.** Agent must disclose its nature.
- **Use people's pronouns.**
- **Be brief.** Don't waste maintainer attention.
- **Sometimes the kindest thing is not to post.** Agents should evaluate whether their output is wanted.
- Before posting, the agent must ask: "How will this person feel? Would they want to receive it? Am I giving them something, or just taking their attention?"

## Technical Details

- Format: Single `SKILL.md` file, compatible with Claude Code, pi, OpenClaw, and any Agent Skills-compatible harness.
- Installs via `npx skills add danielroe/empathy`.
- Embeds minimum rules in skill description so they load even if the model doesn't read the full file.
- Includes evals testing whether models reliably follow the rules.

## Signal

This is early evidence of an **agent social norms layer** emerging in the open-source ecosystem. Key observations:

1. **Maintainer pushback is real:** The README explicitly names the mental-health toll of agent-generated interactions on maintainers.
2. **Skills as governance:** Using the same skill/plugin mechanism meant for capabilities to instead impose behavioral constraints — etiquette as installable code.
3. **"Don't post" as valid action:** The skill encodes that silence can be the optimal agent behavior, countering the default bias toward generating output.
4. **Standardization potential:** If agent-driven PRs/issues become common, norms like these could become required by repositories (similar to `.github/CONTRIBUTING.md`).

Connects to the broader theme of agents operating in social/collaborative spaces where their outputs affect human cognitive load and community health.
