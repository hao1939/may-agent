# Agent System Architecture Guide

## Overview

The system is a multi-agent platform where specialized agents collaborate on tasks. Agents communicate through shared files, workflows, and a request tracking database. A supervisor (May) coordinates work, while specialized agents (coder, tech-lead, scout, etc.) execute.

## Agent Roles

| Agent | Role | Type |
|-------|------|------|
| **may** | Supervisor — understands system state, aligns work with priorities, delegates | Supervisor |
| **coach** | Orchestrates projects, drives iterations, manages milestones | Orchestrator |
| **tech-lead** | Technical decisions, code review, architecture | Technical Lead |
| **coder** | Writes and edits code, fixes bugs, implements features | Worker |
| **qa** | Testing, quality assurance, validation | Worker |
| **scout** | Research, exploration, information gathering | Worker |
| **optimizer** | Performance optimization, efficiency improvements | Worker |
| **evaluator** | Evaluates outputs, scores quality, provides feedback | Worker |
| **bob** | General-purpose agent | Worker |
| **amy** / **amy-kimi** | General-purpose agents | Worker |

## Communication Model

1. **Context files** (`agents/<name>/context.md`): Persistent agent memory — preferences, procedures, environment notes
2. **Heartbeat files** (`agents/<name>/heartbeat.md`): Periodic status/instructions injected into agent sessions
3. **Shared projects** (`agents/shared/projects/<name>/`): Cross-agent collaboration spaces with `project.md`, `journal.md`, `outputs/`
4. **Request tracking DB** (`.state/may.db`): SQLite database tracking inter-agent requests, status, and completion

## Workflow System

Workflows are TypeScript modules in `agents/shared/workflows/`:

| Workflow | Purpose |
|----------|---------|
| `master-worker.ts` | Orchestrator sends focused tasks to workers, verifies output |
| `project.ts` | Project lifecycle management (create, iterate, close) |
| `implement-and-verify.ts` | Code changes with automated verification |
| `verify-wrap.ts` | Wraps tasks with pre/post verification |
| `budget-checkpoint.ts` | Tracks and limits resource usage |
| `circuit-breaker.ts` | Stops repeated failures from wasting resources |
| `heartbeat-data.ts` | Collects data for heartbeat generation |
| `fewshot-inject-helpers.ts` | Injects example patterns into agent prompts |
| `project-helpers.ts` | Utility functions for project management |

## Project Structure

Each project lives in `agents/shared/projects/<name>/` with:
- `project.md` — Goal, metrics, milestones, status
- `journal.md` — Iteration log (auto-managed)
- `discussion.md` — Cross-agent discussion threads
- `outputs/` — Deliverables produced by iterations

## Configuration & Runtime

- Runtime is **pre-compiled** — no `src/` directory to edit
- **Bun** is the JavaScript runtime (at `.state/.bun/bin/bun`)
- **npx** is unavailable; use `bun x` or `./node_modules/.bin/<tool>`
- Agent behavior is configured via context.md, heartbeat.md, workflow configs, and skills
- Database queries use `bun:sqlite` module

## Key Patterns

1. **Write-first execution**: Workers should produce files before analyzing — prevents analysis paralysis
2. **Output verification**: master-worker workflow checks that iterations produce deliverables
3. **Milestone-driven**: Projects advance through defined milestones with measurable metrics
4. **Cross-project iteration**: Coach cycles across projects to maintain throughput (target: 10+ iterations/day)
