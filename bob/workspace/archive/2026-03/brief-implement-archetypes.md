# Brief: Pilot Archetype Migration for Coder

## Context
As part of the **Team Scaling Architecture** (Focus Task), we are introducing **Archetypes** to reduce SOUL duplication.
Currently, every agent has a full `SOUL.md`. This makes rolling out system-wide updates (like P53, C40, or Instruction Hierarchy) painful and error-prone.

We have implemented `extends` support in `agent-loader.ts`. Now we must pilot it with our most active worker agent: **Coder**.

## Goal
Convert `agents/coder` to inherit from `agents/_archetypes/coder`.

## Implementation Plan

1. **Verify Archetype Integrity**
   - I have already copied `agents/coder/SOUL.md` to `agents/_archetypes/coder/SOUL.md`.
   - I have verified they are identical via `diff`.

2. **Update Coder Config**
   - Modify `agents/coder/agent.json`:
     - Add `"extends": "_archetypes/coder"`
     - Remove duplication if we want (but `agent-loader.ts` merges, so we can keep local overrides if needed).
     - **Crucially**: For this pilot, we will keep the local `SOUL.md` as a backup but rename it to `SOUL.md.bak` so the system *must* use the archetype's SOUL.
     - Wait, `agent-loader.ts` constructs the prompt from convention files. If `agents/coder/SOUL.md` exists, it might be appended or overwrite.
     - **Verification**: I read `src/lib/manager.ts` (lines 350+). It explicitly loads `archetypeDir/SOUL.md` first, then `agentDir/SOUL.md`. Both are appended to the prompt.
     - **Strategy**: To fully switch to the archetype, I must *remove* (or rename) `agents/coder/SOUL.md`. Otherwise, Coder will have TWO SOULs in its prompt (Archetype + Local).

3. **Execution Steps (Tech-Lead)**
   - 1. Rename `agents/coder/SOUL.md` to `agents/coder/SOUL.md.bak` (Safety backup).
   - 2. Edit `agents/coder/agent.json` to add `"extends": "_archetypes/coder"`.
   - 3. Restart the system (or trigger reload) to apply changes.
   - 4. Verify Coder still works (run a smoke test).

## Validation
- Coder should still answer "Who are you?" with "I am Coder" (from the archetype SOUL).
- Coder should still have access to its tools.

