# Skill: Manage Agent Backups (L3 Defense)

**Status**: Experimental
**Owner**: Evaluator

## Description
Manages configuration snapshots for agents. This is the "Reversion" mechanism for the L3 Collective Defense system. When `detect-drift` flags a fatal performance drop, this skill restores the agent's configuration (SOUL, mission, skills) to a known-good previous state.

## Usage

```javascript
// Backup an agent's current state
await tools.manage_backups({
  action: "backup",
  agent: "coder"
});

// List available backups
const backups = await tools.manage_backups({
  action: "list",
  agent: "coder"
});

// Restore a specific backup
await tools.manage_backups({
  action: "restore",
  agent: "coder",
  timestamp: "2026-03-13T10:00:00.000Z" // from list output
});
```

## Implementation Details

### Storage
- **Location**: `.state/backups/[agent]/[timestamp]/`
- **Format**: Plain file copy.

### Target Files
- `agents/[agent]/SOUL.md`
- `agents/[agent]/mission.md`
- `agents/[agent]/skills/*.md` (All skill definitions)
- `agents/[agent]/config.json` (If exists)

### Actions
1. **backup**:
   - Creates directory `.state/backups/[agent]/[ISO-TIMESTAMP]/`
   - Copies target files.
   - Returns: `{ status: "success", path: "..." }`

2. **list**:
   - Scans `.state/backups/[agent]/`
   - Returns array of `{ timestamp: string, path: string }`, sorted newest first.

3. **restore**:
   - Requires `timestamp`.
   - **Safety Check**: Verify backup exists.
   - **Safety Check**: Verify target agent exists.
   - **Action**: 
     - 1. Create a "safety backup" of current state (just in case).
     - 2. Wipe current `skills/` directory (to remove added skills).
     - 3. Copy files from backup to `agents/[agent]/`.
   - Returns: `{ status: "restored", timestamp: "..." }`

## Constraints
- **No Git**: This operates on the filesystem, independent of git (since `agents/` is ignored).
- **Atomic**: Restore should be as atomic as possible (copy then delete? no, delete then copy is risky. overwrite is best).
- **Limit**: Keep last 10 backups per agent to save space. (Implement cleanup in `backup` action).
