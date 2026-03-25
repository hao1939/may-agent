# Agent Archetypes (Inheritance) — Implementation Plan

**Request**: req:dd26ffa7
**Design**: agents/shared/may-agent-docs/design/2026-03-25-team-archetypes.md
**Status**: ✅ COMPLETE — committed `f10cfde` (2026-03-25)

## Overview

Implement `extends` field in `agent.json` that enables agent inheritance from archetypes.
An archetype lives in `agents/_archetypes/<name>/` and provides a base config + SOUL.md.
Instance agents reference archetypes via `"extends": "_archetypes/<name>"` and can override
any config field and append to the SOUL.

## Step 1: Add `extends` to AgentConfig + merge logic in loader

**File**: `src/app/agent-loader.ts`

### Changes:
1. Add `extends?: string` to `AgentConfig` interface
2. Update `loadAgentConfig(agentDir, bus)` → `loadAgentConfig(agentDir, bus, agentsRoot)`:
   - After loading the raw JSON, check for `extends` field
   - If present, resolve the archetype dir: `resolve(agentsRoot, config.extends)`
   - Load the archetype's agent.json recursively (supports chained inheritance)
   - Merge: archetype is the base, instance fields override (shallow merge)
   - `name` always comes from instance (required)
   - `tools` are merged: archetype tools + instance tools (deduped)
   - `context_files` are merged: archetype files + instance files
   - Preserve the `extends` field on the merged config for downstream use
3. Update `loadAgents()`:
   - Skip directories starting with `_` (e.g., `_archetypes`)
   - Pass `agentsRoot` to `loadAgentConfig` calls
4. Update `validateAgentConfig()`:
   - If `extends` is set, verify the archetype directory exists and has agent.json

## Step 2: Add `archetypeDir` to SubagentDefinition + SOUL concatenation

**File**: `src/lib/types.ts`
- Add `archetypeDir?: string` to `SubagentDefinition`

**File**: `src/lib/manager.ts`
- In `resolveSystemPrompt()`, after computing `agentDir`:
  - If `def.archetypeDir` is set, load `SOUL.md` from archetype dir
  - Prepend archetype SOUL.md before instance SOUL.md
  - Also load archetype `DOMAIN.md` and `LESSONS.md` if instance doesn't have them

**File**: `src/app/agent-loader.ts`
- In `loadAgents()`, when registering, pass `archetypeDir` if config has `extends`:
  ```ts
  archetypeDir: config.extends ? resolve(agentsRoot, config.extends) : undefined,
  ```

## Step 3: Update tests

**File**: `test/agent-loader.test.ts`
- Add test: valid config with `extends` passes validation
- Add test: `extends` to nonexistent dir fails validation
- Add test: merged config inherits parent fields
- Add test: instance fields override parent fields

## Step 4: Update `agents.list()` display (stretch)

If the agents tool has a list action, show inheritance info. Low priority — skip for v1.

## Not in scope
- Migration of existing agents to archetypes (separate task)
- Web UI changes
- `explain-agent` debugging tool
