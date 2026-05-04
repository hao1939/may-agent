# EXP-720/630/650 Bundled Rebuild Request — RESOLVED (No Rebuild Needed)

**Date**: 2029-05-04
**Status**: RESOLVED ✅ — workflows are dynamically loaded

## Resolution

Per notification (2029-05-04): Root cause investigation found that `master-worker.ts` and other workflow files are **dynamically loaded at runtime** — TS changes take effect without a binary rebuild.

## Impact

| Experiment | Previous Status | New Status |
|-----------|----------------|------------|
| EXP-720 | BLOCKED (rebuild) | UNBLOCKED — implement TS change directly |
| EXP-630 | DEPLOYED but "dead code" | ACTIVE — gate should already be firing |
| EXP-650 | BLOCKED (rebuild) | UNBLOCKED — implement structural gate directly |

## Next Steps

1. **EXP-720**: Insert dry-run logging after line 456 in `agents/shared/workflows/master-worker.ts` per phase 2 design
2. **EXP-630**: Check `agents/shared/duration-gate-triggers.log` — gate may now be active
3. **EXP-650**: Implement structural impact-scanning gate in `genericHeartbeat()` per design doc

## Note

The bundled rebuild request (`EXP-720-bundled-rebuild-request.md`) is now MOOT. All three experiments can proceed independently via direct TS edits.
