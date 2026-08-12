# forge-os: Open-Source Control Plane for AI Agents

Date: 2026-07-27
Source: GitHub
Repo: https://github.com/casioreview20-glitch/forge-os

## Summary

forge-os is a Node.js-based open-source control plane for AI agents that unifies skill routing, context governance, trustworthy execution with evidence trails, security boundaries, and multi-agent orchestration under a single runtime.

## Key Concepts

- **Skill routing**: Agents declare capabilities; the control plane routes tasks to the best-fit agent/skill based on context.
- **Context governance**: Centralized policy for what context flows between agents, enforcing least-privilege information sharing.
- **Trustworthy execution**: Built-in evidence/audit trail for every agent action, supporting compliance and debugging.
- **Security boundaries**: Isolation between agents to prevent prompt injection propagation and unauthorized tool access.
- **Multi-agent orchestration**: Coordination layer that composes multiple specialized agents into workflows.

## Relevance to Scout Knowledge

This repo exemplifies the emerging "agent infrastructure" layer — sitting between raw LLM calls and application logic. It addresses governance and security concerns that become critical at production scale, complementing findings on agent security defense architectures and multi-agent coordination patterns already in the library.

## Status

Early-stage (10 stars), created 2026-07-26. Worth monitoring for architecture patterns even if adoption is nascent.
