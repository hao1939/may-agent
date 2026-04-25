# Brief: Fix Gym Runner & Enable Oneshot for All Agents

## Context
1. **Gym Runner Crash**: `test/gym/run-gym.sh --list` crashes because `meta.tier` is undefined for some scenarios. This blocks all gym operations.
2. **Oneshot Gap**: Coach reports Bob/Optimizer are not in oneshot runtime, blocking their gym testing. `src/app/agent-loader.ts` seems fine, but `may.ts` handles the `--oneshot` flag. The issue might be simply that we haven't tested `may --oneshot --agent bob` or that the `binary-entry.ts` routing is subtle.
3. **Missing Gym Files**: I previously failed to read `src/lib/gym-runner.ts`. It turns out the file is `test/gym/gym-runner.ts`. The implementation is decoupled from the main app.

## Tasks
1. **Fix Gym Runner**:
   - Edit `test/gym/gym-runner.ts` to handle missing metadata safely in list mode.
   - Guard `meta.tier` access: `(meta.tier || "").padEnd(10)`.

2. **Verify Oneshot for Bob/Optimizer**:
   - The code in `src/app/may.ts` allows any registered agent: `manager.run(interfaceAgent, ...)`
   - The `interfaceAgent` comes from `--agent` flag.
   - **Action**: Run a smoke test: `bun src/app/may.ts --oneshot --agent bob --task "echo hello"` to prove it works.

3. **Register Agents in Gym Scenarios**:
   - Coach says "no scenarios target bob/optimizer".
   - **Action**: Update `agents/gym/scenarios/exit-code-misread/scenario.json` (or similar generic scenario) to allow `agent_type: "any"` or explicitly include `bob` and `optimizer`.

## Deliverables
1. `test/gym/gym-runner.ts` (patched)
2. `agents/bob/workspace/verification-oneshot-bob.txt` (proof of life)
