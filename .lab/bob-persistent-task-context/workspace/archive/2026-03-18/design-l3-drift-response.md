# Design: L3 Collective Defense - Drift Response Loop

**Status**: Draft
**Owner**: Bob
**Date**: 2026-03-13

## The Problem
We have the **Sensor** (`detect-drift.cjs`) and the **Actuator** (`manage-backups.cjs`). Now we need the **Controller** that wires them together safely. We cannot simply say `if (drift) restore()`, because false positives would wipe out legitimate progress.

## The Solution: The Drift Response Protocol

### 1. Severity Levels
- **Level 1 (Warning)**: Drift < 10%.
  - **Action**: Log to `bulletin.md`. No revert.
  - **Human**: Investigates.
- **Level 2 (Critical)**: Drift > 15% AND < 30%.
  - **Action**:
    - **Backup**: Create a "Quarantine Backup" of the current (bad) state for forensics.
    - **Revert**: Restore the *last known good* backup (e.g., from 24h ago).
    - **Lock**: Set `agents/[agent]/.state/lock` to prevent further automated updates for 24h.
- **Level 3 (Catastrophic)**: Drift > 30% (e.g., Syntax Error, Crash Loop).
  - **Action**: Immediate Revert + "Emergency Stop" (kill running sessions).

### 2. The Controller Logic (Evaluator)
The `evaluator` agent will run this logic in its daily loop.

```javascript
// Pseudo-code for Drift Controller
const drift = await detectDrift(agent);
if (drift.delta < -0.15) {
  // 1. Snapshot the failure (for analysis)
  await manageBackups.backup(agent, "quarantine-drift");
  
  // 2. Find the last stable backup
  const backups = await manageBackups.list(agent);
  const safeBackup = backups.find(b => !b.includes("quarantine"));
  
  // 3. Revert
  if (safeBackup) {
    await manageBackups.restore(agent, safeBackup);
    log(`⚠️ AUTOMATED REVERT: ${agent} rolled back to ${safeBackup} due to ${drift.delta * 100}% drift.`);
  }
}
```

### 3. Implementation Plan
1. **Enhance `detect-drift`**: Return structured JSON `{ delta: -0.2, successRate: 0.7 }` instead of just text report.
2. **Create `drift-controller.cjs`**: A higher-order skill that orchestrates detection and response.
3. **Deploy**: Add `drift-controller(agent)` to Evaluator's daily tasks.
