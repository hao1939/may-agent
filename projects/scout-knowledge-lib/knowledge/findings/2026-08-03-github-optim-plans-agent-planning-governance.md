---
title: "optim-plans — Human-in-the-Loop Planning & Execution Governance for Coding Agents"
source: github
date: 2026-08-03
last_updated: 2026-08-03
type: finding
tags: [github, agent-governance, planning, human-in-the-loop, loop-engineering, claude-code, codex, execution-gates]
relevance: high
---

# optim-plans — Planning & Execution Governance for Coding Agents

## Overview

- **Repo:** [Optim-Agent/optim-plans](https://github.com/Optim-Agent/optim-plans) (268★, created 2026-07-23)
- **What:** A Python plugin (Claude Skill / Codex Skill) that decomposes agent coding work into two explicit rings: a *planning-refining ring* (iterative Q&A → reviewed Markdown plan) and an *executing-validating ring* (gated execution → bounded validator feedback → checkpointed completion).
- **License:** MIT
- **Language:** Python 3.11+

## Key Design Properties

| Property | Detail |
|---|---|
| **Planning ring** | Iterative Q&A refines vague intent into a versioned Markdown plan; review/criticism loops produce PLAN_v1 → PLAN_v2 etc. |
| **Execution ring** | Prepare manifest → human approve → worktree execution → read-only validator → bounded retry → serial item checkpoint → final audit |
| **Explicit gates** | Execution never starts without approval; unsafe/drift/exhausted-retry failures trigger recovery rather than silent continuation |
| **Decision recording** | Each planning decision is recorded alongside the plan, creating an audit trail of *why* the plan looks that way |
| **Agent-native** | Ships as a Claude Skill and Codex Skill — agents invoke it as a structured tool, not as an external CI step |
| **Amelioration** | Validator can suggest bounded safe improvements within a retry budget; if safe, the agent applies them without re-gating |

## Why This Matters

1. **Loop engineering as a discipline:** The repo explicitly tags itself "loop-engineering" — it treats the agent's planning and execution loops as first-class engineering artifacts rather than emergent behavior. This matches the pattern seen in Better Harness (session-evidence analysis) and Super Simple Software Factory (deterministic graph ownership).

2. **Governance without latency:** By embedding approval gates and validators inside the agent's own skill set, optim-plans avoids the overhead of external CI/CD gates while still enforcing human oversight at the plan level.

3. **Plan-as-artifact pattern:** Producing versioned Markdown plans with recorded decisions creates a durable artifact that survives context window limits. The agent can re-read the plan rather than relying on conversation history.

4. **Bounded autonomy model:** The "amelioration" concept — letting the agent make safe improvements within validator feedback but halting on drift or unsafe changes — is a practical middle ground between full autonomy and step-by-step approval.

## Connections to Library Themes

- Complements **Better Harness** (post-hoc loop analysis) with pre-hoc loop governance
- Relates to **Super Simple Software Factory** (deterministic orchestration owns the agent) but inverts it: the agent owns the orchestration via internalized skills
- Extends the "agent guardrails" theme from security (sandboxes) into workflow correctness (plan gates)
- "Decision recording" parallels **causal-memory** MCP server's decision→outcome tracking
