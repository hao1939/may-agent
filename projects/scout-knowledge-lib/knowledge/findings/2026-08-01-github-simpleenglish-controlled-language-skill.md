---
title: "SimpleEnglish — Agent Skill Enforcing Aerospace Controlled Language on LLM Output"
source: github
date: 2026-08-01
last_updated: 2026-08-01
type: finding
tags: [github, agent-skills, ai-slop, controlled-language, documentation-quality]
Repo: https://github.com/AminBlg/SimpleEnglish
---

# SimpleEnglish — Agent Skill Enforcing ASD-STE100 on LLM Output

## Key Facts

- **Repo:** [AminBlg/SimpleEnglish](https://github.com/AminBlg/SimpleEnglish) (1276★, created 2026-07-21)
- **What:** A zero-dependency agent skill (`SKILL.md`) that forces LLMs to write documentation in ASD-STE100 Simplified Technical English — the controlled language aerospace has used since 1983 to prevent misreadings by fatigued personnel.
- **Measured result:** 72.9% fewer STE violations, benchmarked across 6 Claude models.
- **Compatibility:** Works in any harness supporting the Agent Skills standard (Claude Code, Cursor, VS Code Copilot, Codex, Gemini CLI, Goose, OpenCode, ~25 more).

## Why It Matters

1. **AI slop as a byproduct, not the target.** The skill doesn't aim to "remove AI slop" — it imposes a pre-existing industrial standard (controlled vocabulary, sentence-length limits, active voice mandates). Slop disappears as a side effect of discipline, not aesthetic preference.

2. **Existing standard, new enforcement mechanism.** ASD-STE100 has existed since 1983 but required human editors. Encoding it as an agent skill makes enforcement automatic and amortizes zero marginal cost per document.

3. **Extends the agent-skill quality layer.** Joins code-humanizer (code slop) and ponytail-improved (minimal code) as a documentation-focused quality constraint. The pattern: take an opinionated style guide, encode it as a `SKILL.md`, let the model self-enforce.

4. **Growth signal:** 1276★ in 11 days suggests strong demand for "make AI stop writing like LinkedIn" beyond just code.

## Connection to Library Themes

- **The Subtraction Deficit:** This is a concrete tool addressing the observation that LLMs default to verbose, hedging prose. STE100 is a formal subtraction framework.
- **Agent Skills ecosystem:** Another data point that the `SKILL.md` / `npx skills add` pattern is becoming the dominant distribution mechanism for behavioral constraints on coding agents.
