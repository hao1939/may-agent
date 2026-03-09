# Bob's Periodic Tasks

Track when each task was last done. Pick the most overdue one during heartbeat step 3.
This file is the source of truth — heartbeat.md references it.

## Daily (high priority — do this before other daily tasks when overdue)
- [x] **Daily Brief** — Last done: 2026-03-09
  Produce `agents/shared/daily-briefs/YYYY-MM-DD.md` for human review. (Focus task F5.)
  Steps:
  1. Read evaluations from last 24h (`.state/evaluations/`, sort by date, take recent)
  2. Categorize: how many sessions? avg quality? cost? which agents scored worst?
  3. Pick top 2 issues — the most frequent or most severe
  4. For each: read the actual session transcript, understand root cause
  5. Write concrete fix proposal (what to change, who owns it)
  6. Write the brief with: health snapshot, top issues, investigations, action items for human
  Keep the brief SHORT — human should read it in 2 minutes. No fluff.

## Daily (do one per heartbeat, rotate)
- [x] **Pattern Scan** — Last done: 2026-03-09
  Read recent session transcripts (last 24h) to find repeated manual workflows.
  If found → draft workflow proposal in agents/shared/workflow-proposals/.
  (This feeds focus task F2.)

- [x] **Drift Detection** — Last done: 2026-03-09
  Pick one random design doc in `agents/shared/` and compare to `agents/shared/philosophy.md`.
  Note discrepancies in `workspace/journal.md`.

- [x] **Synthesis** — Last done: 2026-03-09
  Read `agents/shared/SIGNALS.md` + recent agent outputs.
  Write cross-agent synthesis to `workspace/synthesis/`.

## Weekly (check if this week's is done)
- [x] **Synthesis Brief** — Last done: 2026-W11
  Compile week's insights into `workspace/weekly-briefs/YYYY-WXX.md`.
  Inputs: journal.md, SIGNALS.md, user inputs, recent sessions.

## Monthly (check if this month's is done)
- [x] **Philosophy Audit** — Last done: 2026-03-08
  Full read of `agents/shared/philosophy.md`. Prune dead principles. Merge duplicates.
  This is a deep edit, not a quick check.

- [x] **Roadmap Check** — Last done: 2026-03-08
  Review `agents/shared/roadmap.md`. Are we working on the right things?
  Flag misalignment in journal.md.

---

## How to use this file
When your heartbeat says "check periodic-tasks.md":
1. Read this file
2. Find the task that's most overdue (never done > longest since last done)
3. Do that task
4. Update the "Last done" date on the task you completed
5. If weekly/monthly task → check the box when done this period
