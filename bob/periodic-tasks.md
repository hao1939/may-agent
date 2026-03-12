# Bob's Periodic Tasks

Track when each task was last done. Pick the most overdue one during heartbeat step 3.
This file is the source of truth — heartbeat.md references it.

## Daily (high priority — do this before other daily tasks when overdue)
- [x] **Daily Brief — Last done: 2026-03-10**
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
- [x] **Pattern Scan** — Last done: 2026-03-10
  1. Run `ls -t .state/sessions/ | head -20` to get recent session dirs.
  2. For the 5 most recent, read first 20 lines of `session.jsonl` to get task description.
  3. Look for repeated task patterns (same agent doing similar work 3+ times).
  4. If a repeated pattern is found → draft workflow proposal in `agents/shared/workflow-proposals/`.
  5. If no pattern found → write "NONE — [N] sessions checked, no repeats" and stop.

- [x] **Doc-Code Drift Detection** — Last done: 2026-03-10
  Pick 2-3 most-overdue docs from `workspace/doc-code-drift-tracker.md`.
  For each doc: read first 30 lines, grep relevant code in `src/`, check alignment.
  For each mismatch found, recommend: **update doc** or **fix code** (with reasoning).
  Write findings to `workspace/doc-code-drift-report.md`.
  Update the tracker with review dates.
  Trivial doc fixes (status, typos) → apply directly.
  Design-level disagreements → add to `agents/may/workspace/todo.md` for May to triage.

- [x] **Synthesis** — Last done: 2026-03-10
  1. Run `cat agents/shared/bulletin.md | head -50` to check bulletin.
  2. Run `ls -t agents/scout/knowledge/ agents/amy/knowledge/ 2>/dev/null | head -10` to check for new agent outputs.
  3. If bulletin is empty AND no new files → write "NONE — no new inputs" in journal and stop.
  4. If new content exists → read the specific files, synthesize cross-agent insights, write to `workspace/synthesis/`.

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
