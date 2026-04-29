# Workflow Documentation

## Overview
This document covers the three core workflows in the agent system: master-worker, circuit-breaker, and budget-checkpoint.

---

## 1. Master-Worker Workflow

**Purpose**: Coordinates task delegation from orchestrator agents to worker agents.

**How it works**:
1. Master receives a project milestone or task
2. Master formulates a focused task with clear first-step instructions
3. Worker executes the task, producing concrete deliverables (files)
4. Master verifies output was produced and advances the project

**Configuration**:
- `maxIterations`: Maximum worker iterations per session (default: 5)
- `outputVerification`: If enabled, rejects iterations with zero file writes
- `taskFormat`: Structured with (a) what to produce, (b) what's different, (c) first step

**Key lessons**:
- Workers perform best with explicit "write first" instructions
- Vague tasks like "investigate" or "analyze" produce no output
- Every iteration should target at least one concrete file

---

## 2. Circuit-Breaker Workflow

**Purpose**: Prevents runaway failures by stopping execution after repeated errors.

**How it works**:
1. Monitors consecutive failure count per agent/task
2. When failures exceed threshold, circuit "opens" — task is paused
3. After cooldown period, circuit enters "half-open" — allows one retry
4. If retry succeeds, circuit closes (normal operation); if fails, reopens

**Configuration**:
- `failureThreshold`: Number of consecutive failures before opening (default: 3)
- `cooldownSeconds`: Wait time before half-open retry (default: 300)
- `halfOpenMaxAttempts`: Retries in half-open state (default: 1)

**When it triggers**:
- Worker produces no output 3+ times in a row
- API/tool errors exceed threshold
- Budget exhaustion on repeated calls

---

## 3. Budget-Checkpoint Workflow

**Purpose**: Manages token/cost budgets across agent sessions, checkpointing progress to prevent waste.

**How it works**:
1. Each session starts with a token budget allocation
2. After significant work, agents call `checkpoint()` to save progress
3. If budget runs low, session gracefully winds down with a summary
4. Next session resumes from last checkpoint instead of starting over

**Configuration**:
- `maxTokensPerSession`: Hard cap on tokens per session
- `checkpointInterval`: Suggested checkpoint frequency (e.g., every 3 tool calls)
- `reserveTokens`: Tokens reserved for graceful shutdown summary

**Best practices**:
- Checkpoint after every file write
- Include `files_modified` and `next_steps` in checkpoint data
- Don't spend tokens reading files that were already read in a previous checkpoint

---

## Quick Reference

| Workflow | Trigger | Key Config | Output |
|----------|---------|------------|--------|
| Master-Worker | Project milestone | maxIterations, outputVerification | Deliverable files |
| Circuit-Breaker | Consecutive failures | failureThreshold, cooldownSeconds | Paused/resumed task |
| Budget-Checkpoint | Token usage | maxTokensPerSession, reserveTokens | Saved progress state |
