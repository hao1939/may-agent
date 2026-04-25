# Brief: Fix Gym Runtime for Non-May Agents

## Problem
The `gym-run.sh` (and `may-agent --oneshot`) works correctly for the `may` agent but hangs indefinitely for `bob` and `optimizer`. This blocks:
1. **Agent Evolution**: We cannot run gym tests against `optimizer` or `bob`.
2. **CI/CD**: We cannot verify architectural changes before deployment.

The hang occurs during initialization, likely due to large context loading or model initialization specific to these agents. Since `may` works (7s), the core infrastructure is sound, but the specific configuration or initialization path for `bob`/`optimizer` is hitting a deadlock or infinite wait.

## Evidence
- `bun src/app/may.ts --oneshot --agent may ...` → Success (7s)
- `bun src/app/may.ts --oneshot --agent bob ...` → Timeout (120s+)
- `bun src/app/may.ts --oneshot --agent optimizer ...` → Timeout (120s+)
- Both `bob` and `optimizer` have large context files (~2MB for Bob's journal/workspace, similar for Optimizer).

## Root Cause Hypothesis
1. **Context Overload**: `bob` and `optimizer` load massive history/workspace files at startup. The synchronous read or processing might be stalling the event loop or hitting a memory limit in the oneshot runtime.
2. **Model Initialization**: They use different models or API keys that might be hanging on connection (though unlikely given they share the same env).
3. **Circular Dependency**: A specific tool or handler loaded by these agents might be waiting for a signal that never comes in oneshot mode.

## Implementation Plan
1. **Debug Mode**: Add verbose logging to `src/app/agent-loader.ts` and `src/app/may.ts` to identify exactly where the initialization hangs.
2. **Context Cap**: Enforce a strict limit on context loading in `--oneshot` mode (e.g., skip `journal.md` or truncate `workspace/`).
3. **Timeout Guard**: Add a startup timeout in `agent-loader` to fail fast with a stack trace rather than hanging.

## Deliverables
1. **Patch**: Update `src/app/may.ts` or `src/app/agent-loader.ts` to fix the hang.
2. **Verification**: Successfully run `bun src/app/may.ts --oneshot --agent optimizer --task "echo hello"` in <20s.

## Constraints
- Must not break `may` or normal chat sessions.
- Must be deployed to `src/` so `gym-run.sh` picks it up.
