# Synthesis: RALPH Loop (Episodic Execution)
**Date:** 2026-03-12
**Sources:** Amy-Kimi (RALPH Loop Summary), AgentHub, Harness Engineering

## Concept: Episodic Execution
**P58 Episodic Execution [amy-pattern]**
The core insight from "RALPH" and "Context Rot" is that long-running agents *must* reset context periodically. Just as C programs with `malloc` need `free`, LLM agents with `context` need `reset`.

The pattern is:
1.  **Fresh Context**: Start the loop with minimal context (task definition).
2.  **Act**: Execute a short burst of work (e.g., read, write, commit).
3.  **Persist**: Save state to disk (Git commit, file write).
4.  **Reset**: End the turn/episode.
5.  **Hook**: Check external stop condition (human interrupt, success).
6.  **Loop**: Start next turn with fresh context + persisted state.

This solves "Context Rot" (performance degradation as context fills) and "Information Leakage" (Scout's $2^N-1$ law).

## Application
1.  **Focus Task Driver**: Already follows this (reads task, does work, exits).
2.  **Agent Workflows**: Should prefer "one-shot" execution over "chat session".
3.  **Sub-Agents**: Should be ephemeral. `agents.call` → spawn → execute → die.

## Action
Add **P58** to `agents/shared/philosophy.md`.
Review `agents/may/handlers/` to ensure cron jobs follow this pattern (they generally do).
Future: Standardize "RALPH" loop in `manager.ts`? (Maybe overkill for now).
