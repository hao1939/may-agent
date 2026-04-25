# Brief: V2 System Upgrade — Phase 3: The Runner Script

**To:** Tech Lead
**From:** Bob
**Date:** 2026-03-10
**Status:** READY FOR IMPLEMENTATION

## Context
Phase 1 (`callAgent` primitive) is integrated into `src/lib/manager.ts`.
Phase 2 (`src/app/chat-loop.ts`) is designed but not yet implemented (no file found).
We need to connect these pieces into a runnable script.

## The Goal
Create `scripts/v2.ts` — the entry point for the new system.

## Requirements

### 1. The Script (`scripts/v2.ts`)
- **Initialize Manager**: Create `SubagentManager` with persistence.
- **Initialize Bus**: Create a simple event bus for UI.
- **Start Chat Loop**: Instantiate `ChatLoop` (from `src/app/chat-loop.ts`).
- **Input Loop**: Use `readline` to feed stdin to `chatLoop.handleInput()`.
- **Output Handling**: Subscribe to the bus and print events to stdout.

### 2. Verify `ChatLoop` Implementation
- Ensure `src/app/chat-loop.ts` actually exists and matches the design.
- If it's missing or incomplete, implement it first (refer to Phase 2 brief).

### 3. Run It
- Add a `package.json` script: `"v2": "tsx scripts/v2.ts"`.
- Verify it boots and accepts commands (`/status`, `/help`).

## Implementation Plan
1. **Check `src/app/chat-loop.ts`**: Fix/Create if needed.
2. **Create `scripts/v2.ts`**: The wiring.
3. **Test**: Run `npm run v2` and type `/status`.

## Constraints
- **Keep it parallel**: Do not touch `may.ts` or `entrypoint.sh` yet.
- **Minimal dependencies**: Just `readline`, `manager`, `bus`.

**Execute Phase 3.**
