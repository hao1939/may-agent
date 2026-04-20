# Scout arXiv Windowing (Milestone 2)

**Status:** Design — awaiting review before any heartbeat.md / cron edits.
**Author:** bob · **Date:** 2026-04-17
**Related:** `idle-playbook.md` (M1), `adaptive-heartbeats.md` (parent)

## Problem

Scout runs heartbeats every 30 min (48/day), but fresh arXiv listings only drop Mon–Fri at a predictable window. Between windows, many cycles are no-ops or low-value.

## Evidence (last 21 days, `.state/may.db`)

- 563 scout heartbeat jobs / 21 days → 26.8/day (close to 48 theoretical; rest are skipped/failed).
- **Hour-of-day (UTC) avg opCount:** hour 0 = 25.7 (highest, matches arXiv 00:00 UTC drop); hours 17–22 = 5.5–6.7 (lowest).
- **Weekday no-op rate (opCount ≤ 2):** Thu 37/104 (36%), Fri 23/80 (29%), Wed 9/77 (12%); Sat/Sun/Mon ≈ 0–2%. Weekend sessions aren't idle — they do synthesis. Mid-week post-drop days are the idle ones.
- Interpretation: arXiv drop drives a big hour-0 spike; the rest of the day decays. The no-op concentration on Thu/Fri suggests scout runs out of fresh material faster than the cron schedule refills it.

## arXiv publication windows (verified)

- New submissions announced Mon–Fri at **00:00 UTC** (listings visible ~20:00 US ET previous day).
- No announcements Sat/Sun (but weekend is fine for triage/synthesis of backlog).

## Options

**(a) Align scout cron to arXiv windows.** E.g., dense schedule Mon–Fri 00:00–04:00 UTC, sparse elsewhere. Pros: cheapest. Cons: rigid, inventing a new cron pattern, loses the occasional high-value off-window synthesis, conflicts with May's adaptive-frequency work (M3).

**(b) Keep cron dense; fast-path to idle-playbook outside window.** Heartbeat checks time-of-day / day-of-week; if "outside window and no priority hit", skip the scan block and go directly to idle-playbook (already wired via M1). Pros: reuses M1 plumbing, zero cron changes, lets M3 own scheduling later. Cons: still spends heartbeat context on a check.

## Recommendation: **(b)**

Rationale:
1. Consistent with M1 framing ("don't just exit" — idle-playbook is the fallback).
2. Zero cron changes → no coupling with M3 (which is May-owned).
3. Data supports it: hour-0 is already doing work; the problem is Thu/Fri idle, which playbook already covers.
4. Low-risk: content-only edit to `scout/heartbeat.md`, no new mechanisms.

## Proposed edit (for next iteration, after review)

Add one sentence to scout's existing "DECIDE" step (line ~30, near the day-of-week note):

> **Outside the arXiv window?** (UTC Mon–Fri 00:00–06:00 = fresh-listings window. Sat/Sun or Mon–Fri 06:00–23:59 = outside.) If no priority hit and no rotation item ready, skip the batch-scan block and go straight to `agents/shared/may-agent-docs/idle-playbook.md` item. Produce one artifact.

No reordering, no Step restructuring (KE-008 compliance). One content addition.

## What this does NOT do

- Does not change cron (`agents/may/cron.json`). M3 owns cron.
- Does not disable any scout behaviors — scout can still override when signals warrant.
- Does not attempt to detect holidays, arXiv outages, or US ET clock changes. Simple UTC window, good enough for M2.

## Success metric (post-rollout)

- Scout's Thu/Fri no-op rate (opCount ≤ 2) drops by ≥ 50% over 2 weeks.
- Scout's `drops/` or `knowledge/` artifact count/week does not decrease.
- Query: same `.state/may.db` day-of-week aggregation as evidence section, 2-week lookback post-deploy vs. pre-deploy baseline documented here.

## Open questions

1. Is 06:00 UTC the right window end? (arXiv listings settle by ~04:00 UTC; buffer accounts for scout processing lag.) — **flag for review**.
2. Should "outside window" also apply to Mon 00:00 (weekend backlog is already processed)? Probably yes — treat Mon 00:00 as a window-start. — **flag for review**.

## Stop point

No edits to `scout/heartbeat.md` yet. Awaiting review before Milestone 2 rollout. Do NOT combine with M3 (KE-123 stacking penalty).
