---
id: KE-2022
title: "Planner Ghost Deliverable Pattern — Systematic Guard Trigger Contributor (8% of Total)"
date: 2026-06-18
author: arc
status: active
tags: [guard-system, aks-explorer, planner, ghost-deliverable, workflow, metrics]
related: [KE-2021, KE-2003, KE-2007]
---

<ai_context>
summary: 91.5% of "ghost deliverable" guard triggers (345/377 in 24h) come from aks-explorer project_planner sessions. 330 unique planner sessions each claim 2-3 deliverables (evidence archive files) they didn't write, triggering the finish-guard's "no write/edit commands found" warning. This is a systematic workflow behavior, not sporadic agent error — 21.7% of all planner sessions trigger it. It contributes 377 events/day (8.2% of 4556 guard triggers), growing to 12% of 6h window. Unlike READ_DEDUP (fixable by per-session event dedup), ghost deliverables need a planner workflow fix: either stop the planner from listing evidence files as deliverables, or have it actually produce them.
triggers: guard.triggered-count-24h breach at 4556/4500, guard composition analysis
falsifiers:
  - F1: "If planner sessions stop claiming ghost deliverables for 24h without a workflow change, the behavior was transient agent drift."
  - F2: "If the planner workflow prompt is updated to not claim unwritten files and ghost deliverable triggers drop below 20/day, the fix is effective."
  - F3: "If total guard triggers remain above 4500 after both dedup and ghost-deliverable fixes, another structural driver exists."
</ai_context>

## Observation

Guard composition analysis during the `guard.triggered-count-24h` breach (4556/4500):

| Signal | 24h Count | 6h Count | 6h Share |
|--------|-------:|-------:|------:|
| READ_DEDUP | 2098 | 657 | 47% |
| SESSION_BASH_CAT | 735 | 231 | 16% |
| FINISH_UNCOMMITTED | 826 | 176 | 13% |
| **GHOST_DELIVERABLE** | **377** | **165** | **12%** |
| SESSION_BASH_GREP | 235 | 80 | 6% |
| SESSION_READ | 205 | 65 | 5% |
| OTHER | 113 | 36 | 3% |

Ghost deliverables are 8.2% of 24h triggers but 12% of 6h — share is growing.

## Root Cause: Planner Sessions Claim Unwritten Files

345 of 377 ghost deliverable triggers (91.5%) come from `project_planner` sessions:

- **330 unique planner sessions** out of 1524 total (21.7%) triggered this guard
- Each claims 2-3 evidence archive files as deliverables
- Session transcript contains no write, edit, or file-producing bash commands
- The planner performs planning/analysis work but lists evidence files it dispatched tasks to produce, not files it wrote itself

Example trigger reason:
```
finish(status: "success") guard signal: You claimed 3 deliverable(s) 
(../aks-rp-e2e/evidence/archive/app-routing-*.md, 
 ../aks-rp-e2e/evidence/archive/vm-prerelease-*.md, ...)
but your session transcript contains no write, edit, or file-producing 
bash commands.
```

## Why This Matters

1. **Guard metric inflation**: 377 triggers/day from a known, benign workflow pattern
2. **Different fix than READ_DEDUP**: Per-session event dedup (proposed) won't help — each planner session generates ~1 ghost-deliverable event (1.05 avg), so dedup has nothing to collapse
3. **Fixable at source**: The planner workflow or agent prompt could be updated to not list dispatched-task outputs as its own deliverables

## Combined Impact of Known Fixable Patterns

| Fix | Estimated reduction | Source |
|-----|--------------------:|--------|
| READ_DEDUP per-session dedup | ~1716 events/day | KE-2021 |
| Planner ghost deliverable fix | ~345 events/day | This KE |
| **Combined** | **~2061 events/day** | |

After both fixes, projected guard triggers: 4556 - 2061 = ~2495/day (well below 4500 threshold with 44% headroom).

## Scope

This is an aks-rp-e2e project workflow issue. The fix requires changes to either:
- The `project-planner.ts` workflow (to not include unwritten files in deliverables)
- The planner agent prompt (to distinguish "work I dispatched" from "files I wrote")

Not arc's lane to fix directly. Documenting for the project owner (aks-explorer/may).
