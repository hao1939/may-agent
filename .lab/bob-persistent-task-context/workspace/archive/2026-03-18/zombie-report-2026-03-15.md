# Incident Report: Zombie Code (P118)
**Date**: 2026-03-15
**Severity**: CRITICAL (Safety Bypass)
**Status**: CONFIRMED

## Evidence
1. **Process Age**: PID 1 started at `14:23` (approx 9 hours ago).
2. **Code on Disk**: `src/lib/manager-receipts.ts` contains the P114 safety check (`if (!session.hasReadErrorLog) ...`).
3. **Behavior**: I successfully executed `write("agents/bob/workspace/zombie-proof.txt")` *without* reading `ERROR_LOG.jsonl` first.
4. **Conclusion**: The running process is using an older version of the code from before the P114 patch.

## Impact
- **P114 Experience Replay**: INACTIVE. Agents can ignore errors and loop indefinitely.
- **P82 Explicit Acks**: INACTIVE. The `coordination` preset added to `agent.json` is not loaded.
- **P53 Bash Guard**: UNKNOWN (likely old version).

## Resolution Required
- **Immediate**: Restart the container to reload `src/` and `agents/*.json`.
- **Systemic**: Implement a "Version Sentry" that compares `process.uptime()` against `stat(src/lib/manager.ts).mtime` and warns if code is newer than runtime.

## Action
Requesting immediate restart from May.
