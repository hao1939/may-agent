<ai_context>
summary: ORDER-004 in standing-orders.md previously described the cost-limit-guard as blocking at "1000 calls." This was a 16x overstatement; the actual guard warns at 40 turns and blocks at 60. The finding was filed as a proposal and ORDER-004 was corrected (verified 2026-06-07). The guard-escalation-override.md design doc also no longer references "1000 calls." This KE is resolved.
triggers: ORDER-004, cost-limit-guard, standing orders, 1000 calls, 40 turns, 60 turns, guard threshold, coherence, stale reference, resolved
lifecycle: resolved
</ai_context>

# KE-1610: ORDER-004 Cost-Limit-Guard Threshold Contradiction

**Date:** 2026-06-06 (resolved 2026-06-07)
**Author:** arc (heartbeat coherence audit — repair of failed session s_1780707894049_656)

## Finding

**ORDER-004** in `shared/standing-orders.md` (line 32) states:

> The cost-limit-guard (1000 calls) is an emergency brake for infinite loops

**The actual implementation** in `shared/guards/cost-limit.ts` uses completely different thresholds and units:

```typescript
const WARN_TURNS = 40;
const BLOCK_TURNS = 60;
```

The guard tracks **cumulative agent turns** across workflow steps, not tool calls. It warns at 40 total turns and blocks at 60 — a 16x lower threshold than ORDER-004 claims, measured in a different unit.

## Affected Documents

| Document | Stale Claim | Actual Behavior |
|----------|------------|-----------------|
| `shared/standing-orders.md` ORDER-004 (line 32) | "cost-limit-guard (1000 calls)" | Warns at 40 turns, blocks at 60 turns |
| `shared/knowledge/designs/guard-escalation-override.md` (line 9) | "blocks at 1000 tool calls" | Blocks at 60 cumulative turns |
| `shared/knowledge/designs/guard-escalation-override.md` (line 27) | "emergency brake at 1000 calls" | Blocks at 60 cumulative turns |

The authoritative source is `shared/guards/REGISTRY.md`, which correctly states: "Tracks cumulative agent turns across workflow steps; warns at 40 total turns, blocks at 60."

## Why This Matters

ORDER-004's intent is sound: don't add turn budgets to heartbeats because the cost-limit-guard is a safety net. But by overstating the guard's threshold by 16x, agents believe the guard only fires in extreme runaway scenarios. In practice, the guard fires at 60 cumulative turns — well within range of a productive multi-step workflow. Agents may:

1. Design workflows expecting up to 1000 tool calls of headroom
2. Not recognize cost-limit-guard warnings at 40 turns as the same guard ORDER-004 describes
3. Misattribute guard blocks to something other than cost-limit because their mental model says the limit is 1000

## Root Cause

The guard was likely rewritten from a raw tool-call counter (which did use a higher threshold) to a cumulative-turns tracker (40/60), but ORDER-004 and the design doc were never updated to reflect the change. The `REGISTRY.md` and the guard source file are self-consistent with the current behavior; the stale references are in documents written before or independently of the refactor.

## Recommended Fix

`shared/standing-orders.md` is out of arc's edit lane. A proposal has been filed at `agents/arc/workspace/proposals/fix-order-004-cost-limit-threshold.md` for may/human review.

The `guard-escalation-override.md` design doc's stale references (lines 9 and 27) should also be updated, though the doc is marked "Draft — awaiting Hao's review" and may be superseded.

## Resolution (2026-06-07)

ORDER-004 was corrected. Line 32 of `shared/standing-orders.md` now reads:
> The cost-limit-guard (warn at 40 turns, block at 60 turns) is a workflow-level emergency brake

The `guard-escalation-override.md` design doc no longer contains "1000 calls" — its opening paragraph correctly states "blocks at 60 cumulative turns." Both stale references identified in this KE have been fixed.

Verified by arc heartbeat coherence audit, 2026-06-07.

## Cross-Reference

- **KE-1549**: Previously identified stale path in ORDER-009 (`agents/shared/guards/` → `shared/guards/`), same class of standing-orders drift.
- **KE-1596**: Arc's 19% error rate from budget exhaustion — the cost-limit-guard's actual 60-turn block is likely a contributing factor agents don't recognize.
- `shared/guards/REGISTRY.md`: Authoritative registry with correct thresholds.
