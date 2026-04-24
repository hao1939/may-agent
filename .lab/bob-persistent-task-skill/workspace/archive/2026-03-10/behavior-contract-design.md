# Design: Shared Agent Behavior Contract (COMMON.md)

## Status: Draft
**Date**: 2026-03-09

## Problem
OpenClaw's `COMMON.md` prescribes rigorous operational rules (P1 exit criteria, P3 complex task checkpointing, no-chores) that our agents only partially follow. Our `agents/shared/philosophy.md` captures *principles*, but we lack a *behavioral contract* — specific, executable instructions on *how* to be a good citizen in this system.

## The Missing Layer
- **Philosophy**: "Why we do it" (Values).
- **Behavior Contract**: "What you must do" (Rules).
- **Implementation**: "How you do it" (Code).

We have Philosophy and Implementation. We are missing the Contract.

## Proposed Contract: `agents/shared/behavior.md`

This file will be **mandatory reading** for all agents (included in system prompt).

### Section 1: The Heartbeat Protocol (Wake Up & Work)
1.  **Check TODO**: If empty, scan `periodic-tasks.md`. If both empty, rest.
2.  **Drain Queue**: If items exist, do them *all* until turn limit warns.
3.  **One Loop**: Do not loop infinitely. Do work, report, exit.

### Section 2: Task Execution (The "How")
1.  **P1 Exit Criteria**: Never mark `[DONE]` without evidence (file link, diff, test output).
2.  **P3 Checkpointing**: Long tasks must write state to `workspace/checkpoint.json` before stopping.
3.  **Error Propagation**: If a tool fails, catch it, log it, and decide: Retry (once) or Escalate. Never silent fail.

### Section 3: Communication (The "Who")
1.  **No Hello**: Start with the payload.
2.  **Structure > Prose**: Use lists, tables, and headers.
3.  **Link, Don't Copy**: Reference files by path.

### Section 4: Boundaries (The "What Not")
1.  **No Chores**: Do not clean logs, check disk space, or monitor uptime. That is Infra's job.
2.  **No Self-Surgery**: Do not edit your own `agent.json` or core code unless explicitly tasked.
3.  **No Hallucinated Tools**: If `help` isn't in your tool list, don't try to call it.

## Implementation Plan

1.  **Create `agents/shared/behavior.md`**: Draft the contract based on OC patterns.
2.  **Update `agents/CONVENTIONS.md`**: Reference this contract as the source of truth for runtime behavior.
3.  **Update System Prompts**: Ensure `behavior.md` is loaded by `manager.ts` (resolveSystemPrompt).

## Recommendation
Create this file immediately. It unifies behavior across diverse models (Opus, Sonnet, Gemini) by giving them a shared "employee handbook".
