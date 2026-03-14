# Design: L3 Collective Defense - Automated Reversion (Snapshot Based)

**Status**: Draft
**Owner**: Bob
**Date**: 2026-03-13

## The Problem
We can now detect drift (e.g., success rate drops 15%). However, the system currently relies on human intervention to fix drift. This is too slow for "Boiling Frog" scenarios.
Crucially, **`agents/` is git-ignored**, so we cannot use `git revert` to rollback changes to agent configurations (SOUL, skills).

## The Solution: Snapshot-Based Reversion (The "Circuit Breaker")
Since we lack git history for agents, we must implement a **Rolling Backup System**.

### 1. The Trigger
- **Source**: `agents/evaluator/skills/detect-drift.cjs`
- **Condition**: `delta < -15%` (Fatal Drift)
- **Action**: Output `REVERT_REQUIRED` in the drift report.

### 2. The Mechanism: File-System Snapshots
We will maintain a local `.backup/` directory for critical agent files.

**Target Assets**:
- `agents/[agent]/SOUL.md` (Reasoning Core)
- `agents/[agent]/skills/*.md` (Skills)
- `agents/[agent]/mission.md` (Mission)

**Location**: `agents/[agent]/.backup/[timestamp]/`

### 3. The Protocol (Backup & Restore)

#### A. The Backup Routine (Prevention)
Before any "Evolution" or "Training" session (where files might change), or periodically (daily), we must snapshot the current state.
- **Skill**: `backup-agent-config`
- **Logic**: Copy target assets to `.backup/[timestamp]/`. Keep last 5 snapshots.

#### B. The Restore Routine (Cure)
When `detect-drift` flags a failure:
1. Identify the most recent "Good" snapshot (before the drift window).
2. **Skill**: `restore-agent-config`
3. **Logic**: Overwrite current `agents/[agent]/...` files with files from the selected backup.
4. **Log**: Record the rollback in `.state/ops-receipts.jsonl` (type: "rollback").

### 4. Implementation Plan
1. **Skill**: `agents/evaluator/skills/manage-backups.cjs` (Combined Backup/Restore)
   - **Action**: `backup` -> Creates timestamped folder.
   - **Action**: `restore` -> Restores from specific timestamp or "latest good".
   - **Action**: `list` -> Shows available backups.
2. **Workflow**: Update `agents/evaluator/periodic-tasks.md`
   - **Daily**: Run `manage-backups(action="backup")`.
   - **On Drift**: Run `manage-backups(action="restore", target="previous")`.

## Open Questions
- **Granularity**: Do we restore the *entire* agent config or just specific files? *Decision: Restore entire config directory (skills+SOUL) to ensure consistency.*
- **Storage**: `.backup/` inside the agent dir might be cluttered. *Decision: Use a centralized `.state/backups/[agent]/` to keep agent dirs clean.*
