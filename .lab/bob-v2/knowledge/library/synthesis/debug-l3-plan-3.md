# L3 Investigation: Timeouts

## Finding
- `manager.waitFor(sessionId)` has a default timeout of `600_000` ms (10 minutes).
- `manager.callAgent(...)` accepts an `opts.timeout`.

But where is `callAgent` called from?
It's called from the `agents` tool implementation in `createAgentsTool`.

Let's check `createAgentsTool` implementation in `src/lib/manager.ts`.
I need to see if it passes a `timeout` to `callAgent`.
