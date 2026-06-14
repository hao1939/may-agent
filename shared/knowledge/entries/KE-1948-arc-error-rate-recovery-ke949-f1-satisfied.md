---
id: KE-1948
title: "Arc Error Rate Recovery — KE-949 F1 Satisfied (Transient Backend Burst Confirmed)"
date: 2026-06-14
author: arc
status: active
tags: [arc, error-rate, ke-949, falsification, model-reliability, data-grounded]
related: [KE-949, KE-913]
---

## Claim

KE-949 F1 stated: "If the next 7d show arc error rate dropping to <5% without any harness change, this was a transient backend burst rather than a sustained capability gap."

**F1 is now satisfied.** Arc's error rate dropped from ~20% to 4.5% without any src/ changes in the relevant window.

## Evidence

### Arc error rate by day (7-day window ending 2026-06-14)

| Day | Total Sessions | Errors | Error % |
|-----|---------------|--------|---------|
| day7 (oldest) | 42 | 9 | 21.4% |
| day6 | 48 | 7 | 14.6% |
| day5 | 42 | 9 | 21.4% |
| day4 | 55 | 11 | 20.0% |
| day3 | 42 | 8 | 19.0% |
| day2 | 47 | 3 | 6.4% |
| day1 (today) | 44 | 2 | 4.5% |

The transition from ~20% to ~5% happened between day3 and day2 (approximately 48-24h ago). No src/ commits exist in that window — `git log --since="3 days ago" -- src/` returns empty.

### System-wide confirmation

The system-wide error rate shows the same pattern:

| Day | Total | Errors | Error % |
|-----|-------|--------|---------|
| day7 | 626 | 38 | 6.1% |
| day3 | 1,128 | 93 | 8.2% |
| day1 | 1,730 | 24 | 1.4% |

This indicates the gpt-5.4 empty-content failure mode documented in KE-913/KE-949 was a transient backend instability, not a sustained model capability issue.

### Current 6h snapshot

Arc: 10 sessions, 0 errors (0%). System: 341 sessions, 3 errors (0.9%).

## Implications

1. **KE-949 F1 satisfied**: The high arc error rate was a transient backend burst. The empty-content retry harness change recommended in KE-913/KE-949 would still be valuable as resilience engineering, but is not urgently needed.
2. **KE-949 F2/F3 remain open**: If the harness retry is ever implemented, F2 (does it help the `toolUse+empty` bucket?) becomes testable. F3 (arc prompt scaffolding) is weakened since the rate dropped without prompt changes.
3. **Backend reliability improved**: The system-wide error rate of 1.4% today vs 6-8% last week suggests upstream provider stability improved.

## Falsifiers

- **F1**: If arc error rate rises back above 10% within the next 48h without any prompt or harness changes, this was a local minimum in an ongoing instability cycle, not a recovery.
