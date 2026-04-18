# Brief: Fix Gym Identity Isolation (Infra)

## Problem: Non-Coder Agents Fail in Gym
Agents like Coach, Bob, and Optimizer fail in Gym scenarios (e.g., "Total Failure" in judge-bias tests) because they cannot find their identity files (`SOUL.md`, `heartbeat.md`).
- **Cause**: `gym-runner.ts` copies the agents folder for "Lab Fork" runs but **NOT** for standard runs.
- **Effect**: Standard agents run with `AGENTS_ROOT` pointing to the live `agents/` directory. But the agent process executes in `/tmp/gym-scenario-xyz/work`.
- **Failure**: When Bob tries to `read("agents/bob/heartbeat.md")`, he looks in `/tmp/gym-scenario-xyz/work/agents/bob/heartbeat.md`, which **does not exist**.

## Solution: Always Sandbox Agents
Modify `test/gym/gym-runner.ts` to **always** create a sandbox copy of the agent, even for standard runs.

### Implementation Steps
1. **Always Create Temp Agents Dir**:
   In `test/gym/gym-runner.ts`, regardless of `opts.labFork`, create a temporary `agents-gym` directory inside the scenario root.
2. **Copy Target Agent**:
   Recursively copy the target agent's folder (e.g., `agents/bob`) from the real project root to this temp directory.
3. **Inject Identity Overrides (Optional)**:
   If the scenario `environment/` folder contains `SOUL.md` or other identity files, copy them **over** the sandboxed agent files. This allows scenarios to test specific personas (e.g., "You are a Sycophant").
4. **Point AGENTS_ROOT**:
   Set `AGENTS_ROOT` environment variable to this temp `agents-gym` directory.

### Why This Fixes It
- Agent runs in `/tmp/gym-scenario-xyz/work`.
- Agent reads `AGENTS_ROOT/bob/SOUL.md` -> Finds it in sandbox (Safe).
- Agent tries to `read("agents/bob/heartbeat.md")` -> Fails (relative path).
- **WAIT**: If agent runs in `work`, and `agents` folder is in `..`, then `read("agents/...")` fails.
- **CORRECTION**: We must copy the `agents/` folder **INTO** the work directory: `/tmp/gym-scenario-xyz/work/agents/bob`.
- **AND** set `AGENTS_ROOT` to `/tmp/gym-scenario-xyz/work/agents`.

### Revised Plan
1. In `gym-runner.ts`, inside `runAgent`:
   - Create `workDir/agents`
   - Copy `projectRoot/agents/<name>` to `workDir/agents/<name>`
   - Set `AGENTS_ROOT` env var to `workDir/agents`

## Action
Tech-Lead: Apply this fix to `test/gym/gym-runner.ts`.
