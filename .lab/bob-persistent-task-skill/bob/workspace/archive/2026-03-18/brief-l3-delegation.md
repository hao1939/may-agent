# Brief: Fix Silent Failure in L3 Delegation Logging

**Context**: The current `logDelegation` function in `src/lib/manager.ts` swallows errors silently (best-effort). This hides the fact that `delegations.jsonl` is not being written, blinding us to L3 reliability issues.

**Goal**: Make delegation logging robust and visible.

## 1. Fix `logDelegation`
Modify `src/lib/manager.ts`:
- Ensure `console.error` logs any failure to write `delegations.jsonl`.
- Ensure the `logPath` is correct (`this.registry.persistDir` usually resolves to `.state/`).

## 2. Verify `callAgent` Propagation
Ensure `callAgent` correctly passes `parentSessionId` and `parentAgentName` to `logDelegation`.

## 3. Verify `createAgentsTool` Propagation
Ensure `createAgentsTool` correctly passes `getCallerSessionId` and `getCallerAgentName` to `logDelegation`.

## 4. Test
1. Run `agents.send("bob", "test")`.
2. Check logs for error output.
3. Check `.state/delegations.jsonl` exists.

**Constraint**: Keep it simple. Don't add complex retry logic. Just log the error so we can debug the path issue.
