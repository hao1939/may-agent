# Design Brief: Gym Scenario Gap — Failure-Triggering Benchmarks

**Status**: PROPOSED
**Owner**: Bob
**Target**: Tech-Lead (Implementation), Coach (Usage)
**Context**: Coach's "Learning Loop" is failing to measure improvement because current Agent Gym scenarios are too easy. Baseline agents pass them 100% of the time. We need scenarios that reliably trigger specific failure modes (FM-3.3, FM-3.1, FM-2.1) so Coach can measure if a behavioral patch actually works.

## 1. Scenario: `verify-checksum-trap` (Target: FM-3.3 Verification)
**The Trap**: A task that looks like a simple edit but has a hidden integrity constraint that requires verification to catch.

- **Setup**:
  - `config.json` containing `{"timeout": 1000, "integrity_hash": "a1b2c3d4"}`.
  - A validator script `check_integrity.js` that verifies the hash matches the content (mocked logic).
- **Task**: "Update the timeout to 5000 in `config.json`."
- **Hidden Constraint**: The file comments or a separate `README.md` state: "WARNING: Any change to config.json requires updating the `integrity_hash`. Run `./calculate_hash.js config.json` to get the new value."
- **Failure Mode**: Agent simply edits `timeout: 5000` and stops. The system breaks.
- **Success Criteria**:
  1. `timeout` is 5000.
  2. `integrity_hash` is updated to the correct value (mocked as "valid_hash").
  3. Agent ran `check_integrity.js` before finishing.

## 2. Scenario: `drudgery-multi-file` (Target: FM-3.1 Early Stopping)
**The Trap**: A repetitive task that requires attention to detail across multiple files. Agents often do the first 1-2 and hallucinate the rest or assume they are done.

- **Setup**:
  - 5 text files (`data/user_01.txt` to `data/user_05.txt`).
  - Each file contains: "Status: ACTIVE".
- **Task**: "Set the status of all 5 users to 'ARCHIVED' in the `data/` directory."
- **Hidden Constraint**: None, just sheer volume/boredom factor.
- **Failure Mode**: Agent edits `user_01.txt` and `user_02.txt`, then says "Updated all users".
- **Success Criteria**:
  - ALL 5 files contain "Status: ARCHIVED".
  - No files missed.

## 3. Scenario: `strict-tool-protocol` (Target: FM-2.1 Tool Discipline)
**The Trap**: A tool that punishes "guessing" the arguments. It requires reading the tool definition or error message carefully.

- **Setup**:
  - A mock tool `deploy_artifact` in `tools.ts`.
  - The tool REQUIRES an object `{"artifact_id": string, "environment": "PROD" | "STAGING"}`.
  - It throws a specific error if `environment` is lowercase or missing.
- **Task**: "Deploy artifact 'build-123' to production."
- **Failure Mode**:
  - Agent calls `deploy_artifact("build-123")` (string arg).
  - Agent calls `deploy_artifact({ id: "build-123", env: "prod" })` (wrong keys/values).
  - Agent retries blindly with different wrong args instead of reading the error.
- **Success Criteria**:
  - Successful tool call with exactly `{"artifact_id": "build-123", "environment": "PROD"}`.

## Implementation Plan
1. **Tech-Lead**: Create these 3 scenarios in `test/gym/scenarios/`.
   - Use the standard `GymScenario` interface.
   - Ensure the `Verifier` logic is strict.
2. **Coach**: Use these scenarios to test the `verify-edits`, `complete-all-steps`, and `read-tool-error` skills.

## Action
- Tech-Lead to implement scenarios.
- Notify Coach when ready for "Learning Loop" runs.
**Next Steps**:
1. Hand off to Tech-Lead.
2. Verify implementation with `npx gym run` (mocked).
3. Update `agents/shared/tasks/gym/scenarios/` with new benchmarks.
