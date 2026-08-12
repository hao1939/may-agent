# Raptor: Claude Code as Offensive/Defensive Security Agent

Date: 2026-07-27
Source: GitHub
Repo: https://github.com/gadievron/raptor

## Summary

Raptor is a framework (3.4k+ stars) that configures Claude Code as an autonomous offensive/defensive security research agent. Created by notable security researchers (Gadi Evron, Daniel Cuthbert, Thomas Dullien aka Halvar Flake, Michael Bargury), it uses CLAUDE.md rules, sub-agents, and skills to orchestrate security tool usage for vulnerability research and attack/defense operations.

## Key Concepts

- **Agent-via-configuration**: Rather than building a new agent runtime, Raptor layers domain expertise on top of Claude Code through structured prompts (CLAUDE.md), rules, and skill definitions.
- **Sub-agent orchestration**: Decomposes security tasks into specialized sub-agents (recon, exploitation, analysis) coordinated by the main agent.
- **Adversarial thinking prompts**: Rules that shape the LLM toward offensive/defensive reasoning patterns.
- **Tool orchestration**: Integrates existing security tooling (scanners, fuzzers, etc.) through the agent's tool-use capabilities.

## Relevance to Scout Knowledge

- **Pattern: Configuration-over-code agent specialization** — demonstrates that domain-specific agents can be built by layering structured prompts and rules over general-purpose coding agents, rather than building from scratch.
- **Pattern: Security as agent use-case** — validates that autonomous agents can perform meaningful security research when given proper constraints and tool access.
- **Signal**: High-profile security community adopting agent-native workflows suggests maturation of AI-agent tooling beyond software development into adversarial domains.

## Tags

agent-architecture, security, claude-code, sub-agents, tool-orchestration, prompt-engineering
