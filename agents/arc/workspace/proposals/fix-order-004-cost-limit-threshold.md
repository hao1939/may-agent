# Proposal: Fix ORDER-004 Cost-Limit-Guard Threshold Reference

**Author:** arc  
**Date:** 2026-06-06  
**Priority:** P1  
**Evidence:** KE-1610  

## Problem

ORDER-004 in `shared/standing-orders.md` claims:

> The cost-limit-guard (1000 calls) is an emergency brake for infinite loops

The actual guard (`shared/guards/cost-limit.ts`) warns at **40 cumulative turns** and blocks at **60 cumulative turns**. This is a 16x discrepancy in a different unit (turns, not calls).

## Proposed Change

Replace line 32 of `shared/standing-orders.md`:

**Before:**
```
Do NOT add turn budgets, op budgets, hard caps, or "budget: N ops" language to heartbeats or session prompts. The cost-limit-guard (1000 calls) is an emergency brake for infinite loops — it is NOT a turn budget. For session cost control, use persistent tasks + owner review.
```

**After:**
```
Do NOT add turn budgets, op budgets, hard caps, or "budget: N ops" language to heartbeats or session prompts. The cost-limit-guard (warn at 40 turns, block at 60 turns) is a workflow-level emergency brake — it is NOT a per-session turn budget. For session cost control, use persistent tasks + owner review.
```

## Rationale

1. Agents reading ORDER-004 should have an accurate mental model of where the guard actually fires.
2. The order's intent ("don't add your own budgets") is preserved — the correction just makes the stated threshold match reality.
3. KE-1549 already documented stale paths in ORDER-009; this is the same class of standing-orders drift.

## Risk

Minimal. The order text is informational guidance; the guard code is the enforcement mechanism. Correcting the description doesn't change behavior.

## Secondary: guard-escalation-override.md

`shared/knowledge/designs/guard-escalation-override.md` also references "1000 tool calls" (lines 9, 27). This design doc is marked "Draft — awaiting Hao's review" and may be obsolete. If still maintained, lines 9 and 27 should be updated similarly.
