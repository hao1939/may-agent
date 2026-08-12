# Approving: Human-Gated Multi-Agent Workflow Orchestration

Date: 2026-07-26
Source: GitHub
Repo: https://github.com/cocofhu/approving

## Summary

Approving is an open-source (MIT, Go) framework for composing coding agents into workflows with mandatory human approval gates at critical nodes. It provides visual orchestration of multi-agent collaboration, sandboxed execution, and rollback capabilities.

## Key Design Choices

- **Human Approve gates**: Workflow pauses at designated nodes until a human explicitly approves continuation — trust built into the execution path
- **Multi-backend support**: Integrates with Cursor, Claude Code, CodeBuddy, and Trae as agent backends
- **Sandboxed execution**: Each agent step runs in isolation
- **Rollback**: Can revert workflow state if an approved step produces bad outcomes
- **Self-hostable**: Full local deployment option

## Relevance to AI-Agent Architecture

This represents an emerging pattern: rather than fully autonomous agent loops, insert deterministic human checkpoints into multi-step agent workflows. The "approval gate" pattern addresses the trust/safety gap in autonomous coding agents — especially relevant for production deployments where unchecked agent actions carry risk.

## Signals

- 71 stars within 2 days of creation (2026-07-24)
- Active CI (server, web, sandbox, gateway components)
- Security-first posture (CodeQL, gitleaks, npm audit)
- Topics indicate positioning in the "harness" / orchestration layer space

## Tags

agent-orchestration, human-in-the-loop, multi-agent, trust-safety, workflow
