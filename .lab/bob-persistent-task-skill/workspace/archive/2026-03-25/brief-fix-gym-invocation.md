# Brief: Fix Gym Runner (Oneshot Runtime)

**Status:** P0 (Blocking Evolution Loop)
**Owner:** Tech-Lead
**Context:** The `optimizer` and `coach` agents cannot run in Gym because the oneshot runtime defaults to the "may" agent, ignoring the `--agent` flag.

## Changes Required

### 1. `src/app/may.ts`
The current implementation of `interfaceAgent` (lines 350-357) defaults to `process.env.AGENT || "may"`.
However, in oneshot mode, we often pass `--agent <name>` which is parsed *after* `interfaceAgent` is initialized.

**Logic Update:**
1. Move `interfaceAgent` resolution logic to support `--agent` flag parsing *before* usage.
2. Ensure `--agent` flag takes precedence over `process.env.AGENT`.

```typescript
const interfaceAgent = (() => {
  // Support both --agent <name> and --agent=<name>
  const eqArg = process.argv.find((a) => a.startsWith("--agent="));
  if (eqArg) return eqArg.split("=")[1]!;
  const idx = process.argv.indexOf("--agent");
  if (idx !== -1 && process.argv[idx + 1]) return process.argv[idx + 1];
  return process.env.AGENT || "may";
})();
```

## Action
1. Verify `optimizer` oneshot runtime with correct syntax.
2. If successful, this brief is invalid and I will delete it.
3. If failed, I will debug the `interfaceAgent` logic again.

**Wait.** The previous session claimed to have fixed a `SyntaxError`. How did I verify it?
*Previous Session Log:* "Verified oneshot runtime works for `optimizer` by manually locating the `bun` binary and running a hello task."

**Wait.** I just verified it works: `{"sessionId":"s_1774422535491_0","status":"success"}`.
The agent *is* running.
This means the original premise ("Coach claims Bob/Optimizer not in oneshot runtime") might be:
1. A misunderstanding by Coach (invoking wrong command).
2. Or Coach is trying to run `optimizer` but defaulting to `may` because of how `may.ts` parses args.

**Observation:**
My manual invocation: `/app/.state/.bun/bin/bun src/app/may.ts --oneshot --agent optimizer --task "echo hello"`
Result: `Agent optimizer completed`.

This proves `optimizer` works in oneshot mode if invoked correctly.
The issue is likely how Gym invokes it.

**Gym Invocation Analysis:**
I need to check `src/lib/agent-gym.ts` (or wherever Gym logic lives) to see how it constructs the command.
If it uses `bun run start --oneshot ...` it might be using `package.json` scripts which might hardcode `may`.

**Next Step:**
Check `package.json` and Gym runner code.
Then update the brief to fix *that*.
