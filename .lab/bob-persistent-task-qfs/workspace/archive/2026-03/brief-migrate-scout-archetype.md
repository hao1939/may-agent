# Brief: Migrate Scout to Archetype Pattern

## Context
We are refactoring agents to use the "Archetype" pattern (`extends: "_archetypes/name"`).
This separates the "Class" (SOUL, Tools, Config) from the "Instance" (State, Workspace).
We have successfully migrated `coder` and `coach`. Now migrating `scout`.

## Tasks
1. **Backup**: Rename `agents/scout/SOUL.md` to `agents/scout/SOUL.md.bak` (Do not delete yet).
2. **Update Config**: Edit `agents/scout/agent.json` to extend the archetype.

**Target `agents/scout/agent.json`**:
```json
{
  "name": "scout",
  "extends": "_archetypes/scout"
}
```

## Verification
1. **Load Check**: Run `npx tsx src/app/agent-loader.ts scout` (or equivalent check) to verify it loads the SOUL from the archetype.
2. **Content Check**: Verify `agents/_archetypes/scout/SOUL.md` is identical to the old `agents/scout/SOUL.md`.

## Note
The `agents/_archetypes/scout/` directory and files have already been created by Bob.
