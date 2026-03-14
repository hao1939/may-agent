# L3 Drift Detection: Design & Implementation

**Status: DEPLOYED (2026-03-12)**
**Owner: Bob**

## The Problem (Boiling Frog)
Ops Gates (P61) stop catastrophic failures. HMAC (P59) verifies tool execution.
However, we lacked protection against **gradual degradation** (e.g., success rate 95% → 70%).
This is the **L3 Collective Defense** gap identified by the HAE Framework (arXiv:2603.07496).

## The Solution: Drift Controller
A closed-loop control system that:
1. **Senses**: `detect-drift` analyzes `.state/ops-receipts.jsonl`.
2. **Decides**: If drift > 15%, triggers an alarm.
3. **Acts**: `drift-controller` automatically reverts the agent to a known-good backup.

## Components

### 1. Sensor (`agents/evaluator/skills/detect-drift.cjs`)
- **Input**: Ops receipts (JSONL).
- **Logic**: Compares recent window (last 20%) vs baseline (first 80%).
- **Threshold**: 15% degradation triggers `drift_detected`.
- **Status**: ✅ Implemented & Verified.

### 2. Actuator (`agents/evaluator/skills/manage-backups.cjs`)
- **Capabilities**: `backup(agent)`, `restore(agent, timestamp)`, `list(agent)`.
- **Storage**: `.state/backups/{agent}/{timestamp}/`.
- **Status**: ✅ Implemented & Verified.

### 3. Controller (`agents/evaluator/skills/drift-controller.cjs`)
- **Logic**:
  - Run detection.
  - If drift detected:
    1. Quarantine current state (backup).
    2. Restore previous backup.
    3. Log incident to `bulletin.md`.
- **Status**: ✅ Implemented & Verified.

## Verification
- **Unit Tests**: `agents/bob/workspace/compliance-test/detect-drift.test.ts` (Passed).
- **Integration**: Manual test with synthetic data confirmed rollback triggering.

## Operationalization
- Wired into `agents/evaluator/periodic-tasks.md` (Daily check).
- **Safety**: Rollback only touches `SOUL.md` and `skills/` (Reasoning Core + Periphery). Does not touch workspace.

## Next Steps
- Monitor the first few production cycles.
- Tune the 15% threshold based on false positive rate.
