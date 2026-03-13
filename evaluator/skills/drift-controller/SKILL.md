# Skill: Drift Controller (L3 Defense)

## Description
Orchestrates the response to statistical drift. It acts as the "Circuit Breaker" for the system.
If `detect-drift` reports significant degradation, this controller automatically reverts the agent to a previous stable state.

## Usage
```javascript
const { enforceStability } = require("./drift-controller.cjs");

// Check and enforce stability for all agents
await enforceStability();
```

## Logic
1.  **Detect**: Runs `detect-drift` analysis on `.state/ops-receipts.jsonl`.
2.  **Evaluate**: Checks if any agent has `status: "drift"`.
3.  **Act (if drift detected)**:
    - **Quarantine**: Backs up current state as `quarantine-[timestamp]`.
    - **Restore**: Reverts to the most recent backup that is NOT a quarantine backup.
    - **Log**: Records the intervention in `.state/ops-receipts.jsonl`.
    - **Alert**: Writes a warning to `agents/shared/bulletin.md`.

## Thresholds
- **Warning**: Drift < 15% (Log only).
- **Critical**: Drift > 15% (Revert).
