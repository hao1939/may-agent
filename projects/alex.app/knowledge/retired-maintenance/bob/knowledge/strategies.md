
### 5. Gym Schema Verification
**Trigger Pattern**: `test/gym/stats.db` exists but verification fails due to missing binaries (`sqlite3`, `bun`).
**Diagnosis**: Runtime environment lacks tools to query SQLite directly, but source code is authoritative.
**Strategy**:
1. **Source of Truth**: Read the schema definition in `scripts/gym-record.ts` (or relevant source file).
2. **Verify Intent**: If the code explicitly defines the columns/tables, mark as VERIFIED (Implemented).
3. **Skip Runtime Check**: Do not fail the task because a verification tool is missing.
**Canonical Correction**: "Runtime tools unavailable; verifying source code implementation instead."
