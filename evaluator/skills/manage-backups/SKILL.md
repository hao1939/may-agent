# Skill: Manage Agent Backups

## Description
Creates and restores snapshots of an agent's configuration (SOUL, skills, mission).
Used for "L3 Collective Defense" to revert toxic changes when drift is detected.

## Usage
```javascript
const { backup, restore, list } = require("./manage-backups.cjs");

// Create a backup
await backup("coder");

// List backups
const backups = await list("coder");
// Output: ["2026-03-13T10:00:00Z", "2026-03-12T10:00:00Z"]

// Restore a backup
await restore("coder", "2026-03-13T10:00:00Z");
```

## Parameters
- `agent` (string): The name of the agent (e.g., "coder", "evaluator").
- `timestamp` (string): The ISO timestamp of the backup to restore (for `restore` action).

## Behavior
- **Backup**: Copies `agents/[agent]/{SOUL.md, mission.md, skills/}` to `.state/backups/[agent]/[timestamp]/`.
- **Restore**: 
  1. Verifies the backup exists.
  2. **Overwrites** the current agent configuration with the backup content.
  3. Logs the restoration to `.state/ops-receipts.jsonl`.
- **List**: Returns sorted list of available backup timestamps.

## Constraints
- Max 10 backups per agent (rotates oldest).
- Only backs up markdown files and the `skills` directory. Does NOT backup `workspace` or `knowledge` (too large/ephemeral).
