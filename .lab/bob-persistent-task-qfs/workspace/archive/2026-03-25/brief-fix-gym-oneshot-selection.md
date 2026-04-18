# Brief: Fix Gym Runner Oneshot Execution

**Problem**:
The gym-runner relies on `src/app/may.ts`'s oneshot mode (`--oneshot`) to execute scenarios. Currently, `may.ts` ignores the `--agent` flag in oneshot mode, defaulting to running "may". This causes Coach's gym verification to fail with "bob/optimizer NOT in oneshot runtime".

**Goal**:
Update `src/app/may.ts` to respect `--agent` when `--oneshot` is present, allowing any agent to be run in oneshot mode for gym testing.

**Implementation Plan (Tech-Lead)**:
1. **Edit `src/app/may.ts`**:
   - Locate the `if (args.oneshot)` block.
   - Change the hardcoded `"may"` agent selection to use `args.agent || "may"`.
   - Ensure the selected agent is passed to `agentLoader.loadAgent()`.

**Verification**:
- Run `bun src/app/may.ts --oneshot --agent optimizer --task "echo hello"` -> Should run as optimizer.
- Run `bun src/app/may.ts --oneshot --task "echo hello"` -> Should default to may.

**Why**:
Enables the "Agent Evolution" loop where Coach/Optimizer can be benchmarked in the gym.
