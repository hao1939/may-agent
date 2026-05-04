# Gate Implementation Status Audit — 2025-07-17 (updated)

## Summary
All gates deployed. EXP-870 `runGates()` extraction complete — custom-workflow agents can now opt in.

## Gate Status

| Gate | EXP | Status | Lines |
|------|-----|--------|-------|
| Artifact gate | EXP-520 | ✅ Deployed | ~458+ |
| Artifact gate FP fix | EXP-850 | ✅ Deployed (`usedWriteTools` check) | ~463 |
| Anti-shallow gate | EXP-725 | ✅ Deployed (tool call count ≥ 10) | ~494 |
| Impact gate fix | EXP-735 | ✅ Deployed (Option C semantic check) | ~525 |
| Duration gate | EXP-740 | ✅ Deployed (wall-clock < 90s) | ~560 |
| **Gate extraction** | **EXP-870** | ✅ **Done** — `runGates()` exported | ~457 |

## EXP-870 Implementation
Extracted all gate logic into `export async function runGates(ctx, agent, agentsRoot, result, heartbeatStartTime)`.
Custom workflows import and call it after `ctx.runAgent()`. Zero behavior change for existing agents.

**Next step**: Coach or individual agent owners wire `runGates()` into scout/dev/arc/coach custom workflows.

## Notifications Dismissed
- Re-escalation about "2 gate fixes pending" — stale, all implemented since prior audit
- EXP-860 gate logging enhancement — already present (gate-outcomes.log logs all passes + triggers)
- EXP-870 coverage gap — addressed with `runGates()` extraction
