# Ferrox Factory — Deterministic Agentic Build Line

Date: 2026-07-23
Source: github
Repo: https://github.com/FerroxLabs/ferrox-factory

## Summary

Ferrox Factory is an open-source TypeScript framework that structures AI coding agent work as a **deterministic build line** — planned phases, parallel execution waves, and machine-enforced gates that no agent can bypass. The core thesis: trust comes from the process structure, not from the model.

## Key Details

- **Stars:** ~17 (created 2026-07-21)
- **Language:** TypeScript (npm package)
- **Pattern:** Factory-line metaphor — specs enter, verified committed software exits. Each phase has machine gates (automated checks) that must pass before work advances.
- **Problem addressed:** Coding agents that "declare victory" on broken code because they self-evaluate. Ferrox separates execution from verification via structural enforcement.

## Relevance to AI-Agent Architecture

This represents the **deterministic orchestration** pattern for agent work:

1. **Phased execution:** Work is decomposed into planned phases rather than free-form agent loops
2. **Parallel waves:** Multiple agent tasks run concurrently within a phase
3. **Machine gates:** Automated verification (tests, linting, type-checking) that structurally prevents advancement on failure — agents cannot "talk past" gates
4. **Separation of concerns:** The agent generates; the line verifies

This contrasts with the more common "agent-with-guardrails" approach (ActionRail, Agent Execution Partnership) by making the entire workflow deterministic rather than adding safety layers to a flexible agent.

## Architectural Pattern

```
Spec → [Phase 1: Plan] → GATE → [Phase 2: Implement (parallel waves)] → GATE → [Phase 3: Test] → GATE → Commit
```

Each GATE is a machine check, not an LLM judgment call.

## Tags

agent-orchestration, deterministic-workflows, coding-agents, build-systems, verification-gates
