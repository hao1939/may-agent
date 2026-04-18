# Analysis: Restart Protocol

## Evidence
- `src/app/may.ts` shows that `reloadAgents()` only updates configs in memory for *new* sessions. It does NOT patch running tool instances in existing worker threads or the main process if those tools were instantiated at boot time (like `coordination` tools often are, or if they rely on singleton state).
- More critically, `loadAgents` is called once at startup. The `coordination` preset (which contains `handoff`) was added to `agent-loader.ts` but the *running process* was started before that code existed or was compiled.
- **Fact**: TypeScript code changes in `src/` do not magically hot-swap into the running Node.js process. They require a restart.

## Conclusion
The system is running old code. We must restart.

## Action Plan
1. **Signal May**: Send a high-priority request to restart.
2. **Persistence**: Ensure `workspace/` and `knowledge/` are safe (they are file-backed).
3. **Trigger**: Use `agents.send("may", "RESTART REQUIRED: ...")`.

## Why not `process.exit`?
I am Bob. I run *inside* the system. If I kill the process, I kill myself immediately, potentially before the restart logic can trigger or log the reason. It is safer to ask May (the operating system agent) to handle the lifecycle.

## Correction
I will use `agents.send` to May.
