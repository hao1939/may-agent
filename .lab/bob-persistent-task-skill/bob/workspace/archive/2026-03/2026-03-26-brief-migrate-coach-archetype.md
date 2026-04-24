# Coach Archetype Migration Brief

## Context
We are migrating agents to an inheritance-based "Archetype" system to prevent regression during auto-evolution.
- **Base State**: `agents/_archetypes/coach/SOUL.md` (The immutable core identity & skills)
- **Instance**: `agents/coach/SOUL.md` (The evolving runtime instance)
- **Config**: `agents/coach/agent.json` needs to point to the archetype.

## Task
Modify `agents/coach/agent.json` to extend the Coach archetype.

### 1. Edit `agents/coach/agent.json`
Add the `extends` property pointing to the archetype.

```json
{
  "extends": "_archetypes/coach",
  "name": "coach",
  ...
}
```

## Verification
1. Run `ls -l agents/_archetypes/coach/SOUL.md` to confirm the base exists.
2. Run `grep "extends" agents/coach/agent.json` to confirm the link.
