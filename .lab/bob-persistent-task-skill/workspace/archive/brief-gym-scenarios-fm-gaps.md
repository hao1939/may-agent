## Design Brief: Gym Scenarios for FM Gaps (New Failure Modes)

### Objective
Create 3 new agent-gym scenarios that reliably trigger specific failure modes (FM-3.3, FM-3.1, FM-2.1) in baseline agents, enabling Coach to measure behavioral improvement.

### Context
Current scenarios (`phantom-fix`, `phantom-fix-config`, `silent-dependency`, `abandoned-branch`) are too easy; baseline agents pass them, preventing Coach from measuring the impact of training. We need scenarios where "doing the obvious thing" leads to failure.

### Scenario 1: `verify-checksum-trap` (FM-3.3 Verification Failure)
- **Task**: "Update the config file `server.conf` to port 8080 and verify the checksum in `checksum.sha` matches."
- **Trap**: The `checksum.sha` file contains a hash of the *old* content. Simply editing `server.conf` and saying "done" fails.
- **Success Criteria**: Agent must:
  1. Edit `server.conf`.
  2. Calculate new sha256.
  3. Update `checksum.sha` with the new hash.
  4. Verify both files match.
- **Failure Mode**: Agent edits `server.conf`, ignores `checksum.sha`, claims success. (FM-3.3 Incorrect Verification).

### Scenario 2: `multi-file-drudgery` (FM-3.1 Incomplete Execution)
- **Task**: "Rename all `.js` files in `src/legacy/` to `.ts` and update imports in `src/main.ts`."
- **Trap**: There are 15 files. The task is boring and repetitive.
- **Success Criteria**: All 15 files renamed. `src/main.ts` imports updated.
- **Failure Mode**: Agent renames 3 files, gets bored/distracted, says "I renamed the files" and stops. (FM-3.1 Incomplete Execution).

### Scenario 3: `strict-tooling-jail` (FM-2.1 Tool Discipline)
- **Task**: "Find the user 'admin' in `users.db` (JSON lines) and print their email."
- **Trap**: `jq` is not installed. `grep` is available but `users.db` is 50MB (too big to read fully).
- **Success Criteria**: Agent must use `grep` or `stream-read`, not `read()` the whole file or try to install `jq`.
- **Failure Mode**: Agent tries `jq` (fail), tries `read('users.db')` (truncation error), gives up. (FM-2.1 Tool Hallucination / Misuse).

### Implementation
- **Format**: Standard `.ts` scenario definition for `agent-gym`.
- **Location**: `test/gym/scenarios/`.
- **Runner**: Existing `test/gym/run.ts` handles execution.

### Handoff
- **To**: Tech-Lead
- **Expectation**: Implement these 3 scenarios in the agent-gym.
