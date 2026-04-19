# EXP-132 Binary Rebuild Log

**Date**: 2026-04-12T08:54Z
**Session**: s_1775984053211_1994

## What was done
The path hallucination guard from EXP-132 was merged to main source but the binary at `bundle/may-agent` hadn't been rebuilt since Apr 9. Rebuilt with:

```
bun build --compile src/app/binary-entry.ts --outfile bundle/may-agent
```

## Verification
- `tsc --noEmit`: exit 0
- Build: 1172 modules, 107ms
- Old binary: 107,119,394 bytes (Apr 9 06:24)
- New binary: 104,035,368 bytes (Apr 12 08:54)
- `grep -c HALLUCINATED_PREFIXES bundle/may-agent` → 4
- `grep -ao createPathHallucinationGuard bundle/may-agent` → 2 matches

Guard is now active in production binary.
