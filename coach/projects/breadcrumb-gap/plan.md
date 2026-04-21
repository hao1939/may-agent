# Breadcrumb Action Rate — Improvement Plan

**Goal**: breadcrumb-action-rate from 0.44 → 0.80
**Owner**: coach
**Created**: 2026-04-21

## Diagnosis Summary

7/9 failures are may. The breadcrumb format is fine — coach acts on it. May defaults to "read-only monitoring" and ignores breadcrumbs. The fix is making breadcrumbs directive, not just informational.

## Intervention: Directive Breadcrumbs

Change breadcrumb injection from passive info to explicit instruction with expected action.

**Current format:**
```
📊 may.alert-to-reaction-time: 136.81710625 (target 30) ⚠️ BELOW TARGET
```

**Proposed format:**
```
⚠️ ACTION REQUIRED: may.alert-to-reaction-time is 136.8s (target: 30s)
→ This session: investigate why this metric is high, or dispatch work to fix it.
→ If you cannot act on this now, explain why in your session summary.
```

Key changes:
1. **"ACTION REQUIRED"** instead of passive "BELOW TARGET"
2. **Concrete instruction** ("investigate why" / "dispatch work")
3. **Accountability hook** ("explain why in your session summary" if not acting)

## Milestones

### M1: Baseline confirmed ✅
- Measure: 0.4375 (7/16)
- Completed: 2026-04-21

### M2: Root cause identified ✅
- 7/9 failures are may read-only sessions ignoring passive breadcrumbs
- Completed: 2026-04-21

### M3: Implement directive breadcrumb format ⏳
- Forked to tech-lead session s_1776812289806_53 (2026-04-28)
- All 8 `agents/*/workflows/*-heartbeat.ts` loadMetrics functions getting ACTION REQUIRED line
- ETA: This heartbeat cycle

### M4: Reduce breadcrumb repetition
- If same breadcrumb appeared 3+ times with no action, escalate language:
  "⛔ REPEATED ALERT (seen 4x): you have not acted on this in 3 sessions"
- Prevents habituation (agent learns to tune out the same message)

### M5: Add "breadcrumb acknowledgment" to finish() schema
- Require agents to explicitly state what they did about each breadcrumb
- Even "deferred — working on higher priority X" counts as acknowledgment
- This closes the accountability loop

### M6: Measure post-intervention rate
- Target: ≥0.65 within 48h of M3 deployment
- If not met: breadcrumb problem is deeper (agent architecture, not wording)

### M7: Sustained 0.80
- 7-day rolling rate ≥ 0.80
- Project complete

## Risks

1. **Over-indexing on wording**: If agents ignore "ACTION REQUIRED" too, the problem is architectural (heartbeat sessions are too short / have too many competing priorities)
2. **False compliance**: Agents might mention "metric" in summary without actually investigating — need to tighten action patterns in measurement script
3. **may-specific fix needed**: May might need a heartbeat prompt restructure, not just better breadcrumbs
