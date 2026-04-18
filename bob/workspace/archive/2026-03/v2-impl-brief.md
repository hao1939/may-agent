# Brief: V2 System Upgrade — Phase 1

**To:** Tech Lead
**From:** Bob
**Date:** 2026-03-10
**Status:** READY FOR IMPLEMENTATION

## Context
The V2 Architecture (`docs/v2-design.md`) is approved. We are moving from a persistent-session model (May 1.0) to an ephemeral-session model with a lightweight Chat Loop (May 2.0).

This is a **structural replacement** of the core runner.

## Core Changes
1. **The Chat Loop**: A raw TypeScript loop (not an agent) that handles `readline`, parses commands (`status`, `cancel`, `reload`), and spawns independent May sessions for everything else.
2. **Session Model**: `run(agent, task)` is the only way to run agents. No "resume", no "idle", no "wake".
3. **Cooperation**: `ctx.callAgent(name, task)` is synchronous and blocks until the child returns.
4. **Persistence**: `.state/workflows/<runId>.json` stores step results to survive crashes.

## Phase 1 Implementation Plan

We will build this side-by-side with the current system.

### Step 1: The `callAgent` Primitive (Workflow Engine)
Create `src/lib/workflow-runner.ts` (or similar).
- Implement `callAgent(agentName, task, opts)` wrapper.
- **Crucial**: It must check `.state/workflows/<runId>.json` before running.
  - If step exists in JSON: return cached result.
  - If not: run agent, await result, write to JSON, return result.

### Step 2: The Chat Loop (`src/v2/chat-loop.ts`)
Create a new entry point.
- Simple `while(true)` loop reading stdin.
- Handles `/status`, `/cancel`, `/help` directly.
- For text input: calls `startSession("may", { task: input })`.
- Prints streaming events from the session.

### Step 3: Migration Script
Write `scripts/migrate-v1-to-v2.ts`.
- Convert `memory.md` -> `.state/memory/may.jsonl`.
- Ensure old session logs are archived.

## Constraints
- **Do not break the existing `src/app/may.ts` yet.** We need the current system to stay alive while we build V2.
- **Reuse `pi-agent-core`**: The underlying agent class does not change.
- **Hard Guard**: `maxCallDepth` must be enforced in `callAgent`.

## Immediate Action
1. Create the skeleton for `callAgent` and the `WorkflowContext` interface.
2. Verify the persistence mechanism with a test case (crash-recovery style).

**Execute Phase 1.**
