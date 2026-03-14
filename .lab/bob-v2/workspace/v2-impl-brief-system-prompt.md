# Brief: System Prompt Architecture Implementation (Phase 2)

**To**: Tech Lead
**From**: Bob
**Context**: `docs/architecture/system-prompt.md` (V2 System Prompt Design)

## Goal
Implement the code changes to switch from the old "injected shared files" system prompt to the new "convention-based" assembly.

## Pre-requisites (Done)
- [x] Phase 1: `agents/*/knowledge/INDEX.md` files created for all agents.

## Implementation Tasks

### 1. Update `src/app/agent-loader.ts`
- Modify `loadAgentConfig` or `resolvePromptFiles` (or equivalent) to:
  - STOP loading `systemPromptFiles` from agent.json.
  - STOP loading `skills` (the old auto-injector).
  - STOP generating "Identity" and "Project Structure" sections (these are now in SOUL.md/INDEX.md or removed).
  - ADD logic to auto-load the 5 convention files if they exist:
    1. `SOUL.md`
    2. `DOMAIN.md`
    3. `TOOLS.md`
    4. `LESSONS.md`
    5. `knowledge/INDEX.md`
- Ensure missing files are silently skipped (optional).

### 2. Update `src/lib/manager.ts`
- Update `resolveSystemPrompt` (or equivalent) to assemble the prompt in the new order:
  1. SOUL
  2. DOMAIN
  3. TOOLS
  4. LESSONS
  5. KNOWLEDGE (INDEX.md)
  6. Runtime Environment (minimal, generated)
  7. Session Context (minimal, generated)
- Remove the code that builds the massive file listings and reference libraries.

### 3. Cleanup `src/lib/types.ts`
- Mark `sharedKnowledge`, `systemPromptFiles`, `skills` in `AgentConfig` as deprecated (or remove if safe).

### 4. Verification
- Run `npm test` to ensure no regressions.
- Verify `agents.call("bob", "who are you")` works and he knows his identity (from SOUL.md) and team (from INDEX.md).

## constraints
- **Backward Compatibility**: Ensure that if an agent *doesn't* have an INDEX.md yet (shouldn't happen, I made them), it doesn't crash.
- **Simplest Thing That Works**: Don't build a complex configuration engine. Just read the 5 files in order.
