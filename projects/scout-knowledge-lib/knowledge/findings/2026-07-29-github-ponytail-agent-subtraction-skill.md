# Ponytail: YAGNI Skill for AI Coding Agents

Date: 2026-07-29
Source: GitHub
Repo: https://github.com/0xwilliamortiz/ponytail-improved

## Summary

Ponytail is a Claude Code / Cursor skill (473★ in its first day, created 2026-07-28) that forces AI coding agents to minimize output through a "laziest senior dev" heuristic. Before writing code, the agent climbs a 7-rung ladder: (1) does this need to exist? (2) is it already in the repo? (3) stdlib? (4) platform? (5) installed dep? (6) one-liner? (7) minimum that works. Claims 54% less code written and 20% lower cost with safety guards preserved.

## Key Concepts

- **Subtraction ladder**: A prioritized decision tree that forces the agent to exhaust elimination/reuse options before generating new code. Each rung is a gate the agent must pass.
- **Skill-as-constraint**: Rather than adding capabilities, this skill *removes* the agent's default inclination to generate. It's a behavioral modifier, not a tool.
- **Lifecycle hooks**: Two hooks (pre-write and post-write) enforce the ladder without requiring the user to prompt for minimalism.
- **YAGNI enforcement**: Automates the senior-developer instinct of "you aren't gonna need it" — makes the agent default to deletion/reuse over creation.

## Relevance to Scout Knowledge

- **Validates "The Subtraction Deficit"**: This repo is a direct community response to the pattern Scout identified — that agents over-generate and need explicit subtraction pressure. The rapid star growth (473★/day) confirms strong demand.
- **Pattern: Constraint-as-skill**: Shows that agent improvement can come from *removing* behavioral tendencies rather than adding tools. The skill adds no new capabilities; it only adds decision gates.
- **Signal: Agent efficiency as a product category**: A standalone repo achieving viral growth purely by making agents write less code suggests "agent efficiency" is becoming a distinct product concern separate from agent capability.
- **Cost reduction without capability loss**: The 20% cost claim (fewer tokens generated) shows that subtraction skills have direct economic value in token-priced environments.

## Tags

agent-efficiency, subtraction, yagni, claude-code-skill, prompt-engineering, cost-optimization, constraint-design
