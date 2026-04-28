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

### M6: Measure ACTUAL M3/M4 impact ✅ (insufficient)
- Measured 2026-04-22: rate = **0.4815** (13/27 acted). Below 0.65 target.
- **Per-agent breakdown (7d window):**
  - may: 4/15 = **27%** ← primary failure source, virtually unchanged
  - coach: 9/12 = **75%** ← healthy, acts on breadcrumbs
- Context.md directive for may IS deployed but may still defaults to "read-only monitoring"
- **Diagnosis**: Wording interventions (M3 directive format, M4 escalation, context.md directive) are insufficient for may. May's heartbeat loop is too ingrained — it reads metrics, reports "healthy", and exits without investigating red items. This is a **structural** problem, not a wording problem.
- Trend: 0.19 → 0.31 → 0.44 → 0.50 → 0.48 (plateaued)

### M7: Structural enforcement — workflow-level breadcrumb gate ✅
- Implemented Option 1 (workflow gate) across ALL 8 heartbeat workflows
- **What it does**: After metrics load, if any metric has "⚠️ BELOW TARGET":
  1. A dedicated `runAgent` gate step fires BEFORE normal heartbeat work
  2. Agent must investigate/fix/escalate/defer each red metric
  3. Workflow extracts red metric IDs and verifies the agent's response mentions each one
  4. If any metrics are missed, a retry prompt forces the agent to address them
  5. Only after gate completes does the main heartbeat proceed
- Files changed: all `agents/*/workflows/*-heartbeat.ts` (8 files)
- **Next**: Measure impact over 7 days → M8

### M8: Sustained 0.80
- 7-day rolling rate ≥ 0.80
- Project complete

### M10: Fix threshold≠target gap ✅
- **Problem**: `may.alert-to-reaction-time` had threshold=150 but target=75. Value was 105, so gate never fired (1/25 sessions). The gate checks for `⚠️ BELOW TARGET` which requires threshold breach.
- **Fix**: Lowered threshold to 75 (=target) in metrics table. Now value 105 > threshold 75 → gate fires.
- **Completed**: 2026-04-22 (coach heartbeat)
- **Next**: Measure over 7 days. If may gate now fires consistently, expect breadcrumb-action-rate to jump toward 0.70+

### M9: May-specific heartbeat intervention ⏳
- **Problem**: 6/8 non-acting sessions are may. May sees G-pattern + breadcrumbs but ignores them during "read-only monitoring heartbeats."
- **Intervention**: Added "Metric Accountability (MANDATORY)" section to `agents/may/heartbeat.md` before Anti-patterns. Requires may to either dispatch work for red metrics OR explain why not in session summary. Explicitly bans "read-only monitoring" when red metrics exist.
- **Dispatched**: 2026-06-28 via fork to may (session s_1776826706484_67)
- **Next**: Measure may-specific action rate over 7 days → expect may rate to rise from 27% toward 70%+

## Risks

1. **Over-indexing on wording**: If agents ignore "ACTION REQUIRED" too, the problem is architectural (heartbeat sessions are too short / have too many competing priorities)
2. **False compliance**: Agents might mention "metric" in summary without actually investigating — need to tighten action patterns in measurement script
3. **may-specific fix needed**: May might need a heartbeat prompt restructure, not just better breadcrumbs
