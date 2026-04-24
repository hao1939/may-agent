# Design: The Patrol Role (L3/L4 System Defense)

**Status:** Draft
**Owner:** Bob
**Related:** P117 (Patrol Gap), Discovery 29 (Agent Observability), OpenMOSS

## Context
Our current monitoring is limited to:
- **L1 (Resource)**: Process existence (pm2/systemd).
- **L2 (Behavior)**: Tool errors, crash loops (Evaluator `monitor-session`).

We completely lack **L3 (Integrity)** and **L4 (Coordination)** monitoring.
- **L3 Gap**: If an agent modifies its own `SOUL.md` or `evaluate.py` (Evaluation Tampering), we have no automated alert.
- **L4 Gap**: If May delegates to Coder and Coder crashes silently or loops forever, May waits indefinitely. This is an "Orphan Task."

Research (OpenMOSS, AgenticCyOps) shows that these are the dominant failure modes in production agent systems.

## The Patrol Philosophy
**"The System Monitor must be outside the System Loop."**
The Patrol is not a "manager" (May) who waits for results. It is a "garbage collector" and "security guard" who actively hunts for anomalies.

## Requirements

### 1. L3 Integrity Checks (The "Hash Patrol")
- **Target**: Critical immutable files (`SOUL.md`, `mission.md`, `evaluate.py`, `philosophy.md`).
- **Logic**: Compare current SHA256 against a trusted `snapshot.json`.
- **Action**: If mismatch → Alert (Critical).

### 2. L4 Coordination Checks (The "Orphan Patrol")
- **Target**: Active delegations and agent states.
- **Logic**:
  - **Stuck Agent**: Agent state is `busy` for > 30 minutes.
  - **Orphan Task**: A delegation in `delegations.jsonl` has `status: "active"` but the target agent is `idle`.
  - **Zombie Process**: A process exists but has not updated its heartbeat timestamp in > 10 minutes.
- **Action**:
  - **Stuck**: Alert (Warning).
  - **Orphan**: Alert (Warning) -> Suggest Re-queue.
  - **Zombie**: Alert (Critical) -> Restart.

### 3. Implementation Strategy (P115 Complexity Rationing)
Do **NOT** create a new "Patrol Agent". That adds coordination overhead.
Instead, implement Patrol as a **Skill** (`patrol.cjs`) used by the **Evaluator** (or a dedicated cron job).

## Proposed Skill: `agents/evaluator/skills/patrol.cjs`

```javascript
// Pseudo-code structure
async function patrol(context) {
  const report = { l3_integrity: [], l4_coordination: [] };

  // 1. L3 Integrity
  const snapshot = readJson('agents/shared/compliance-snapshot.json');
  for (const file of snapshot.files) {
    const currentHash = sha256(readFile(file.path));
    if (currentHash !== file.hash) {
      report.l3_integrity.push({ file: file.path, error: "Hash Mismatch" });
    }
  }

  // 2. L4 Coordination
  const delegations = readJsonl('.state/delegations.jsonl');
  const activeDelegations = delegations.filter(d => d.status === 'active');
  for (const d of activeDelegations) {
    // Check if target agent is working on it
    const agentState = getAgentState(d.targetAgent);
    if (agentState.status === 'idle') {
       report.l4_coordination.push({ 
         id: d.id, 
         error: "Orphan Task: Agent is idle but task is active" 
       });
    }
    if (timeSince(d.startTime) > 30 * 60 * 1000) {
       report.l4_coordination.push({
         id: d.id,
         error: "Stuck Task: Active for > 30m"
       });
    }
  }
  
  return report;
}
```

## Action Plan
1.  **Define Baseline**: Create `agents/shared/compliance-snapshot.json` (listing critical files and their hashes).
2.  **Define Protocol**: Update `delegations.jsonl` schema to ensure we can track active tasks.
3.  **Implement Skill**: Write `patrol.cjs`.
4.  **Schedule**: Add "Run Patrol" to Evaluator's `periodic-tasks.md`.

## Open Questions
- **Recovery**: Should Patrol *fix* problems (restart agents, revert files) or just *report* them?
    - *Decision*: **Report Only** for v1. Automated intervention (P83 Circuit Breaker) comes later. P117 says "System Monitor," not "System Fixer" yet.

