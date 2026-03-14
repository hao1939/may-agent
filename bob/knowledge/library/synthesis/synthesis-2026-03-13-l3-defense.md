# L3 Collective Defense: Drift Controller

## Context
The system now has a "Collective Defense" mechanism (P51/P62) that automatically detects degradation and reverts toxic changes.
This document synthesizes the implemented skills and their roles.

## Components

### 1. Detect Drift (`detect-drift.cjs`)
- **Role**: Sensor
- **Input**: `.state/ops-receipts.jsonl` (Ops Gate logs)
- **Logic**: Calculates success rates of critical tools (`coder:run_test`, `deploy`) over 24h windows.
- **Trigger**: Flags "DRIFT" if success rate drops > 15% (Critical) or > 10% (Warning).

### 2. Manage Backups (`manage-backups.cjs`)
- **Role**: Restoration
- **Input**: `agents/*/SOUL.md` + `agents/*/agent.json` + `skills/`
- **Logic**: Creates rolling tarball snapshots in `.state/backups/`. Restores from snapshot.
- **Safety**: Verify-before-restore (lists files).

### 3. Drift Controller (`drift-controller.cjs`)
- **Role**: Policy Engine
- **Input**: `detect-drift` output
- **Logic**:
  - `drift > 15%` → **REVERT** (call `manage-backups:restore`). Log incident.
  - `drift < 15%` → **WARN** (log to bulletin).
- **Execution**: Run daily by Evaluator.

## Operational Status
- **Deployed**: Yes (2026-03-13)
- **Verified**: Yes (Synthetic drift test pass).
- **First Action**: Reverted `test-agent-drift` after 5 simulated failures.

## Next Steps
- [ ] Extend coverage to `amy` (research quality).
- [ ] Add "human override" signal (if drift is intentional refactor).
