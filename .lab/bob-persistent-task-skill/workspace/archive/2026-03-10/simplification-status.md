# Status Check: Session Simplification

## Migration Progress

- [x] **Binary Model**: `manager.ts` distinguishes persistent vs task agents.
- [x] **Fresh Heartbeats**: `run/cron.ts` uses fresh sessions.
- [x] **Cron Backpressure**: `run/cron.ts` implements skip logic.
- [ ] **Hardcode Interface Persistence**: `manager.ts` still trusts `opts.persistent`. Needs to gate it via `process.env.AGENT`.
- [ ] **Cleanup**: `idle` state logic still exists in `manager.ts`.
- [x] **Unified State Machine Proposal**: Approved with modifications (remove TTL).

## Verification Questions

1.  Does `run` force `persistent: true` only for the interface agent?
    - **Check**: `src/manager.ts:867` uses `opts?.persistent ?? false`. It does NOT enforce the interface agent rule yet.
    - **Fix**: Modify `run()` to ignore `opts.persistent` and use `name === process.env.AGENT` (or a passed-in config).

2.  Does cron correctly skip overlap?
    - **Check**: `run/cron.ts` uses `heartbeatRunning` set. Logic looks correct.

3.  Is `followUp` blocked for ephemeral sessions?
    - **Check**: `src/manager.ts` needs to check `session.persistent` before allowing followUp.

## Next Steps (for May/Coder)

1.  Update `manager.ts`:
    - Inject `interfaceAgentName` into constructor.
    - In `run()`, set `persistent = (name === this.interfaceAgentName)`.
    - In `followUp()`, throw if target session is not persistent.
2.  Update `run/cron.ts`:
    - Remove `heartbeatSessions` map (no longer needed since sessions are ephemeral).
3.  Implement `ActiveSession` refactor:
    - Replace `persistent` with `autoClose` ("immediate" | "never").
    - Remove `done`/`error` states (move to metadata).
