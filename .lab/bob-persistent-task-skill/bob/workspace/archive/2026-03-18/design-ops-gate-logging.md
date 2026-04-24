# Ops Gate Logging Design

**Status: COMPLETED**
**Owner: Bob**

## Context
We have implemented **Ops Gates** (P61) which introduce structural verification for critical operations (`run_test` and `git_commit`). Currently, these gates return structured receipts to the calling agent, but this data is ephemeral.

To enable long-term reliability analysis and auditability, we need to **persist** these receipts.

## Goals
1. **Audit Trail**: Every `test` and `commit` operation must be logged to a permanent record.
2. **Analysis Ready**: The log format should be machine-readable (JSONL) for future analysis by Evaluator or Optimizer.
3. **Zero Overhead**: Logging should be a side-effect of the gate, not a blocking operation for the agent.

## Implementation Design

### 1. Persistence Layer
- **File**: `.state/ops-receipts.jsonl`
- **Format**: JSONL (one JSON object per line).
- **Rotation**: Log rotation is out of scope for V1 (append-only is fine for now).

### 2. Log Structure
```json
{
  "timestamp": "2026-03-12T18:00:00.000Z",
  "sessionId": "s_12345",
  "agent": "coder",
  "tool": "run_test", // or "git_commit"
  "status": "success", // or "failure", "error"
  "details": {
    "command": "npm test",
    "exitCode": 0,
    "duration": 1500,
    "outputHash": "a1b2c3d4..."
  },
  "meta": {
    "testsPassed": 10,
    "testsFailed": 0
  }
}
```

### 3. Integration Point
Modify `src/lib/ops-gate.ts`:
- Add a `logOpsReceipt(receipt: OpsReceipt)` function.
- Call this function inside `gatedRunTest` and `gatedGitCommit` just before returning the receipt.
- Ensure file I/O errors do not crash the agent (wrap in try/catch).

## Verification Plan
1. **Unit Test**: Create `verify-ops-receipt-logging.ts`.
2. **Scenario**:
   - Run a gated test.
   - Run a gated commit.
   - Read `.state/ops-receipts.jsonl`.
   - Verify entries exist and match the operations.

## Tasks
1. [x] [Tech-Lead] Implement `logOpsReceipt` in `src/lib/ops-gate.ts`.
2. [x] [Tech-Lead] Create `verify-ops-receipt-logging.ts` and verify.
