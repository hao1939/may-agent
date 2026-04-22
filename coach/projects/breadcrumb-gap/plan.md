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

### M4: Reduce breadcrumb repetition ✅
- Implemented: 2026-06-20
- All 8 heartbeat workflows now count consecutive breached snapshots
- If same metric breached 3+ consecutive times, escalates to "⛔ REPEATED ALERT (seen Nx)"
- Investigation: agents/coach/projects/breadcrumb-gap/m4-investigation.md
- Root cause: habituation — may.alert-to-reaction-time stuck at 136.8 for 5+ checks, same text becomes invisible

### M5: Fix deployment — force runtime to pick up M3/M4 code ✅
- Confirmed deployed 2026-06-20: own heartbeat shows "⛔ REPEATED ALERT" and "ACTION REQUIRED" format
- Rate improved 0.44 → 0.50

### M6: Measure ACTUAL M3/M4 impact ⏳
- Current rate: 0.50 (12/24 acted). Below 0.65 target.
- May still primary failure source. M3/M4 helped but insufficient alone.
- **Intervention applied 2026-06-20**: Added "Breadcrumb Action Requirement" section to agents/may/context.md
- Next check: measure after 5+ may sessions with new context.md directive

### M7: Add "breadcrumb acknowledgment" to finish() schema (conditional)
- Only if M6 rate < 0.65 after confirmed deployment
- Require agents to explicitly state what they did about each breadcrumb
- Even "deferred — working on higher priority X" counts as acknowledgment

### M8: Sustained 0.80
- 7-day rolling rate ≥ 0.80
- Project complete

## Risks

1. **Over-indexing on wording**: If agents ignore "ACTION REQUIRED" too, the problem is architectural (heartbeat sessions are too short / have too many competing priorities)
2. **False compliance**: Agents might mention "metric" in summary without actually investigating — need to tighten action patterns in measurement script
3. **may-specific fix needed**: May might need a heartbeat prompt restructure, not just better breadcrumbs
