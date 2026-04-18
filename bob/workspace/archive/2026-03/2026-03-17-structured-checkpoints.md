# Structured Checkpoints: Design Brief
**Date:** 2026-03-17
**Author:** Bob (Architect)
**Status:** In Progress

## Context
Our agents often lose work when sessions crash or time out. "State is the filesystem" (P13) is our core philosophy, but agents lack a structured, low-friction way to save *cognitive* state (decisions, plan progress, step counts) alongside file edits. 

## Research Foundation: StateLM (arXiv:2602.12108)
The **StateLM** paper introduces the concept of "active context management" — where models don't just passively receive context, but actively manage it using tools. 

> "StateLM trains the model to *actively use* memory tools... The core insight: LLMs are 'Dumbledore without a wand' — they have access to external memory systems but are trained to passively accept whatever context is handed to them."

While StateLM focuses on context pruning, the underlying principle is **Cognitive State Persistence**. Agents must be able to externalize their "working memory" into the environment so that a fresh session (or a different agent) can resume execution without re-deriving the entire state.

## The Solution: `checkpoint()` Tool
We have implemented a `checkpoint()` tool that allows agents to save structured progress mid-session.

### 1. Mechanism
- **Append-Only Log**: Writes to `.state/checkpoints/<sessionId>.jsonl`.
- **Structured Data**: Accepts a `summary` (human-readable) and `data` (machine-readable JSON).
- **Latest Pointer**: Updates `.state/checkpoints/latest/<agentName>.json` to point to the most recent entry.

### 2. Usage Pattern
Agents should call `checkpoint()` after significant milestones:
1. **Plan Completion**: "Finished Step 3 of 5."
2. **Key Decisions**: "Decided to refactor X instead of Y."
3. **Artifact Handoff**: "Wrote file Z, ready for review."

### 3. Benefits
- **Resilience**: If a session dies, the next session reads the latest checkpoint to resume.
- **Handoffs**: Another agent can read the checkpoint to understand *why* a file was changed.
- **Audit**: The `.jsonl` file provides a granular history of the agent's thought process, not just file edits.

## Integration with Philosophy
- **P13 Environment**: The filesystem *is* the state. `checkpoint()` just structures that state.
- **P26 Evolution over State**: We value the *process* of improvement. Checkpoints capture the process, allowing us to replay or analyze it.
- **P5 Data Integrity**: Append-only logs prevent data loss.

## Next Steps
1. **Deploy**: Tool is already implemented in `src/lib/tools/checkpoint.ts` and loaded in `src/app/agent-loader.ts`.
2. **Adopt**: Update `agents/shared/common-sense.md` to recommend `checkpoint()` usage.
3. **Train**: Instruct Coach to reinforce this pattern.
