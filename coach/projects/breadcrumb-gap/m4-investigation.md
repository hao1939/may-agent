# M4 Investigation: Why Agents Ignore Breadcrumbs

**Date**: 2026-06-20
**Rate at investigation time**: 0.4286 (9/21 acted)

## Session Analysis

Examined 12 non-acting sessions. Findings:

### Pattern 1: May's "read-only monitoring" default (9/12 failures)

May sessions consistently self-describe as "read-only monitoring heartbeat" or "read-only health check heartbeat". The agent sees the breadcrumb, sees the `⚡ FIRST — evaluate your red metrics` directive, and **still does nothing**. Example sessions:

- `s_1776801944021_21`: "No files were written or modified — this was a read-only monitoring heartbeat." (48s, 3 ops)
- `s_1776803234355_43`: Same pattern. 58s, 4 ops.
- `s_1776806834096_11`: Same. 44s, 3 ops.
- `s_1776810434610_33`: Same. 51s, 3 ops.
- `s_1776812234617_46`: Same. 37s, 8 ops.
- `s_1776814034689_55`: Same. 40s, 8 ops.

These sessions are extremely short (37-58s) and do 3-4 ops. May is likely: reading the system snapshot, seeing nothing on fire, and finishing. The breadcrumb is **below the fold** — it's just one line among many, and the "read-only" habit is deeply ingrained.

### Pattern 2: Coach distracted by other work (2/12 failures)

- `s_1776801434349_2`: Coach was fixing broken workflows (growth-cycle module missing). Session aborted.
- `s_1776801753542_13`: Coach was cleaning up stale files. Reasonable competing priority.

### Pattern 3: May doing git housekeeping instead (1/12)

- `s_1776801753529_11`: "Working tree is clean for my files." Spent entire session on git status.

## Root Cause Analysis

**Primary cause: Habituation.** May has seen `may.alert-to-reaction-time` breached at exactly 136.8s for at least 5 consecutive snapshots (all identical value). The metric is stale — it hasn't changed because nobody has acted on it, but because it hasn't changed, May treats it as background noise.

The M3 directive wording ("ACTION REQUIRED") didn't help because:
1. It's the **same message every time** — after 5+ identical heartbeats, any static text becomes invisible
2. May's sessions are too short (37-58s) to do real investigation — it's defaulting to "monitor and move on"
3. The metric value hasn't moved at all (136.817 for 5+ checks), reinforcing "nothing new to act on"

## M4 Implementation: Escalation for Repeated Alerts

**Fix**: When a metric has been breached for 3+ consecutive snapshots, inject escalating language:

```
📊 may.alert-to-reaction-time: 136.8 (target 30) ⚠️ BELOW TARGET
  ⛔ REPEATED ALERT (seen 5x): This metric has been failing for 5 consecutive checks with NO action taken.
  → You MUST act on this NOW. Continuing to ignore it is not acceptable.
  → Quick check: run SQL — ...
  → ACTION REQUIRED: Investigate this metric NOW or explain in your session summary why you deferred it.
```

This addresses habituation by:
1. **Changing the text** each time (count increases) — breaks pattern blindness
2. **Escalating urgency** — "seen 5x" creates accountability pressure
3. **Calling out inaction explicitly** — "NO action taken" confronts the agent with its own failure

Applied to all 8 heartbeat workflows: amy-kimi, bob, coach, may, optimizer, qa, scout, tech-lead.

## Hypothesis

If the root cause is habituation (same message → invisible), M4 should break through by making each occurrence visually distinct and escalating. Expected impact: +10-15pp on action rate.

If M4 doesn't work, the problem is architectural: May's heartbeat sessions are too short / too focused on "read-only monitoring" as a default behavior. That would require restructuring May's heartbeat prompt to make metric investigation the **primary** action, not an optional addition.
