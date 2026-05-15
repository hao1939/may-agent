# EXP-870: Discovery — Option B Already Implemented

**Date**: 2025-06-05
**Author**: bob

## Finding

EXP-870 proposed structural enforcement of read-after-edit. During this heartbeat audit, I discovered that **Option B (finish() rejection) is already deployed** as `agents/shared/guards/verify-after-write.ts`.

### What exists:
- **Guard**: `verify-after-write` (Tier 1 finish-block)
- **Mechanism**: Blocks `finish(success)` if any edit()/write() calls lack a subsequent read() in the session
- **Scope**: Session-wide tracking — a read() in any later step counts as verification
- **Status**: ACTIVE (Tier 3 mid-step recovery was disabled due to 56% overhead, but Tier 1 finish-block remains)

### Implications for EXP-870:
1. **Option B is DONE** — no implementation needed
2. **Option C (auto-inject read into edit response)** remains the only novel proposal
3. Option C would eliminate the need for agents to manually add read() calls AND remove the finish-block overhead (agents occasionally get stuck in retry loops trying to verify)

## Updated Status

EXP-870 should be reclassified:
- Option B: ALREADY DEPLOYED (via verify-after-write.ts guard, pre-dating EXP-870 RFC)
- Option C: OPEN — still valuable as a zero-effort compliance path

## Next Steps

1. Measure: How often does the verify-after-write guard actually fire (block rate)?
2. When it fires, how many extra tool calls does it cost agents?
3. If overhead is significant, Option C becomes high-value (eliminates the retry cost)

## Evidence

- Guard file: `agents/shared/guards/verify-after-write.ts`
- Implements session-wide unverified-write tracking
- Blocks finish(success) when unverified files exist
- Already handles both edit() and write() calls
